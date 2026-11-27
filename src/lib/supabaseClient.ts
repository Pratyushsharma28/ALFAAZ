import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface SupabaseConfigStatus {
  isConfigured: boolean;
  url: string;
  anonKey: string;
  missingVars: string[];
  configError?: string;
}

let cachedClient: SupabaseClient | null = null;
let cachedConfigKey = '';

function readEnvVars(): { url: string; anonKey: string } {
  const url = (import.meta.env.VITE_SUPABASE_URL ?? '').trim().replace(/\/+$/, '');
  const anonKey = (
    import.meta.env.VITE_SUPABASE_ANON_KEY ??
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
    ''
  ).trim();
  return { url, anonKey };
}

function isSafeSupabaseUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol === 'https:') return true;
    if (
      parsed.protocol === 'http:' &&
      (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1')
    ) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

function isServiceRoleJwt(token: string): boolean {
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const decoded = atob(base64);
    const payload = JSON.parse(decoded) as { role?: unknown };
    return payload?.role === 'service_role';
  } catch {
    return false;
  }
}

export function getSupabaseConfigStatus(): SupabaseConfigStatus {
  const { url, anonKey } = readEnvVars();
  const missingVars: string[] = [];

  if (!url) missingVars.push('VITE_SUPABASE_URL');
  if (!anonKey) missingVars.push('VITE_SUPABASE_ANON_KEY');

  if (missingVars.length > 0) {
    return {
      isConfigured: false,
      url,
      anonKey,
      missingVars,
      configError: `Missing required frontend environment variable${missingVars.length > 1 ? 's' : ''}: ${missingVars.join(', ')}.`,
    };
  }

  if (!isSafeSupabaseUrl(url)) {
    return {
      isConfigured: false,
      url,
      anonKey,
      missingVars: [],
      configError: 'VITE_SUPABASE_URL must be a valid https:// Supabase project URL.',
    };
  }

  if (isServiceRoleJwt(anonKey)) {
    return {
      isConfigured: false,
      url,
      anonKey: '',
      missingVars: [],
      configError:
        'Security error: Never place a Supabase service_role key in VITE_SUPABASE_ANON_KEY. Use the public anon/publishable key only.',
    };
  }

  return {
    isConfigured: true,
    url,
    anonKey,
    missingVars: [],
  };
}

export function getSupabaseClient(): SupabaseClient {
  const status = getSupabaseConfigStatus();
  if (!status.isConfigured) {
    throw new Error(status.configError || 'Supabase is not configured.');
  }

  const nextKey = `${status.url}::${status.anonKey}`;
  if (cachedClient && cachedConfigKey === nextKey) {
    return cachedClient;
  }

  cachedClient = createClient(status.url, status.anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  });
  cachedConfigKey = nextKey;
  return cachedClient;
}
