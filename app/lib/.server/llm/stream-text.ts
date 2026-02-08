import { generateText as _generateText, streamText as _streamText, convertToCoreMessages, type Message } from 'ai';
import { getModel } from '~/lib/.server/llm/model';
import { serverEnv } from '~/lib/.server/node-layer/env';
import { getLlmModelDefinition, LLM_MODELS, type LlmModelId } from '~/lib/llm/models';
import { MAX_TOKENS } from './constants';
import { getSystemPrompt } from './prompts';

export type Messages = Array<Omit<Message, 'id'>>;

export type StreamingOptions = Omit<Parameters<typeof _streamText>[0], 'model' | 'messages'>;
export type GenerationOptions = Omit<Parameters<typeof _generateText>[0], 'model' | 'messages'>;

const FALLBACK_MODEL_PRIORITY: LlmModelId[] = ['openrouter-free-1', 'openrouter-free-2', 'gemini-cheap'];

function getProviderOptions(_modelId: LlmModelId) {
  return undefined;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function isFallbackEligibleError(message: string) {
  const normalized = message.toLowerCase();

  return (
    normalized.includes('quota exceeded') ||
    normalized.includes('exceeded your current quota') ||
    normalized.includes('rate limit') ||
    normalized.includes('too many requests') ||
    normalized.includes('retry in') ||
    normalized.includes('provider returned error') ||
    normalized.includes('failed to process successful response') ||
    normalized.includes('temporarily unavailable') ||
    normalized.includes('overloaded') ||
    normalized.includes('service unavailable')
  );
}

function resolveModelCandidates(modelId: LlmModelId) {
  const ordered = [modelId, serverEnv.LITECODE_DEFAULT_MODEL, ...FALLBACK_MODEL_PRIORITY, ...LLM_MODELS.map((model) => model.id)];
  const seen = new Set<LlmModelId>();
  const result: LlmModelId[] = [];

  for (const candidate of ordered) {
    if (seen.has(candidate)) {
      continue;
    }

    seen.add(candidate);
    result.push(candidate);
  }

  return result;
}

function createBaseArgs(messages: Messages, modelId: LlmModelId) {
  return {
    model: getModel(modelId),
    system: getSystemPrompt(),
    maxTokens: MAX_TOKENS,
    maxRetries: 0,
    messages: convertToCoreMessages(messages),
    providerOptions: getProviderOptions(modelId),
  };
}

export function streamText(messages: Messages, options?: StreamingOptions, modelId: LlmModelId = serverEnv.LITECODE_DEFAULT_MODEL) {
  return _streamText({
    ...createBaseArgs(messages, modelId),
    ...options,
  });
}

export function generateText(
  messages: Messages,
  options?: GenerationOptions,
  modelId: LlmModelId = serverEnv.LITECODE_DEFAULT_MODEL,
) {
  const modelCandidates = resolveModelCandidates(modelId);
  const requestedModel = getLlmModelDefinition(modelId)?.id ?? modelId;

  async function run() {
    let lastError: unknown;

    for (let index = 0; index < modelCandidates.length; index++) {
      const candidateModel = modelCandidates[index];

      try {
        return await _generateText({
          ...createBaseArgs(messages, candidateModel),
          ...options,
        });
      } catch (error) {
        lastError = error;
        const message = getErrorMessage(error);
        const isLastCandidate = index + 1 >= modelCandidates.length;
        const shouldFallback = isFallbackEligibleError(message) && !isLastCandidate;

        console.warn('LLM generation failed', {
          requestedModel,
          candidateModel,
          attempt: index + 1,
          candidateCount: modelCandidates.length,
          shouldFallback,
          error: message,
        });

        if (!shouldFallback) {
          break;
        }
      }
    }

    throw lastError instanceof Error ? lastError : new Error(getErrorMessage(lastError));
  }

  return run();
}

export function shouldUseNonStreamingLlm(modelId: LlmModelId = serverEnv.LITECODE_DEFAULT_MODEL) {
  if (process.env.LITECODE_FORCE_NON_STREAM === '1') {
    return true;
  }

  if (process.env.LITECODE_FORCE_NON_STREAM === '0') {
    return false;
  }

  const provider = getLlmModelDefinition(modelId)?.provider;

  if (provider === 'gemini' || provider === 'openrouter') {
    return true;
  }

  return (
    typeof TransformStream !== 'function' ||
    typeof TextDecoderStream !== 'function'
  );
}
