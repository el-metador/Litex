import { env } from 'node:process';
import { DEFAULT_LLM_MODEL, resolveLlmModelId } from '~/lib/llm/models';

function readNumber(name: string, fallback: number) {
  const raw = env[name];

  if (!raw) {
    return fallback;
  }

  const parsed = Number(raw);

  return Number.isFinite(parsed) ? parsed : fallback;
}

export const serverEnv = {
  GEMINI_API_KEY: env.GEMINI_API_KEY ?? '',
  GEMINI_MODEL: env.GEMINI_MODEL ?? 'gemini-2.0-flash-lite',
  OPENROUTER_API_KEY: env.OPENROUTER_API_KEY ?? '',
  OPENROUTER_BASE_URL: env.OPENROUTER_BASE_URL ?? 'https://openrouter.ai/api/v1',
  OPENROUTER_MODEL_FREE_1: env.OPENROUTER_MODEL_FREE_1 ?? 'google/gemma-3-27b-it:free',
  OPENROUTER_MODEL_FREE_2: env.OPENROUTER_MODEL_FREE_2 ?? 'qwen/qwen3-32b:free',
  OPENROUTER_APP_URL: env.OPENROUTER_APP_URL ?? '',
  OPENROUTER_APP_NAME: env.OPENROUTER_APP_NAME ?? 'LiteCode',
  LITECODE_DEFAULT_MODEL: resolveLlmModelId(env.LITECODE_DEFAULT_MODEL ?? DEFAULT_LLM_MODEL),
  SUPABASE_URL: env.SUPABASE_URL ?? '',
  SUPABASE_ANON_KEY: env.SUPABASE_ANON_KEY ?? '',
  SUPABASE_SERVICE_ROLE_KEY: env.SUPABASE_SERVICE_ROLE_KEY ?? '',
  LITECODE_STORAGE_BUCKET: env.LITECODE_STORAGE_BUCKET ?? 'litecode-artifacts',
  LITECODE_DEFAULT_PLAN: env.LITECODE_DEFAULT_PLAN ?? 'free',
  LITECODE_FREE_DAILY_CHAT_LIMIT: readNumber('LITECODE_FREE_DAILY_CHAT_LIMIT', 100),
  LITECODE_FREE_DAILY_ENHANCER_LIMIT: readNumber('LITECODE_FREE_DAILY_ENHANCER_LIMIT', 60),
  LITECODE_PRO_DAILY_CHAT_LIMIT: readNumber('LITECODE_PRO_DAILY_CHAT_LIMIT', 800),
  LITECODE_PRO_DAILY_ENHANCER_LIMIT: readNumber('LITECODE_PRO_DAILY_ENHANCER_LIMIT', 300),
};

export function hasSupabaseAnonConfig() {
  return Boolean(serverEnv.SUPABASE_URL && serverEnv.SUPABASE_ANON_KEY);
}

export function hasSupabaseServiceConfig() {
  return Boolean(serverEnv.SUPABASE_URL && serverEnv.SUPABASE_SERVICE_ROLE_KEY);
}

export function hasSupabaseConfig() {
  return hasSupabaseAnonConfig() && hasSupabaseServiceConfig();
}
