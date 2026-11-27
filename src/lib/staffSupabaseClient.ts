import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseConfigStatus } from './supabaseClient';

let cachedStaffClient: SupabaseClient | null = null;
let cachedConfigKey = '';

/**
 * Isolated Supabase Auth client for Event Check-In Staff on `/staff-checkin`.
 * Uses its own storage key so staff sessions never overwrite Admin or Participant sessions.
 */
export function getStaffSupabaseClient(): SupabaseClient {
  const status = getSupabaseConfigStatus();
  if (!status.isConfigured) {
    throw new Error(status.configError || 'Supabase is not configured.');
  }

  const nextKey = `${status.url}::${status.anonKey}::staff`;
  if (cachedStaffClient && cachedConfigKey === nextKey) {
    return cachedStaffClient;
  }

  cachedStaffClient = createClient(status.url, status.anonKey, {
    auth: {
      storageKey: 'alfaaz_staff_auth_token',
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  });
  cachedConfigKey = nextKey;
  return cachedStaffClient;
}
