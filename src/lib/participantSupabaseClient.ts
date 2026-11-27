import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseConfigStatus } from './supabaseClient';

let participantClient: SupabaseClient | null = null;
let cachedParticipantKey = '';

/**
 * Isolated Supabase Auth client for participants on /my-tickets.
 * Uses a separate storageKey ('alfaaz_participant_auth_token') so participant
 * OTP/magic-link logins never interfere with /admin sessions.
 */
export function getParticipantSupabaseClient(): SupabaseClient {
  const config = getSupabaseConfigStatus();
  if (!config.isConfigured) {
    throw new Error(
      config.configError || 'Supabase public client configuration is missing.'
    );
  }

  const nextKey = `${config.url}::${config.anonKey}`;
  if (participantClient && cachedParticipantKey === nextKey) {
    return participantClient;
  }

  participantClient = createClient(config.url, config.anonKey, {
    auth: {
      storageKey: 'alfaaz_participant_auth_token',
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
  cachedParticipantKey = nextKey;
  return participantClient;
}
