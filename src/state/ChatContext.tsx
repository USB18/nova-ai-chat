import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from 'react';
import { LIMITS } from '../config/env';
import { AgentError, runAgent } from '../lib/agent/runAgent';
import { GeminiError } from '../lib/gemini/errors';
import { buildContents, historyHasRecentMedia } from '../lib/gemini/history';
import {
  modelChain,
  pickRole,
  refreshAvailableModels,
} from '../lib/gemini/modelRouter';
import { clearAttachmentDir } from '../lib/media/files';
import {
  loadMessages,
  loadSettings,
  saveMessages,
  saveSettings,
} from '../lib/storage/chatStore';
import { clearApiKey, loadApiKey, saveApiKey } from '../lib/storage/secureKey';
import { uid } from '../lib/utils/id';
import { logger } from '../lib/utils/logger';
import type {
  AssistantMessage,
  Attachment,
  ChatMessage,
  Settings,
  ToolCallRecord,
  UserMessage,
} from '../types/chat';
import { DEFAULT_SETTINGS } from '../types/chat';

interface State {
  ready: boolean;
  messages: ChatMessage[];
  settings: Settings;
  apiKey: { key: string; source: 'user' | 'demo' | 'none' };
  busy: boolean;
  /** Transient status line, e.g. "Uploading video… 40%". */
  activity: string | null;
}

type Action =
  | {
      type: 'hydrate';
      messages: ChatMessage[];
      settings: Settings;
      apiKey: State['apiKey'];
    }
  | { type: 'append'; messages: ChatMessage[] }
  | { type: 'truncateFrom'; id: string }
  | { type: 'patchAssistant'; id: string; patch: Partial<AssistantMessage> }
  | { type: 'upsertTool'; id: string; call: ToolCallRecord }
  | { type: 'updateAttachment'; messageId: string; attachment: Attachment }
  | { type: 'busy'; busy: boolean }
  | { type: 'activity'; activity: string | null }
  | { type: 'clear' }
  | { type: 'settings'; settings: Settings }
  | { type: 'apiKey'; apiKey: State['apiKey'] };

const initial: State = {
  ready: false,
  messages: [],
  settings: DEFAULT_SETTINGS,
  apiKey: { key: '', source: 'none' },
  busy: false,
  activity: null,
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'hydrate':
      return {
        ...state,
        ready: true,
        messages: action.messages,
        settings: action.settings,
        apiKey: action.apiKey,
      };
    case 'append':
      return { ...state, messages: [...state.messages, ...action.messages] };
    case 'truncateFrom': {
      const idx = state.messages.findIndex(m => m.id === action.id);
      return idx < 0
        ? state
        : { ...state, messages: state.messages.slice(0, idx) };
    }
    case 'patchAssistant':
      return {
        ...state,
        messages: state.messages.map(m =>
          m.id === action.id && m.role === 'assistant'
            ? { ...m, ...action.patch }
            : m,
        ),
      };
    case 'upsertTool':
      return {
        ...state,
        messages: state.messages.map(m => {
          if (m.id !== action.id || m.role !== 'assistant') {
            return m;
          }
          const exists = m.toolCalls.some(t => t.id === action.call.id);
          return {
            ...m,
            toolCalls: exists
              ? m.toolCalls.map(t =>
                  t.id === action.call.id ? action.call : t,
                )
              : [...m.toolCalls, action.call],
          };
        }),
      };
    case 'updateAttachment':
      return {
        ...state,
        messages: state.messages.map(m =>
          m.id === action.messageId && m.role === 'user'
            ? {
                ...m,
                attachments: m.attachments.map(a =>
                  a.id === action.attachment.id ? action.attachment : a,
                ),
              }
            : m,
        ),
      };
    case 'busy':
      return {
        ...state,
        busy: action.busy,
        activity: action.busy ? state.activity : null,
      };
    case 'activity':
      return { ...state, activity: action.activity };
    case 'clear':
      return { ...state, messages: [] };
    case 'settings':
      return { ...state, settings: action.settings };
    case 'apiKey':
      return { ...state, apiKey: action.apiKey };
  }
}

interface ChatApi extends State {
  send: (text: string, attachments: Attachment[]) => Promise<void>;
  stop: () => void;
  retry: (assistantId: string) => Promise<void>;
  clearChat: () => Promise<void>;
  updateSettings: (patch: Partial<Settings>) => void;
  setUserApiKey: (key: string | null) => Promise<void>;
}

const Ctx = createContext<ChatApi | null>(null);

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initial);
  const stateRef = useRef(state);
  stateRef.current = state;
  const controllerRef = useRef<AbortController | null>(null);

  // Hydrate persisted state + discover models.
  useEffect(() => {
    (async () => {
      // MMKV reads are synchronous; only the Keychain lookup is async.
      const messages = loadMessages();
      const settings = loadSettings();
      const apiKey = await loadApiKey();
      dispatch({ type: 'hydrate', messages, settings, apiKey });
      if (apiKey.key) {
        refreshAvailableModels(apiKey.key);
      }
    })();
  }, []);

  // Persist (debounced; immediate once a turn settles).
  useEffect(() => {
    if (state.ready) {
      saveMessages(state.messages, !state.busy);
    }
  }, [state.messages, state.busy, state.ready]);

  /** Run one assistant turn for a history that ends with a user message. */
  const runTurn = useCallback(
    async (history: ChatMessage[], userMsg: UserMessage) => {
      const { apiKey, settings } = stateRef.current;
      const assistant: AssistantMessage = {
        id: uid('a_'),
        role: 'assistant',
        text: '',
        status: 'pending',
        toolCalls: [],
        createdAt: Date.now(),
        turnContents: [],
      };
      dispatch({ type: 'append', messages: [assistant] });

      if (!apiKey.key) {
        dispatch({
          type: 'patchAssistant',
          id: assistant.id,
          patch: {
            status: 'error',
            error: new GeminiError('', 'auth').userMessage,
          },
        });
        return;
      }

      const controller = new AbortController();
      controllerRef.current = controller;
      dispatch({ type: 'busy', busy: true });

      // Throttle text updates to ~25fps to keep the list smooth while streaming.
      let latestText = '';
      let flushTimer: ReturnType<typeof setTimeout> | undefined;
      const flush = () => {
        flushTimer = undefined;
        dispatch({
          type: 'patchAssistant',
          id: assistant.id,
          patch: { text: latestText, status: 'streaming' },
        });
      };

      try {
        const contents = await buildContents(history, {
          apiKey: apiKey.key,
          signal: controller.signal,
          onAttachmentUploaded: (messageId, attachment) =>
            dispatch({ type: 'updateAttachment', messageId, attachment }),
          onUploadProgress: (att, f) =>
            dispatch({
              type: 'activity',
              activity:
                f < 1
                  ? `Uploading ${att.kind}… ${Math.round(f * 100)}%`
                  : `Processing ${att.kind}…`,
            }),
        });
        dispatch({ type: 'activity', activity: null });

        const role = pickRole({
          text: userMsg.text,
          attachments: userMsg.attachments,
          historyHasMedia: historyHasRecentMedia(history.slice(0, -1)),
          mode: settings.modelMode,
        });

        const result = await runAgent({
          apiKey: apiKey.key,
          contents,
          modelChain: modelChain(role, settings.modelMode),
          toolsEnabled: true, // always on; not a user setting
          temperature: settings.temperature,
          signal: controller.signal,
          callbacks: {
            onText: text => {
              latestText = text;
              if (!flushTimer) {
                flushTimer = setTimeout(flush, 40);
              }
            },
            onModel: model =>
              dispatch({
                type: 'patchAssistant',
                id: assistant.id,
                patch: { model },
              }),
            onToolStart: call =>
              dispatch({ type: 'upsertTool', id: assistant.id, call }),
            onToolEnd: call =>
              dispatch({ type: 'upsertTool', id: assistant.id, call }),
          },
        });

        if (flushTimer) {
          clearTimeout(flushTimer);
        }
        dispatch({
          type: 'patchAssistant',
          id: assistant.id,
          patch: {
            status: 'done',
            text:
              result.text ||
              (result.turnContents.length ? '' : '_(No response)_'),
            model: result.model,
            turnContents: result.turnContents,
            usage: result.usage,
          },
        });
      } catch (e) {
        if (flushTimer) {
          clearTimeout(flushTimer);
        }
        const err =
          e instanceof AgentError
            ? e.cause
            : e instanceof GeminiError
            ? e
            : new GeminiError(String(e), 'unknown');
        const partial = e instanceof AgentError ? e.partial : undefined;
        if (err.kind !== 'aborted') {
          logger.warn('Turn failed', err.kind, err.message);
        }
        dispatch({
          type: 'patchAssistant',
          id: assistant.id,
          patch: {
            status: err.kind === 'aborted' ? 'stopped' : 'error',
            error: err.kind === 'aborted' ? undefined : err.userMessage,
            text: partial?.text || latestText,
            turnContents: partial?.turnContents ?? [],
            // Mark any still-running tool as interrupted.
            toolCalls: (
              stateRef.current.messages.find(m => m.id === assistant.id) as
                | AssistantMessage
                | undefined
            )?.toolCalls.map(t =>
              t.status === 'running'
                ? { ...t, status: 'error' as const, error: 'Cancelled' }
                : t,
            ),
          },
        });
      } finally {
        controllerRef.current = null;
        dispatch({ type: 'busy', busy: false });
      }
    },
    [],
  );

  const send = useCallback(
    async (text: string, attachments: Attachment[]) => {
      const trimmed = text.trim();
      if (stateRef.current.busy || (!trimmed && !attachments.length)) {
        return;
      }
      const userMsg: UserMessage = {
        id: uid('u_'),
        role: 'user',
        text: trimmed,
        attachments: attachments.slice(0, LIMITS.maxAttachments),
        createdAt: Date.now(),
      };
      dispatch({ type: 'append', messages: [userMsg] });
      await runTurn([...stateRef.current.messages, userMsg], userMsg);
    },
    [runTurn],
  );

  const retry = useCallback(
    async (assistantId: string) => {
      const msgs = stateRef.current.messages;
      if (stateRef.current.busy) {
        return;
      }
      const idx = msgs.findIndex(m => m.id === assistantId);
      const userMsg = msgs[idx - 1];
      if (idx < 1 || userMsg.role !== 'user') {
        return;
      }
      dispatch({ type: 'truncateFrom', id: assistantId });
      await runTurn(msgs.slice(0, idx), userMsg);
    },
    [runTurn],
  );

  const stop = useCallback(() => controllerRef.current?.abort(), []);

  const clearChat = useCallback(async () => {
    controllerRef.current?.abort();
    dispatch({ type: 'clear' });
    saveMessages([], true);
    await clearAttachmentDir();
  }, []);

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    const next = { ...stateRef.current.settings, ...patch };
    dispatch({ type: 'settings', settings: next });
    try {
      saveSettings(next);
    } catch (e) {
      logger.warn('Failed to save settings', e);
    }
  }, []);

  const setUserApiKey = useCallback(async (key: string | null) => {
    if (key) {
      await saveApiKey(key);
    } else {
      await clearApiKey();
    }
    const loaded = await loadApiKey();
    dispatch({ type: 'apiKey', apiKey: loaded });
    if (loaded.key) {
      refreshAvailableModels(loaded.key, true);
    }
  }, []);

  const api = useMemo<ChatApi>(
    () => ({
      ...state,
      send,
      stop,
      retry,
      clearChat,
      updateSettings,
      setUserApiKey,
    }),
    [state, send, stop, retry, clearChat, updateSettings, setUserApiKey],
  );

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useChat(): ChatApi {
  const ctx = useContext(Ctx);
  if (!ctx) {
    throw new Error('useChat must be used inside <ChatProvider>');
  }
  return ctx;
}
