export type LlmProvider = 'gemini' | 'openrouter';

export type LlmModelId =
  | 'gemini-cheap'
  | 'openrouter-free-1'
  | 'openrouter-free-2';

export interface LlmModelDefinition {
  id: LlmModelId;
  label: string;
  provider: LlmProvider;
}

export const LLM_MODELS: LlmModelDefinition[] = [
  {
    id: 'gemini-cheap',
    label: 'Gemini Cheap',
    provider: 'gemini',
  },
  {
    id: 'openrouter-free-1',
    label: 'OpenRouter Free 1',
    provider: 'openrouter',
  },
  {
    id: 'openrouter-free-2',
    label: 'OpenRouter Free 2',
    provider: 'openrouter',
  },
];

export const DEFAULT_LLM_MODEL: LlmModelId = 'openrouter-free-1';

export function isLlmModelId(value: string): value is LlmModelId {
  return LLM_MODELS.some((model) => model.id === value);
}

export function resolveLlmModelId(value: string | null | undefined): LlmModelId {
  if (!value) {
    return DEFAULT_LLM_MODEL;
  }

  return isLlmModelId(value) ? value : DEFAULT_LLM_MODEL;
}

export function getLlmModelDefinition(modelId: LlmModelId) {
  return LLM_MODELS.find((model) => model.id === modelId);
}
