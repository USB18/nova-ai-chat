import { createMMKV } from 'react-native-mmkv';
import { logger } from '../utils/logger';

/**
 * App-wide key-value store (MMKV: synchronous, native, fast).
 * Secrets do NOT belong here — the API key lives in the Keychain/Keystore (secureKey.ts).
 */
export const storage = createMMKV({ id: 'nova' });

export function readJson<T>(key: string): T | undefined {
  const raw = storage.getString(key);
  if (raw === undefined) {
    return undefined;
  }
  try {
    return JSON.parse(raw) as T;
  } catch (e) {
    logger.warn(`Corrupt value for "${key}", ignoring`, e);
    return undefined;
  }
}

export function writeJson(key: string, value: unknown): void {
  storage.set(key, JSON.stringify(value));
}
