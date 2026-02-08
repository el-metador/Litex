import type { Actor } from './auth';
import { serverEnv } from './env';
import { getServiceSupabaseClient } from './supabase';
import { withTimeout } from './timeout';

export type UsageFeature = 'chat' | 'enhancer';

export interface UsageLimitState {
  allowed: boolean;
  used: number;
  limit: number;
  remaining: number;
  resetAt: string;
  source: 'supabase' | 'memory';
}

interface UsageEventPayload {
  actor: Actor;
  feature: UsageFeature;
  requestId: string;
  tokens: number;
  model: string;
}

const memoryUsage = new Map<string, number>();

function getUtcDayResetIso() {
  const now = new Date();
  const resetAt = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));

  return resetAt.toISOString();
}

function getUtcDayStartIso() {
  const now = new Date();
  const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  return dayStart.toISOString();
}

function toLimitValue(feature: UsageFeature, actor: Actor) {
  if (actor.plan === 'enterprise') {
    return Number.MAX_SAFE_INTEGER;
  }

  if (actor.plan === 'pro') {
    return feature === 'chat' ? serverEnv.LITECODE_PRO_DAILY_CHAT_LIMIT : serverEnv.LITECODE_PRO_DAILY_ENHANCER_LIMIT;
  }

  return feature === 'chat' ? serverEnv.LITECODE_FREE_DAILY_CHAT_LIMIT : serverEnv.LITECODE_FREE_DAILY_ENHANCER_LIMIT;
}

function memoryKey(actor: Actor, feature: UsageFeature) {
  return `${new Date().toISOString().slice(0, 10)}:${actor.userId}:${feature}`;
}

function checkMemoryUsage(actor: Actor, feature: UsageFeature): UsageLimitState {
  const key = memoryKey(actor, feature);
  const used = memoryUsage.get(key) ?? 0;
  const limit = toLimitValue(feature, actor);
  const remaining = Math.max(limit - used, 0);

  return {
    allowed: used < limit,
    used,
    limit,
    remaining,
    resetAt: getUtcDayResetIso(),
    source: 'memory',
  };
}

function incrementMemoryUsage(actor: Actor, feature: UsageFeature) {
  const key = memoryKey(actor, feature);
  const current = memoryUsage.get(key) ?? 0;
  memoryUsage.set(key, current + 1);
}

export async function checkUsageLimit(actor: Actor, feature: UsageFeature): Promise<UsageLimitState> {
  const supabase = getServiceSupabaseClient();

  if (!supabase || actor.isAnonymous) {
    return checkMemoryUsage(actor, feature);
  }

  try {
    const { data: customLimitRow } = await withTimeout(
      supabase.from('usage_limits').select('daily_limit').eq('user_id', actor.userId).eq('feature', feature).maybeSingle(),
      4000,
      'Supabase usage limit timeout',
    );

    const defaultLimit = toLimitValue(feature, actor);
    const limit = customLimitRow?.daily_limit ?? defaultLimit;

    const { count } = await withTimeout(
      supabase
        .from('usage_events')
        .select('*', { head: true, count: 'exact' })
        .eq('user_id', actor.userId)
        .eq('feature', feature)
        .gte('created_at', getUtcDayStartIso()),
      4000,
      'Supabase usage events timeout',
    );

    const used = count ?? 0;
    const remaining = Math.max(limit - used, 0);

    return {
      allowed: used < limit,
      used,
      limit,
      remaining,
      resetAt: getUtcDayResetIso(),
      source: 'supabase',
    };
  } catch {
    return checkMemoryUsage(actor, feature);
  }
}

export async function recordUsageEvent({ actor, feature, requestId, tokens, model }: UsageEventPayload) {
  const supabase = getServiceSupabaseClient();

  if (!supabase || actor.isAnonymous) {
    incrementMemoryUsage(actor, feature);
    return;
  }

  try {
    await withTimeout(
      supabase.from('usage_events').insert({
        user_id: actor.userId,
        feature,
        request_id: requestId,
        tokens,
        model,
        created_at: new Date().toISOString(),
      }),
      3000,
      'Supabase usage insert timeout',
    );
  } catch {
    incrementMemoryUsage(actor, feature);
  }
}
