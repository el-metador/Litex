import { createServerClient, type CookieOptions } from '@supabase/ssr';

function parseCookies(cookieHeader: string) {
  const cookieMap = new Map<string, string>();

  for (const chunk of cookieHeader.split(';')) {
    const separatorIndex = chunk.indexOf('=');

    if (separatorIndex <= 0) {
      continue;
    }

    const key = chunk.slice(0, separatorIndex).trim();
    const value = chunk.slice(separatorIndex + 1).trim();

    if (!key) {
      continue;
    }

    cookieMap.set(key, decodeURIComponent(value));
  }

  return cookieMap;
}

function serializeCookie(name: string, value: string, options: CookieOptions = {}) {
  const attributes = [`${name}=${encodeURIComponent(value)}`];

  if (options.maxAge !== undefined) {
    attributes.push(`Max-Age=${Math.floor(options.maxAge)}`);
  }

  if (options.domain) {
    attributes.push(`Domain=${options.domain}`);
  }

  if (options.path) {
    attributes.push(`Path=${options.path}`);
  } else {
    attributes.push('Path=/');
  }

  if (options.expires) {
    attributes.push(`Expires=${options.expires.toUTCString()}`);
  }

  if (options.httpOnly) {
    attributes.push('HttpOnly');
  }

  if (options.sameSite) {
    attributes.push(`SameSite=${options.sameSite}`);
  }

  if (options.secure) {
    attributes.push('Secure');
  }

  return attributes.join('; ');
}

export function createSupabaseServerClient(request: Request, responseHeaders = new Headers()) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY');
  }

  const requestCookies = parseCookies(request.headers.get('Cookie') ?? '');

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return Array.from(requestCookies.entries()).map(([name, value]) => ({ name, value }));
      },
      setAll(cookiesToSet: Array<{ name: string; value: string; options?: CookieOptions }>) {
        for (const cookie of cookiesToSet) {
          requestCookies.set(cookie.name, cookie.value);
          responseHeaders.append('Set-Cookie', serializeCookie(cookie.name, cookie.value, cookie.options));
        }
      },
    },
  });
}
