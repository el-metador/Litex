import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let supabaseClient: SupabaseClient | undefined;

export function getSupabaseClient() {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return null;
  }

  if (!supabaseClient) {
    supabaseClient = createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
      global: {
        headers: {
          'x-litecode-client': 'web',
        },
      },
    });
  }

  return supabaseClient;
}

export async function getSupabaseAccessToken() {
  const supabase = getSupabaseClient();

  if (!supabase) {
    return undefined;
  }

  const { data } = await supabase.auth.getSession();

  return data.session?.access_token;
}

