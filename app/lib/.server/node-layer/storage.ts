import type { Actor } from './auth';
import { serverEnv } from './env';
import { getServiceSupabaseClient } from './supabase';
import { withTimeout } from './timeout';

interface SaveObjectInput {
  actor: Actor;
  path: string;
  content: string;
  contentType?: string;
}

export async function saveToStorage({ actor, path, content, contentType = 'application/json' }: SaveObjectInput) {
  if (actor.isAnonymous) {
    return null;
  }

  const supabase = getServiceSupabaseClient();

  if (!supabase) {
    return null;
  }

  const normalizedPath = `${actor.userId}/${path.replace(/^\/+/, '')}`;

  const { data, error } = await withTimeout(
    supabase.storage
      .from(serverEnv.LITECODE_STORAGE_BUCKET)
      .upload(normalizedPath, Buffer.from(content), { contentType, upsert: true }),
    5000,
    'Supabase storage timeout',
  );

  if (error) {
    throw error;
  }

  return data.path;
}
