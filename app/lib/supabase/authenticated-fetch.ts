import { getSupabaseAccessToken } from './client';

interface ErrorPayload {
  error?: string;
  requestId?: string;
}

function formatError(status: number, payload?: ErrorPayload) {
  let message = `Request failed (${status})`;

  if (payload?.error) {
    message = payload.error;
  }

  if (payload?.requestId) {
    message = `${message} [requestId: ${payload.requestId}]`;
  }

  return message;
}

export async function fetchWithSupabaseAuth(input: RequestInfo | URL, init?: RequestInit) {
  const token = await getSupabaseAccessToken();
  const headers = new Headers(init?.headers);

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  return fetch(input, {
    ...init,
    headers,
  });
}

export async function fetchJsonWithSupabaseAuth<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetchWithSupabaseAuth(input, init);

  if (response.ok) {
    return (await response.json()) as T;
  }

  let payload: ErrorPayload | undefined;

  try {
    payload = (await response.json()) as ErrorPayload;
  } catch {
    // noop
  }

  throw new Error(formatError(response.status, payload));
}
