import { authStore, setAnonymousAuth, setAuthenticatedAuth } from '~/lib/stores/auth';
import { getSupabaseClient } from './client';

interface AuthResponse {
  authenticated: boolean;
  userId: string;
  email: string | null;
  plan: string;
}

let initialized = false;

async function syncAuthState(accessToken?: string) {
  const headers = new Headers();

  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  const response = await fetch('/api/auth', { headers });

  if (!response.ok) {
    setAnonymousAuth();
    return;
  }

  const payload = (await response.json()) as AuthResponse;

  if (!payload.authenticated) {
    setAnonymousAuth();
    return;
  }

  setAuthenticatedAuth({
    userId: payload.userId,
    email: payload.email,
    plan: payload.plan,
  });
}

export async function initSupabaseAuthSync() {
  if (initialized || import.meta.env.SSR) {
    return;
  }

  initialized = true;

  const supabase = getSupabaseClient();

  if (!supabase) {
    setAnonymousAuth();
    return;
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  await syncAuthState(session?.access_token);

  supabase.auth.onAuthStateChange((_event, nextSession) => {
    void syncAuthState(nextSession?.access_token);
  });
}

export function authIsReady() {
  return authStore.get().status !== 'loading';
}

export async function signInWithGoogle() {
  const supabase = getSupabaseClient();

  if (!supabase) {
    throw new Error('Google auth недоступен: проверьте Supabase env переменные.');
  }

  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin,
    },
  });

  if (error) {
    throw new Error(error.message);
  }
}
