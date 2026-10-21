import type { FunctionDeclaration } from '../../types/gemini';

export interface ToolContext {
  signal: AbortSignal;
}

export interface Tool<A = Record<string, unknown>> {
  declaration: FunctionDeclaration;
  /** Short label for the UI, e.g. "Checking the weather". */
  label: string;
  run: (args: A, ctx: ToolContext) => Promise<Record<string, unknown>>;
}

export class ToolInputError extends Error {}

export function requireString(
  args: Record<string, unknown>,
  key: string,
  max = 500,
): string {
  const v = args[key];
  if (typeof v !== 'string' || !v.trim()) {
    throw new ToolInputError(`"${key}" must be a non-empty string`);
  }
  return v.trim().slice(0, max);
}

export function optionalString(
  args: Record<string, unknown>,
  key: string,
): string | undefined {
  const v = args[key];
  return typeof v === 'string' && v.trim() ? v.trim() : undefined;
}

/** fetch JSON with the tool's abort signal; throws on non-2xx. */
export async function fetchJson<T>(
  url: string,
  signal: AbortSignal,
): Promise<T> {
  const res = await fetch(url, {
    signal,
    headers: { Accept: 'application/json', 'User-Agent': 'NovaChat/1.0' },
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}
