import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let browserClient: SupabaseClient | null = null;

function readPublicEnv(): { url: string; key: string } {
  const metaEnv = (import.meta as unknown as { env?: Record<string, string | undefined> }).env || {};
  return {
    url: (metaEnv.VITE_SUPABASE_URL || '').trim(),
    key: (metaEnv.VITE_SUPABASE_PUBLISHABLE_KEY || '').trim(),
  };
}

export function getSupabaseBrowserClient(): SupabaseClient | null {
  if (browserClient) return browserClient;
  const { url, key } = readPublicEnv();
  if (!url || !key) return null;

  browserClient = createClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  });
  return browserClient;
}
