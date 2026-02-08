import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { getGeminiApiKey, getOpenRouterApiKey } from '~/lib/.server/llm/api-key';
import { serverEnv } from '~/lib/.server/node-layer/env';
import { getLlmModelDefinition, type LlmModelId } from '~/lib/llm/models';

function resolveProviderModelId(modelId: LlmModelId) {
  switch (modelId) {
    case 'gemini-cheap':
      return serverEnv.GEMINI_MODEL;
    case 'openrouter-free-1':
      return serverEnv.OPENROUTER_MODEL_FREE_1;
    case 'openrouter-free-2':
      return serverEnv.OPENROUTER_MODEL_FREE_2;
  }
}

function getOpenRouterHeaders() {
  const headers: Record<string, string> = {};

  if (serverEnv.OPENROUTER_APP_URL) {
    headers['HTTP-Referer'] = serverEnv.OPENROUTER_APP_URL;
  }

  if (serverEnv.OPENROUTER_APP_NAME) {
    headers['X-Title'] = serverEnv.OPENROUTER_APP_NAME;
  }

  return Object.keys(headers).length > 0 ? headers : undefined;
}

export function getModel(modelId: LlmModelId) {
  const fallbackModel = getLlmModelDefinition(serverEnv.LITECODE_DEFAULT_MODEL);
  const model = getLlmModelDefinition(modelId) ?? fallbackModel;

  if (!model) {
    throw new Error('No LLM model configuration available');
  }

  const providerModelId = resolveProviderModelId(model.id);

  if (model.provider === 'gemini') {
    const gemini = createGoogleGenerativeAI({
      apiKey: getGeminiApiKey(),
    });

    return gemini(providerModelId);
  }

  const openRouter = createOpenAI({
    apiKey: getOpenRouterApiKey(),
    baseURL: serverEnv.OPENROUTER_BASE_URL,
    headers: getOpenRouterHeaders(),
  });

  return openRouter(providerModelId);
}
