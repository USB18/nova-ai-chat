export type GeminiErrorKind =
  | 'auth' // 401/403 or invalid key
  | 'not_found' // model unavailable
  | 'rate_limit' // 429
  | 'server' // 5xx
  | 'bad_request' // 400
  | 'blocked' // safety / prompt blocked
  | 'network'
  | 'timeout'
  | 'aborted'
  | 'unknown';

export class GeminiError extends Error {
  constructor(
    message: string,
    readonly kind: GeminiErrorKind,
    readonly status?: number,
    readonly retryAfterMs?: number,
  ) {
    super(message);
    this.name = 'GeminiError';
  }

  /** Worth trying the same request on the next model in the chain. */
  get canFallback(): boolean {
    return (
      this.kind === 'not_found' ||
      this.kind === 'rate_limit' ||
      this.kind === 'server'
    );
  }

  /** Worth retrying the same model after a short delay. */
  get isTransient(): boolean {
    return (
      this.kind === 'rate_limit' ||
      this.kind === 'server' ||
      this.kind === 'network'
    );
  }

  /** Short message suitable for the UI. */
  get userMessage(): string {
    switch (this.kind) {
      case 'auth':
        return 'Your Gemini API key is missing or invalid. Add one in Settings.';
      case 'rate_limit':
        return 'Rate limit reached. Please wait a moment and try again.';
      case 'server':
        return 'The model service is temporarily unavailable. Try again shortly.';
      case 'network':
        return 'Network error. Check your connection and try again.';
      case 'timeout':
        return 'The request timed out. Try again.';
      case 'blocked':
        return this.message;
      case 'not_found':
        return 'No available model could handle this request.';
      case 'aborted':
        return 'Stopped.';
      default:
        return this.message || 'Something went wrong.';
    }
  }
}

export function errorFromHttp(
  status: number,
  bodyText: string,
  retryAfterHeader?: string | null,
): GeminiError {
  let message = `HTTP ${status}`;
  try {
    const parsed = JSON.parse(bodyText);
    const err = Array.isArray(parsed) ? parsed[0]?.error : parsed?.error;
    if (err?.message) {
      message = err.message;
    }
  } catch {
    if (bodyText) {
      message = bodyText.slice(0, 300);
    }
  }
  const retryAfterMs = retryAfterHeader
    ? Number(retryAfterHeader) * 1000 || undefined
    : undefined;

  if (status === 401 || status === 403 || /API key/i.test(message)) {
    return new GeminiError(message, 'auth', status);
  }
  if (status === 404) {
    return new GeminiError(message, 'not_found', status);
  }
  if (status === 429) {
    return new GeminiError(message, 'rate_limit', status, retryAfterMs);
  }
  if (status >= 500) {
    return new GeminiError(message, 'server', status, retryAfterMs);
  }
  if (status === 400) {
    return new GeminiError(message, 'bad_request', status);
  }
  return new GeminiError(message, 'unknown', status);
}

export function toGeminiError(e: unknown): GeminiError {
  if (e instanceof GeminiError) {
    return e;
  }
  const message = e instanceof Error ? e.message : String(e);
  return new GeminiError(message, 'unknown');
}
