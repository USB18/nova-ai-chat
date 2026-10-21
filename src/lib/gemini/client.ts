import { LIMITS } from '../../config/env';
import type {
  GenerateContentRequest,
  GenerateContentResponse,
  GeminiModelInfo,
  Part,
  UsageMetadata,
} from '../../types/gemini';
import { GeminiError } from './errors';
import { apiUrl, authHeaders, getJson, streamSSE } from './http';

export interface StreamHandlers {
  /** Visible answer text delta. */
  onText?: (delta: string) => void;
  /** Thought-summary delta (only when includeThoughts is on). */
  onThought?: (delta: string) => void;
}

export interface StreamResult {
  /** All model parts, merged and with thought signatures preserved verbatim. */
  parts: Part[];
  finishReason?: string;
  usage?: UsageMetadata;
  modelVersion?: string;
}

const BLOCKING_FINISH_REASONS = new Set([
  'SAFETY',
  'RECITATION',
  'BLOCKLIST',
  'PROHIBITED_CONTENT',
  'SPII',
  'IMAGE_SAFETY',
]);

/**
 * Merge a streamed part into the accumulated list. Consecutive text chunks are
 * concatenated so history stays compact; a signature on a later chunk is kept on
 * the merged part. Function-call parts are never merged.
 */
export function mergePart(parts: Part[], incoming: Part): void {
  const last = parts[parts.length - 1];
  const isText = typeof incoming.text === 'string' && !incoming.functionCall;
  if (
    isText &&
    last &&
    typeof last.text === 'string' &&
    !last.functionCall &&
    !last.thoughtSignature &&
    !!last.thought === !!incoming.thought
  ) {
    last.text += incoming.text;
    if (incoming.thoughtSignature) {
      last.thoughtSignature = incoming.thoughtSignature;
    }
    return;
  }
  // Signature-only chunk (empty text) attaches to the previous part when possible.
  if (
    isText &&
    incoming.text === '' &&
    incoming.thoughtSignature &&
    last &&
    !last.thoughtSignature &&
    !last.functionCall
  ) {
    last.thoughtSignature = incoming.thoughtSignature;
    return;
  }
  parts.push({ ...incoming });
}

export async function streamGenerateContent(
  apiKey: string,
  model: string,
  request: GenerateContentRequest,
  handlers: StreamHandlers,
  signal?: AbortSignal,
): Promise<StreamResult> {
  const result: StreamResult = { parts: [] };

  await streamSSE({
    url: apiUrl(
      `models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`,
    ),
    headers: { ...authHeaders(apiKey), 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
    signal,
    idleTimeoutMs: LIMITS.requestTimeoutMs,
    onEvent: data => {
      let chunk: GenerateContentResponse;
      try {
        chunk = JSON.parse(data);
      } catch {
        return; // ignore keep-alives / malformed fragments
      }
      if (chunk.error) {
        throw new GeminiError(
          chunk.error.message,
          chunk.error.code >= 500 ? 'server' : 'unknown',
          chunk.error.code,
        );
      }
      if (chunk.promptFeedback?.blockReason) {
        throw new GeminiError(
          `The request was blocked (${chunk.promptFeedback.blockReason}). Try rephrasing or removing the attachment.`,
          'blocked',
        );
      }
      const cand = chunk.candidates?.[0];
      for (const part of cand?.content?.parts ?? []) {
        if (typeof part.text === 'string' && part.text) {
          part.thought
            ? handlers.onThought?.(part.text)
            : handlers.onText?.(part.text);
        }
        mergePart(result.parts, part);
      }
      if (cand?.finishReason) {
        result.finishReason = cand.finishReason;
      }
      if (chunk.usageMetadata) {
        result.usage = chunk.usageMetadata;
      }
      if (chunk.modelVersion) {
        result.modelVersion = chunk.modelVersion;
      }
    },
  });

  if (result.finishReason && BLOCKING_FINISH_REASONS.has(result.finishReason)) {
    const hasOutput = result.parts.some(p => p.text || p.functionCall);
    if (!hasOutput) {
      throw new GeminiError(
        `The response was blocked (${result.finishReason}). Try rephrasing your message.`,
        'blocked',
      );
    }
  }
  return result;
}

/** Models visible to this key that support generateContent. */
export async function listModels(
  apiKey: string,
  signal?: AbortSignal,
): Promise<string[]> {
  const ids: string[] = [];
  let pageToken: string | undefined;
  for (let page = 0; page < 5; page++) {
    const q = `models?pageSize=200${
      pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''
    }`;
    const res = await getJson<{
      models?: GeminiModelInfo[];
      nextPageToken?: string;
    }>(apiUrl(q), apiKey, signal);
    for (const m of res.models ?? []) {
      if (m.supportedGenerationMethods?.includes('generateContent')) {
        ids.push(m.name.replace(/^models\//, ''));
      }
    }
    pageToken = res.nextPageToken;
    if (!pageToken) {
      break;
    }
  }
  return ids;
}
