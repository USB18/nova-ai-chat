import { LIMITS } from '../../config/env';
import type { FunctionDeclaration } from '../../types/gemini';
import { BUILTIN_TOOLS } from './builtins';
import { type Tool, ToolInputError } from './types';

const registry = new Map<string, Tool>(
  BUILTIN_TOOLS.map(t => [t.declaration.name, t]),
);

export function registerTool(tool: Tool): void {
  registry.set(tool.declaration.name, tool);
}

export function toolDeclarations(): FunctionDeclaration[] {
  return [...registry.values()].map(t => t.declaration);
}

export function toolLabel(name: string): string {
  return registry.get(name)?.label ?? name;
}

export type ToolOutcome =
  | { ok: true; result: Record<string, unknown> }
  | { ok: false; error: string };

/**
 * Run a tool with a timeout and cancellation. Never throws: failures are returned
 * as `{ ok: false }` so they can be reported back to the model as a function response.
 */
export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  parentSignal: AbortSignal,
): Promise<ToolOutcome> {
  const tool = registry.get(name);
  if (!tool) {
    return { ok: false, error: `Unknown tool "${name}"` };
  }
  const controller = new AbortController();
  const onParentAbort = () => controller.abort();
  parentSignal.addEventListener('abort', onParentAbort);
  const timer = setTimeout(() => controller.abort(), LIMITS.toolTimeoutMs);
  try {
    const result = await tool.run(args ?? {}, { signal: controller.signal });
    return { ok: true, result: truncate(result) };
  } catch (e) {
    if (parentSignal.aborted) {
      return { ok: false, error: 'Cancelled by user' };
    }
    if (controller.signal.aborted) {
      return {
        ok: false,
        error: `Timed out after ${LIMITS.toolTimeoutMs / 1000}s`,
      };
    }
    const msg =
      e instanceof ToolInputError
        ? e.message
        : `Tool failed: ${(e as Error)?.message ?? String(e)}`;
    return { ok: false, error: msg };
  } finally {
    clearTimeout(timer);
    parentSignal.removeEventListener('abort', onParentAbort);
  }
}

function truncate(result: Record<string, unknown>): Record<string, unknown> {
  const json = JSON.stringify(result);
  if (json.length <= LIMITS.toolResultMaxChars) {
    return result;
  }
  return {
    truncated: true,
    partial_json: json.slice(0, LIMITS.toolResultMaxChars),
  };
}
