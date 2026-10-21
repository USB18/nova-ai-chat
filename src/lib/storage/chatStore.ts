import {
  type ChatMessage,
  DEFAULT_SETTINGS,
  type Settings,
} from '../../types/chat';
import { logger } from '../utils/logger';
import { readJson, writeJson } from './mmkv';

const MESSAGES_KEY = 'nova.messages.v1';
const SETTINGS_KEY = 'nova.settings.v1';
const MAX_STORED = 200;

export function loadMessages(): ChatMessage[] {
  const parsed = readJson<ChatMessage[]>(MESSAGES_KEY);
  if (!Array.isArray(parsed)) {
    return [];
  }
  // A turn interrupted by an app kill is restored as stopped, never "streaming".
  return parsed.map(m =>
    m.role === 'assistant' &&
    (m.status === 'streaming' || m.status === 'pending')
      ? {
          ...m,
          status: 'stopped',
          toolCalls: m.toolCalls.map(t =>
            t.status === 'running'
              ? { ...t, status: 'error', error: 'Interrupted' }
              : t,
          ),
        }
      : m,
  );
}

let pending: ReturnType<typeof setTimeout> | undefined;

/** Debounced write so streaming updates don't serialize the chat on every token. */
export function saveMessages(messages: ChatMessage[], immediate = false): void {
  if (pending) {
    clearTimeout(pending);
  }
  const write = () => {
    pending = undefined;
    try {
      writeJson(MESSAGES_KEY, messages.slice(-MAX_STORED));
    } catch (e) {
      logger.warn('Failed to save messages', e);
    }
  };
  if (immediate) {
    write();
  } else {
    pending = setTimeout(write, 600);
  }
}

export function loadSettings(): Settings {
  const stored = readJson<Partial<Settings>>(SETTINGS_KEY);
  return stored ? { ...DEFAULT_SETTINGS, ...stored } : DEFAULT_SETTINGS;
}

export function saveSettings(settings: Settings): void {
  writeJson(SETTINGS_KEY, settings);
}
