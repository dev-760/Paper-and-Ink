import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { assertSupabaseConfigured, serverConfig } from '../../config.ts';

let adminClient: SupabaseClient | null = null;

/**
 * Trusted server-only Supabase admin client authenticated with SUPABASE_SECRET_KEY.
 * Never expose this client or key to browser bundles.
 */
export function getSupabaseAdmin(): SupabaseClient {
  assertSupabaseConfigured();
  if (!adminClient) {
    adminClient = createClient(serverConfig.supabaseUrl, serverConfig.supabaseSecretKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }
  return adminClient;
}

/**
 * Ephemeral stateless client using the publishable key for executing password sign-in
 * without mutating any shared client session state.
 */
export function createStatelessPublicClient(): SupabaseClient {
  assertSupabaseConfigured();
  return createClient(serverConfig.supabaseUrl, serverConfig.supabasePublishableKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
