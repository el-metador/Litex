import { useEffect } from 'react';
import { initSupabaseAuthSync } from '~/lib/supabase/auth.client';

export function AuthBootstrap() {
  useEffect(() => {
    initSupabaseAuthSync().catch(() => {
      // noop: auth store falls back to anonymous state
    });
  }, []);

  return null;
}
