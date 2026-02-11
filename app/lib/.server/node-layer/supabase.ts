import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { hasSupabaseAnonConfig, hasSupabaseServiceConfig, serverEnv } from './env';

let anonClient: SupabaseClient | undefined;
let serviceClient: SupabaseClient | undefined;

function buildClient(apiKey: string) {
  return createClient(serverEnv.SUPABASE_URL, apiKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        'x-litecode-runtime': 'node-layer',
      },
    },
  });
}

export function getAnonSupabaseClient() {
  if (!hasSupabaseAnonConfig()) {
    return null;
  }

  if (!anonClient) {
    anonClient = buildClient(serverEnv.SUPABASE_ANON_KEY);
  }

  return anonClient;
}

export function getServiceSupabaseClient() {
  if (!hasSupabaseServiceConfig()) {
    return null;
  }

  if (!serviceClient) {
    serviceClient = buildClient(serverEnv.SUPABASE_SERVICE_ROLE_KEY);
  }

  return serviceClient;
}
