import { redirect } from '@remix-run/node';
import type { User } from '@supabase/supabase-js';
import { createSupabaseServerClient } from './supabase.server';

interface SessionUserPayload {
  user: User | null;
  headers: Headers;
}

export async function getSessionUser(request: Request): Promise<SessionUserPayload> {
  const headers = new Headers();
  const supabase = createSupabaseServerClient(request, headers);
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    return { user: null, headers };
  }

  return { user: data.user, headers };
}

export async function requireUser(request: Request): Promise<SessionUserPayload> {
  const payload = await getSessionUser(request);

  if (!payload.user) {
    throw redirect('/?auth=required', { headers: payload.headers });
  }

  return payload;
}
