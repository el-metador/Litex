import { map } from 'nanostores';
import { DEFAULT_LLM_MODEL, resolveLlmModelId, type LlmModelId } from '~/lib/llm/models';

const kModel = 'litecode_model';

function initModel() {
  if (import.meta.env.SSR) {
    return DEFAULT_LLM_MODEL;
  }

  return resolveLlmModelId(localStorage.getItem(kModel));
}

export const chatStore = map({
  started: false,
  aborted: false,
  showChat: true,
  model: initModel(),
});

export function setChatModel(model: LlmModelId) {
  chatStore.setKey('model', model);

  if (!import.meta.env.SSR) {
    localStorage.setItem(kModel, model);
  }
}
