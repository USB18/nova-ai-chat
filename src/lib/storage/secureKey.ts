import * as Keychain from 'react-native-keychain';
import { GEMINI_API_KEY } from '../../config/env';

const SERVICE = 'nova.gemini.apiKey';

/** User key from the Keychain/Keystore; falls back to the default key from `.env`. */
export async function loadApiKey(): Promise<{
  key: string;
  source: 'user' | 'demo' | 'none';
}> {
  try {
    const creds = await Keychain.getGenericPassword({ service: SERVICE });
    if (creds && creds.password) {
      return { key: creds.password, source: 'user' };
    }
  } catch {
    // Keychain unavailable (e.g. no device lock on some Android builds) → fall through
  }
  if (isPlausibleKey(GEMINI_API_KEY)) {
    return { key: GEMINI_API_KEY.trim(), source: 'demo' };
  }
  return { key: '', source: 'none' };
}

export async function saveApiKey(key: string): Promise<void> {
  await Keychain.setGenericPassword('gemini', key.trim(), {
    service: SERVICE,
    accessible: Keychain.ACCESSIBLE.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
  });
}

export async function clearApiKey(): Promise<void> {
  await Keychain.resetGenericPassword({ service: SERVICE });
}

/**
 * Cheap format check only — the API is the real validator. Google issues keys in
 * more than one format (classic "AIza…" and newer dotted ones like "AQ.…"), so
 * accept any long run of URL-safe characters including dots.
 */
export function isPlausibleKey(key: string | undefined): key is string {
  const k = key?.trim() ?? '';
  return /^[A-Za-z0-9._-]{30,}$/.test(k) && !k.startsWith('YOUR_');
}

export function maskKey(key: string): string {
  return key ? `${key.slice(0, 4)}••••${key.slice(-4)}` : '';
}
