import { LIMITS, SYSTEM_PROMPT, THINKING_LEVEL_MODELS } from '../../config/env';
import type { ToolCallRecord } from '../../types/chat';
import type {
  Content,
  GenerateContentRequest,
  Part,
  UsageMetadata,
} from '../../types/gemini';
import { streamGenerateContent } from '../gemini/client';
import { GeminiError, toGeminiError } from '../gemini/errors';
import { sleep } from '../gemini/http';
import { executeTool, toolDeclarations } from '../tools/registry';
import { uid } from '../utils/id';
import { logger } from '../utils/logger';

export interface AgentCallbacks {
  /** Full visible text of the answer so far (not a delta — safe across fallbacks). */
  onText: (fullText: string) => void;
  onModel: (model: string) => void;
  onToolStart: (call: ToolCallRecord) => void;
  onToolEnd: (call: ToolCallRecord) => void;
}

export interface AgentInput {
  apiKey: string;
  /** Prior conversation + the new user message, already converted. */
  contents: Content[];
  modelChain: string[];
  toolsEnabled: boolean;
  temperature: number;
  signal: AbortSignal;
  callbacks: AgentCallbacks;
}

export interface AgentResult {
  text: string;
  model: string;
  turnContents: Content[];
  usage: { promptTokens?: number; outputTokens?: number };
}

/** Thrown when a turn fails; carries whatever valid contents were produced. */
export class AgentError extends Error {
  constructor(readonly cause: GeminiError, readonly partial: AgentResult) {
    super(cause.message);
    this.name = 'AgentError';
  }
}

/**
 * Stream a model response, execute any function calls on-device, feed results back,
 * and repeat until the model answers in text (or the step limit is reached).
 *
 * - Thought signatures are preserved because model parts are stored verbatim.
 * - The model is pinned after the first successful step (signatures are model-bound).
 * - On 404/429/5xx before any output, the next model in the chain is tried.
 */
export async function runAgent(input: AgentInput): Promise<AgentResult> {
  const { apiKey, signal, callbacks } = input;
  const turnContents: Content[] = [];
  const usage: AgentResult['usage'] = {};
  let committedText = '';
  let pinnedModel: string | undefined;
  let liveText = ''; // text of the in-flight step, kept if the user stops mid-stream
  let livePrefix = '';

  const result = (): AgentResult => ({
    text: committedText,
    model: pinnedModel ?? input.modelChain[0],
    turnContents: sanitizeTurn(turnContents),
    usage,
  });

  try {
    for (let step = 0; step < LIMITS.maxAgentSteps; step++) {
      const isLastStep = step === LIMITS.maxAgentSteps - 1;
      const contents = [...input.contents, ...turnContents];
      const chain = pinnedModel ? [pinnedModel] : input.modelChain;
      const prefix = committedText ? `${committedText}\n\n` : '';
      livePrefix = prefix;

      const {
        model,
        parts,
        usage: u,
      } = await streamWithFallback({
        apiKey,
        chain,
        signal,
        buildRequest: (m, withThinking) =>
          buildRequest(m, contents, input, withThinking, isLastStep),
        onModel: callbacks.onModel,
        onAttemptText: text => {
          liveText = text;
          callbacks.onText(prefix + text);
        },
      });
      liveText = '';
      pinnedModel = model;
      accumulateUsage(usage, u);

      if (parts.length) {
        turnContents.push({ role: 'model', parts });
      }
      const stepText = parts
        .filter(p => p.text && !p.thought)
        .map(p => p.text)
        .join('');
      if (stepText) {
        committedText = prefix + stepText;
        callbacks.onText(committedText);
      }

      const calls = parts.filter(p => p.functionCall).map(p => p.functionCall!);
      if (!calls.length) {
        return result();
      }

      // Execute calls in parallel; results go back in the same order.
      const responses = await Promise.all(
        calls.map(async fc => {
          const record: ToolCallRecord = {
            id: fc.id ?? uid('tc_'),
            name: fc.name,
            args: fc.args ?? {},
            status: 'running',
            startedAt: Date.now(),
          };
          callbacks.onToolStart(record);
          const outcome = await executeTool(fc.name, record.args, signal);
          const done: ToolCallRecord = {
            ...record,
            status: outcome.ok ? 'success' : 'error',
            result: outcome.ok ? outcome.result : undefined,
            error: outcome.ok ? undefined : outcome.error,
            durationMs: Date.now() - record.startedAt,
          };
          callbacks.onToolEnd(done);
          const part: Part = {
            functionResponse: {
              ...(fc.id ? { id: fc.id } : {}),
              name: fc.name,
              response: outcome.ok
                ? { result: outcome.result }
                : { error: outcome.error },
            },
          };
          return part;
        }),
      );
      if (signal.aborted) {
        throw new GeminiError('Aborted', 'aborted');
      }
      turnContents.push({ role: 'user', parts: responses });
    }
    // Step limit reached (the final step disallows tools, so this is rare).
    return result();
  } catch (e) {
    if (liveText) {
      turnContents.push({ role: 'model', parts: [{ text: liveText }] });
      committedText = livePrefix + liveText;
    }
    throw new AgentError(toGeminiError(e), result());
  }
}

function buildRequest(
  model: string,
  contents: Content[],
  input: AgentInput,
  withThinking: boolean,
  isLastStep: boolean,
): GenerateContentRequest {
  const thinkingLevel = THINKING_LEVEL_MODELS[model];
  return {
    contents,
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
    ...(input.toolsEnabled
      ? {
          tools: [{ functionDeclarations: toolDeclarations() }],
          toolConfig: {
            functionCallingConfig: { mode: isLastStep ? 'NONE' : 'AUTO' },
          },
        }
      : {}),
    generationConfig: {
      temperature: input.temperature,
      maxOutputTokens: 8192,
      ...(withThinking && thinkingLevel
        ? { thinkingConfig: { thinkingLevel } }
        : {}),
    },
  };
}

async function streamWithFallback(opts: {
  apiKey: string;
  chain: string[];
  signal: AbortSignal;
  buildRequest: (
    model: string,
    withThinking: boolean,
  ) => GenerateContentRequest;
  onModel: (model: string) => void;
  onAttemptText: (text: string) => void;
}): Promise<{ model: string; parts: Part[]; usage?: UsageMetadata }> {
  let lastError: GeminiError | undefined;

  for (const model of opts.chain) {
    let withThinking = true;
    for (let attempt = 0; attempt < 3; attempt++) {
      let attemptText = '';
      opts.onModel(model);
      try {
        const res = await streamGenerateContent(
          opts.apiKey,
          model,
          opts.buildRequest(model, withThinking),
          {
            onText: d => {
              attemptText += d;
              opts.onAttemptText(attemptText);
            },
          },
          opts.signal,
        );
        return { model, parts: res.parts, usage: res.usage };
      } catch (e) {
        const err = toGeminiError(e);
        lastError = err;
        if (
          err.kind === 'aborted' ||
          err.kind === 'auth' ||
          err.kind === 'blocked'
        ) {
          throw err;
        }
        // Output already reached the user: don't silently restart elsewhere.
        if (attemptText) {
          throw err;
        }
        // Some models reject thinking settings — retry once without them.
        if (
          err.kind === 'bad_request' &&
          withThinking &&
          /think/i.test(err.message)
        ) {
          withThinking = false;
          continue;
        }
        if (err.isTransient && attempt === 0) {
          logger.debug(`Transient error on ${model}, retrying`, err.message);
          await sleep(Math.min(err.retryAfterMs ?? 1500, 5000), opts.signal);
          continue;
        }
        if (err.canFallback) {
          logger.debug(`Falling back from ${model}`, err.message);
          break; // next model
        }
        throw err;
      }
    }
  }
  throw lastError ?? new GeminiError('No model available', 'not_found');
}

function accumulateUsage(total: AgentResult['usage'], u?: UsageMetadata) {
  if (!u) {
    return;
  }
  // Prompt tokens of the last step reflect the full context; outputs add up.
  total.promptTokens = u.promptTokenCount ?? total.promptTokens;
  total.outputTokens =
    (total.outputTokens ?? 0) +
    (u.candidatesTokenCount ?? 0) +
    (u.thoughtsTokenCount ?? 0);
}

/**
 * Drop a trailing model step whose function calls never got responses (e.g. the
 * user pressed Stop mid-tool). Replaying it would make the next request invalid.
 */
export function sanitizeTurn(contents: Content[]): Content[] {
  const out = [...contents];
  const last = out[out.length - 1];
  if (last && last.role === 'model' && last.parts.some(p => p.functionCall)) {
    out.pop();
  }
  return out;
}
