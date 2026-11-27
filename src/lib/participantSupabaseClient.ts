import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseConfigStatus } from './supabaseClient';

export const PRODUCTION_SITE_URL = 'https://alfaaz-unfiltered.vercel.app';

let participantClient: SupabaseClient | null = null;
let cachedParticipantKey = '';

function isLocalHostname(hostname: string): boolean {
  const normalized = hostname.trim().toLowerCase();
  return (
    normalized === 'localhost' ||
    normalized === '127.0.0.1' ||
    normalized === '[::1]'
  );
}

function getConfiguredProductionSiteUrl(): string {
  const raw = (
    import.meta.env.VITE_PUBLIC_SITE_URL ??
    import.meta.env.VITE_SITE_URL ??
    ''
  )
    .trim()
    .replace(/\/+$/, '');

  if (!raw) return '';

  try {
    const parsed = new URL(raw);
    if (parsed.protocol === 'https:' && !isLocalHostname(parsed.hostname)) {
      return parsed.origin;
    }
  } catch {
    // Ignore invalid URL and fall back to PRODUCTION_SITE_URL
  }

  return '';
}

/**
 * Resolves the Supabase emailRedirectTo URL for participant OTP/magic-link sign-in:
 * - Local development (`localhost` / `127.0.0.1`): `<local-origin>/my-tickets`
 * - Production / deployed environments: `https://alfaaz-unfiltered.vercel.app/my-tickets`
 *   (or `VITE_PUBLIC_SITE_URL` / `VITE_SITE_URL` if configured to a custom production origin)
 */
export function getParticipantAuthRedirectUrl(): string {
  if (typeof window !== 'undefined' && isLocalHostname(window.location.hostname)) {
    return `${window.location.origin}/my-tickets`;
  }

  const baseUrl = getConfiguredProductionSiteUrl() || PRODUCTION_SITE_URL;
  return `${baseUrl}/my-tickets`;
}

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
      flowType: 'implicit',
    },
  });
  cachedParticipantKey = nextKey;
  return participantClient;
}
