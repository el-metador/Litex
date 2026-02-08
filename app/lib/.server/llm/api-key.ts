import { env } from 'node:process';
import { serverEnv } from '~/lib/.server/node-layer/env';

function normalizeApiKey(rawValue: string | undefined) {
  if (!rawValue) {
    return '';
  }

  const trimmed = rawValue.trim();
  const withoutBearer = trimmed.replace(/^bearer\s+/i, '');
  const withoutQuotes = withoutBearer.replace(/^(['"])(.*)\1$/, '$2').trim();

  return withoutQuotes;
}

export function getGeminiApiKey() {
  const apiKey = normalizeApiKey(env.GEMINI_API_KEY || serverEnv.GEMINI_API_KEY);

  if (!apiKey) {
    throw new Error('Missing GEMINI_API_KEY environment variable');
  }

  return apiKey;
}

export function getOpenRouterApiKey() {
  const apiKey = normalizeApiKey(env.OPENROUTER_API_KEY || serverEnv.OPENROUTER_API_KEY);

  if (!apiKey) {
    throw new Error('Missing OPENROUTER_API_KEY environment variable');
  }

  return apiKey;
}
