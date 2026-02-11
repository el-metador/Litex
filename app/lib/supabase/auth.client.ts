import type { SupabaseClient } from '@supabase/supabase-js';
import { authStore, setAnonymousAuth, setAuthenticatedAuth } from '~/lib/stores/auth';
import { getSupabaseClient } from './client';

interface AuthResponse {
  authenticated: boolean;
  userId: string;
  email: string | null;
  plan: string;
}

interface OAuthHashSession {
  accessToken: string;
  refreshToken: string;
}

let initialized = false;

function parseOAuthHashSession(hash: string): OAuthHashSession | null {
  if (!hash || hash.length <= 1) {
    return null;
  }

  const params = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash);
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');

  if (!accessToken || !refreshToken) {
    return null;
  }

  return { accessToken, refreshToken };
}

function clearOAuthHashFromUrl() {
  if (typeof window === 'undefined') {
    return;
  }

  const nextUrl = `${window.location.pathname}${window.location.search}`;
  window.history.replaceState(window.history.state, '', nextUrl);
}

async function hydrateSessionFromOAuthHash(supabase: SupabaseClient) {
  if (typeof window === 'undefined') {
    return;
  }

  const session = parseOAuthHashSession(window.location.hash);

  if (!session) {
    return;
  }

  try {
    await supabase.auth.setSession({
      access_token: session.accessToken,
      refresh_token: session.refreshToken,
    });
  } finally {
    clearOAuthHashFromUrl();
  }
}

async function syncAuthState(accessToken?: string) {
  try {
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
  } catch {
    setAnonymousAuth();
  }
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

  try {
    await hydrateSessionFromOAuthHash(supabase);

    const {
      data: { session },
    } = await supabase.auth.getSession();

    await syncAuthState(session?.access_token);

    supabase.auth.onAuthStateChange((_event, nextSession) => {
      void syncAuthState(nextSession?.access_token);
    });
  } catch {
    setAnonymousAuth();
  }
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
