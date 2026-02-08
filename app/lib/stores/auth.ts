import { map } from 'nanostores';

export interface AuthState {
  status: 'loading' | 'authenticated' | 'anonymous';
  userId?: string;
  email?: string | null;
  plan?: string;
}

export const authStore = map<AuthState>({
  status: 'loading',
});

export function setAnonymousAuth() {
  authStore.set({
    status: 'anonymous',
  });
}

export function setAuthenticatedAuth(payload: { userId: string; email?: string | null; plan?: string }) {
  authStore.set({
    status: 'authenticated',
    userId: payload.userId,
    email: payload.email ?? null,
    plan: payload.plan,
  });
}
