import { MODEL_CHAINS, type ModelRole } from '../../config/env';
import type { Attachment, ModelMode } from '../../types/chat';
import { readJson, writeJson } from '../storage/mmkv';
import { logger } from '../utils/logger';
import { listModels } from './client';

const CACHE_KEY = 'nova.availableModels.v1';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

let available: Set<string> | null = null;

/**
 * Discover which models this key can use (cached 24h). If discovery fails the
 * static chains are used as-is and runtime fallback handles missing models.
 */
export async function refreshAvailableModels(
  apiKey: string,
  force = false,
): Promise<string[]> {
  try {
    if (!force) {
      const cached = readJson<{ at: number; key: string; ids: string[] }>(
        CACHE_KEY,
      );
      if (
        cached &&
        Date.now() - cached.at < CACHE_TTL_MS &&
        cached.key === fingerprint(apiKey)
      ) {
        available = new Set(cached.ids);
        return cached.ids;
      }
    }
    const ids = await listModels(apiKey);
    available = new Set(ids);
    writeJson(CACHE_KEY, { at: Date.now(), key: fingerprint(apiKey), ids });
    return ids;
  } catch (e) {
    logger.warn('Model discovery failed; using static chains', e);
    available = null;
    return [];
  }
}

/** Non-reversible tag so a cache from a different key isn't reused. */
function fingerprint(key: string): string {
  return `${key.length}:${key.slice(-4)}`;
}

export interface RouteInput {
  text: string;
  attachments: Attachment[];
  historyHasMedia: boolean;
  mode: ModelMode;
}

/** Decide which capability tier a turn needs. */
export function pickRole(input: RouteInput): ModelRole {
  if (input.attachments.length > 0 || input.historyHasMedia) {
    return 'multimodal';
  }
  // Long or reasoning-heavy prompts get the stronger model.
  const heavy =
    input.text.length > 600 ||
    /```|\b(analy[sz]e|prove|debug|refactor|step[- ]by[- ]step|compare)\b/i.test(
      input.text,
    );
  return heavy ? 'multimodal' : 'fast';
}

/** Ordered list of models to try for this turn. */
export function modelChain(
  role: ModelRole,
  mode: ModelMode = 'auto',
): string[] {
  const base = MODEL_CHAINS[role];
  const chain =
    mode !== 'auto' ? [mode, ...base.filter(m => m !== mode)] : [...base];
  if (!available || available.size === 0) {
    return chain;
  }
  const filtered = chain.filter(m => available!.has(m));
  // Never return an empty chain: keep the pinned/first model so the error is explicit.
  return filtered.length ? filtered : chain.slice(0, 1);
}

export function selectableModels(): string[] {
  const all = new Set<string>([
    ...MODEL_CHAINS.multimodal,
    ...MODEL_CHAINS.fast,
  ]);
  return [...all].filter(
    m => !available || available.size === 0 || available.has(m),
  );
}
