import type { User } from '@supabase/supabase-js';
import { serverEnv } from './env';
import { getAnonSupabaseClient } from './supabase';
import { withTimeout } from './timeout';

export type ActorPlan = 'free' | 'pro' | 'enterprise';

export interface Actor {
  userId: string;
  email?: string;
  plan: ActorPlan;
  isAnonymous: boolean;
}

const ANON_ACTOR_ID = 'anonymous';

function normalizePlan(plan: unknown): ActorPlan {
  if (plan === 'pro' || plan === 'enterprise') {
    return plan;
  }

  return 'free';
}

function getPlan(user: User): ActorPlan {
  return normalizePlan(
    user.user_metadata?.plan ?? user.app_metadata?.plan ?? user.user_metadata?.tier ?? serverEnv.LITECODE_DEFAULT_PLAN,
  );
}

function getBearerToken(authHeader: string | null) {
  if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
    return undefined;
  }

  const token = authHeader.slice(7).trim();

  return token.length > 0 ? token : undefined;
}

export function createAnonymousActor(): Actor {
  return {
    userId: ANON_ACTOR_ID,
    plan: 'free',
    isAnonymous: true,
  };
}

export async function resolveActor(request: Request): Promise<Actor> {
  const token = getBearerToken(request.headers.get('authorization'));
  const anon = createAnonymousActor();

  if (!token) {
    return anon;
  }

  const supabase = getAnonSupabaseClient();

  if (!supabase) {
    return anon;
  }

  let data: Awaited<ReturnType<typeof supabase.auth.getUser>>['data'] | undefined;
  let error: Awaited<ReturnType<typeof supabase.auth.getUser>>['error'] | undefined;

  try {
    ({ data, error } = await withTimeout(supabase.auth.getUser(token), 4000, 'Supabase auth timeout'));
  } catch {
    return anon;
  }

  if (error || !data.user) {
    return anon;
  }

  return {
    userId: data.user.id,
    email: data.user.email ?? undefined,
    plan: getPlan(data.user),
    isAnonymous: false,
  };
}
