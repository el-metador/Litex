import type { Actor } from './auth';
import { getServiceSupabaseClient } from './supabase';
import { withTimeout } from './timeout';
import type { UsageFeature } from './usage';

interface EnqueueInput {
  actor: Actor;
  feature: UsageFeature;
  model: string;
  payload: Record<string, unknown>;
}

export async function enqueueLlmJob(input: EnqueueInput) {
  if (input.actor.isAnonymous) {
    return null;
  }

  const supabase = getServiceSupabaseClient();

  if (!supabase) {
    return null;
  }

  try {
    const { data } = await withTimeout(
      supabase
        .from('llm_jobs')
        .insert({
          user_id: input.actor.userId,
          feature: input.feature,
          model: input.model,
          payload: input.payload,
          status: 'queued',
          created_at: new Date().toISOString(),
        })
        .select('id')
        .maybeSingle(),
      3000,
      'Supabase enqueue timeout',
    );

    return data?.id ?? null;
  } catch {
    return null;
  }
}

export async function completeLlmJob(jobId: string | null, metadata: Record<string, unknown> = {}) {
  if (!jobId) {
    return;
  }

  const supabase = getServiceSupabaseClient();

  if (!supabase) {
    return;
  }

  try {
    await withTimeout(
      supabase
        .from('llm_jobs')
        .update({
          status: 'completed',
          metadata,
          completed_at: new Date().toISOString(),
        })
        .eq('id', jobId),
      3000,
      'Supabase complete job timeout',
    );
  } catch {
    // noop
  }
}

export async function failLlmJob(jobId: string | null, errorMessage: string) {
  if (!jobId) {
    return;
  }

  const supabase = getServiceSupabaseClient();

  if (!supabase) {
    return;
  }

  try {
    await withTimeout(
      supabase
        .from('llm_jobs')
        .update({
          status: 'failed',
          error_message: errorMessage,
          completed_at: new Date().toISOString(),
        })
        .eq('id', jobId),
      3000,
      'Supabase fail job timeout',
    );
  } catch {
    // noop
  }
}
