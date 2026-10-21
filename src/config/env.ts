import { GEMINI_API_KEY as ENV_GEMINI_API_KEY } from '@env';

/**
 * App configuration.
 *
 * There is NO backend: the app talks to the Gemini API directly from the device.
 * Users paste their own key in Settings (stored in the iOS Keychain / Android
 * Keystore via react-native-keychain).
 *
 * GEMINI_API_KEY is an optional fallback read from the git-ignored `.env` file at
 * build time (see `.env.example`). Never hard-code a key in this file.
 *
 * Production note: any key bundled into a client app can be extracted from the
 * binary, even if it is not in git. If you ship a bundled key, restrict it in
 * Google Cloud Console → Credentials → "Application restrictions" (Android apps /
 * iOS apps) and API restrictions (Generative Language API), then fill in
 * APP_IDENTITY below so the matching headers are sent.
 */
export const GEMINI_API_KEY: string = ENV_GEMINI_API_KEY ?? '';

export const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com';
export const GEMINI_API_VERSION = 'v1beta';

/** Sent as X-Android-Package / X-Android-Cert / X-Ios-Bundle-Identifier when set. */
export const APP_IDENTITY = {
  androidPackage: 'com.novachat',
  androidCertSha1: '', // e.g. 'AB12CD...' (uppercase, no colons) of your release keystore
  iosBundleId: 'org.reactjs.native.example.NovaChat',
};

export type ModelRole = 'multimodal' | 'fast' | 'transcribe';

/**
 * Model chains, best first. The router picks a chain by the request's needs and
 * falls through to the next model on 404 / 429 / 5xx. At startup the chains are
 * filtered against the models the key can actually see (ListModels).
 */
export const MODEL_CHAINS: Record<ModelRole, string[]> = {
  // Text + image + video + audio + PDF in, function calling.
  multimodal: [
    'gemini-3.8-flash',
    'gemini-3.6-flash',
    'gemini-3-flash-preview',
    'gemini-2.5-flash',
  ],
  // Cheap / low-latency for short text-only turns.
  fast: [
    'gemini-3.5-flash-lite',
    'gemini-3.1-flash-lite',
    'gemini-3.8-flash',
    'gemini-2.5-flash-lite',
  ],
  // Audio → text for the mic button.
  transcribe: [
    'gemini-3.5-flash-lite',
    'gemini-3.8-flash',
    'gemini-3.1-flash-lite',
    'gemini-2.5-flash',
  ],
};

/** Models that accept `thinkingConfig.thinkingLevel`. Others get no thinking config. */
export const THINKING_LEVEL_MODELS: Record<string, 'low' | 'medium' | 'high'> =
  {
    'gemini-3.8-flash': 'low',
    'gemini-3.6-flash': 'low',
    'gemini-3-flash-preview': 'low',
  };

export const LIMITS = {
  maxAgentSteps: 6, // model ↔ tool round trips per user turn
  toolTimeoutMs: 15_000,
  toolResultMaxChars: 8_000,
  requestTimeoutMs: 90_000, // idle timeout: no bytes for this long → abort
  maxAttachments: 4,
  inlineMaxBytes: 4 * 1024 * 1024, // bigger files go through the Files API
  inlineTotalMaxBytes: 14 * 1024 * 1024, // request body cap is ~20MB after base64
  maxVideoBytes: 200 * 1024 * 1024,
  maxRecordingSecs: 120,
  historyMaxMessages: 40, // older turns are dropped from the prompt (not from the UI)
  fileApiTtlMs: 46 * 60 * 60 * 1000, // Files API keeps uploads 48h; re-upload a bit earlier
};

export const SYSTEM_PROMPT = `You are Nova, a helpful assistant inside a mobile chat app.
- Be concise and use Markdown (short paragraphs, lists, code blocks) when it helps.
- Users can attach images, videos and audio; describe and reason about them precisely.
- Use the provided tools whenever they give a more accurate answer (time, maths, weather, facts). Never invent tool results.
- If a tool fails, say so briefly and answer as best you can.`;
