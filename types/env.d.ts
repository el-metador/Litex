interface ImportMetaEnv {
  readonly VITE_DISABLE_PERSISTENCE?: string;
  readonly VITE_LOG_LEVEL?: string;
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

