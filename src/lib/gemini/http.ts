import { Platform } from 'react-native';
import {
  APP_IDENTITY,
  GEMINI_API_VERSION,
  GEMINI_BASE_URL,
} from '../../config/env';
import { GeminiError, errorFromHttp } from './errors';
import { SSEParser } from './sse';

export function apiUrl(path: string): string {
  return `${GEMINI_BASE_URL}/${GEMINI_API_VERSION}/${path}`;
}

/** Auth + app-restriction headers. The key goes in a header, never the URL. */
export function authHeaders(apiKey: string): Record<string, string> {
  const headers: Record<string, string> = { 'x-goog-api-key': apiKey };
  if (Platform.OS === 'android' && APP_IDENTITY.androidCertSha1) {
    headers['X-Android-Package'] = APP_IDENTITY.androidPackage;
    headers['X-Android-Cert'] = APP_IDENTITY.androidCertSha1;
  } else if (Platform.OS === 'ios' && APP_IDENTITY.iosBundleId) {
    headers['X-Ios-Bundle-Identifier'] = APP_IDENTITY.iosBundleId;
  }
  return headers;
}

export interface StreamRequest {
  url: string;
  headers: Record<string, string>;
  body: string;
  signal?: AbortSignal;
  idleTimeoutMs: number;
  onEvent: (data: string) => void;
}

/**
 * POST and consume a Server-Sent-Events response.
 *
 * React Native's `fetch` has no streaming body, but its XMLHttpRequest delivers
 * incremental `responseText` through `onprogress`, so we parse SSE from that.
 * No native module or backend needed.
 */
export function streamSSE(req: StreamRequest): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const parser = new SSEParser(req.onEvent);
    let settled = false;
    let idleTimer: ReturnType<typeof setTimeout> | undefined;

    const finish = (err?: GeminiError) => {
      if (settled) {
        return;
      }
      settled = true;
      if (idleTimer) {
        clearTimeout(idleTimer);
      }
      req.signal?.removeEventListener('abort', onAbort);
      err ? reject(err) : resolve();
    };

    const armIdleTimer = () => {
      if (idleTimer) {
        clearTimeout(idleTimer);
      }
      idleTimer = setTimeout(() => {
        xhr.abort();
        finish(new GeminiError('Request timed out', 'timeout'));
      }, req.idleTimeoutMs);
    };

    const onAbort = () => {
      xhr.abort();
      finish(new GeminiError('Aborted', 'aborted'));
    };

    if (req.signal?.aborted) {
      finish(new GeminiError('Aborted', 'aborted'));
      return;
    }
    req.signal?.addEventListener('abort', onAbort);

    xhr.open('POST', req.url);
    xhr.responseType = 'text';
    Object.entries(req.headers).forEach(([k, v]) => xhr.setRequestHeader(k, v));

    xhr.onprogress = () => {
      armIdleTimer();
      if (xhr.status === 200) {
        try {
          parser.pushCumulative(xhr.responseText);
        } catch (e) {
          xhr.abort();
          finish(
            e instanceof GeminiError
              ? e
              : new GeminiError(String(e), 'unknown'),
          );
        }
      }
    };

    xhr.onload = () => {
      if (xhr.status === 200) {
        try {
          parser.pushCumulative(xhr.responseText);
          parser.end();
          finish();
        } catch (e) {
          finish(
            e instanceof GeminiError
              ? e
              : new GeminiError(String(e), 'unknown'),
          );
        }
      } else {
        finish(
          errorFromHttp(
            xhr.status,
            xhr.responseText,
            xhr.getResponseHeader('retry-after'),
          ),
        );
      }
    };

    xhr.onerror = () =>
      finish(new GeminiError('Network request failed', 'network'));
    xhr.ontimeout = () =>
      finish(new GeminiError('Request timed out', 'timeout'));

    armIdleTimer();
    xhr.send(req.body);
  });
}

export async function getJson<T>(
  url: string,
  apiKey: string,
  signal?: AbortSignal,
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { headers: authHeaders(apiKey), signal });
  } catch (e) {
    if (signal?.aborted) {
      throw new GeminiError('Aborted', 'aborted');
    }
    throw new GeminiError(
      e instanceof Error ? e.message : 'Network error',
      'network',
    );
  }
  const text = await res.text();
  if (!res.ok) {
    throw errorFromHttp(res.status, text, res.headers.get('retry-after'));
  }
  return JSON.parse(text) as T;
}

export const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(t);
      reject(new GeminiError('Aborted', 'aborted'));
    });
  });
