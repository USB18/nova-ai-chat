# NovaChat — React Native CLI streaming AI chat

A no-backend, production-structured chat app: streaming answers, on-device tool calling,
image/video understanding and AI speech-to-text — all through one Google Gemini API key.

## Features

|                           |                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Streaming**             | Token-by-token answers over SSE, parsed from `XMLHttpRequest` progress events (RN `fetch` can't stream). UI updates are throttled to ~25 fps. Stop button aborts mid-stream; partial text is kept.                                                                                                                                                                                                                                      |
| **Tool calling**          | Agent loop (max 6 steps): model → parallel on-device tools → results back → final answer. Gemini 3 **thought signatures** are stored and replayed verbatim, so multi-step tool use stays valid across turns. Tools: time/time zones, safe calculator (no `eval`), weather (Open-Meteo), Wikipedia, device info. Each tool has a timeout, cancellation and size-capped results; failures are returned to the model rather than crashing. |
| **Multimodal**            | Attach up to 4 photos/videos (library or camera). Small images are inlined; videos and large files go through the Gemini **Files API** (resumable upload streamed from disk, progress, processing poll) and the upload reference is reused for 46 h, then re-uploaded from the local copy.                                                                                                                                              |
| **Dynamic model routing** | `Auto` picks a fast lite model for short text and a multimodal model for media or complex prompts. Each tier is a fallback chain (404 / 429 / 5xx → next model; transient errors retried once). Available models are discovered via `ListModels` and cached 24 h. Users can pin a model in Settings.                                                                                                                                    |
| **Speech-to-text**        | Tap mic → 16 kHz mono recording (AAC on Android, WAV on iOS) with a live level meter → transcribed by a Gemini audio model, streamed into the composer. Recordings are deleted afterwards. Auto-stops at 2 min.                                                                                                                                                                                                                         |
| **Production details**    | API key in Keychain/Keystore, sent as a header (never in URLs), redacted from logs; optional app-restriction headers; chat persisted to MMKV (debounced, last 200 messages) with attachments copied into app storage; interrupted turns recover as "stopped"; in-app toasts and confirm dialogs instead of native `Alert`; error boundary; light/dark theme; accessibility labels; typed end-to-end; unit tests.                        |

## Run it

Prereqs: the standard [React Native environment](https://reactnative.dev/docs/set-up-your-environment) (Node ≥ 22.11, JDK 17, Android Studio and/or Xcode).

```bash
npm install
cd ios && bundle install && bundle exec pod install && cd ..   # iOS only
npm run android     # or: npm run ios
```

Then open **Settings** in the app and paste a key from <https://aistudio.google.com/apikey>.
Optionally, set a fallback key for local builds in a git-ignored `.env` file at the project root
(read at build time by `react-native-dotenv`; restart Metro with `npm start -- --reset-cache` after changing it):

```bash
cp .env.example .env   # then set GEMINI_API_KEY=...
```

A key saved in Settings always takes precedence over the `.env` key. Never hard-code a key in `src/config/env.ts`.

```bash
npm test           # 47 unit tests: SSE parser, agent/tool loop, signatures, fallback, history,
                   # calculator, chat storage, secure key, alerts, UI smoke
npx tsc --noEmit   # typecheck
npm run lint
```

## Layout

```
src/
  config/env.ts            models, limits, system prompt, app identity (key comes from .env)
  lib/gemini/              http + SSE streaming, client, errors, Files API, history builder, model router
  lib/agent/runAgent.ts    streaming tool-calling loop (signatures, fallback, abort)
  lib/tools/               tool registry + built-in tools + safe math parser
  lib/speech/              recorder, transcription, useVoiceInput hook
  lib/media/               pickers, persistent file storage
  lib/storage/             MMKV chat/settings persistence, Keychain/Keystore key storage
  lib/utils/               logger (key redaction), ids
  state/ChatContext.tsx    reducer + actions (send, stop, retry, clear)
  components/              UI pieces; components/alerts/ = toasts + confirm dialogs
  screens/                 ChatScreen
  theme/                   light/dark tokens
  types/                   chat, Gemini and @env types
__tests__/                 Jest unit tests
```

**Add a tool:** create a `Tool` (declaration + `run`) and add it to `BUILTIN_TOOLS` in
`src/lib/tools/builtins.ts` (or call `registerTool`).

**Change models:** edit `MODEL_CHAINS` / `THINKING_LEVEL_MODELS` in `src/config/env.ts`.

## Security note (no backend)

Any key shipped inside an app can be extracted, including one injected from `.env` at build time
(keeping it out of git doesn't keep it out of the binary). Letting users bring their own key (the default
here) avoids that. If you bundle a key, restrict it in Google Cloud Console to the
_Generative Language API_ and to your Android package + signing-cert SHA-1 / iOS bundle ID,
then fill in `APP_IDENTITY` in `env.ts` so the matching headers are sent.
