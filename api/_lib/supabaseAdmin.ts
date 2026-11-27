import { createHash } from 'node:crypto';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface TableColumnSchema {
  type?: string;
  format?: string;
  enum?: string[];
}

export type TableSchemaMap = Record<string, TableColumnSchema>;

export type SupabaseKeyType =
  | 'missing'
  | 'jwt_service_role'
  | 'sb_secret'
  | 'jwt_anon'
  | 'jwt_authenticated'
  | 'jwt_other_role'
  | 'sb_publishable'
  | 'unrecognized';

export interface SafeSupabaseServerDiagnostics {
  hasSupabaseUrl: boolean;
  hasViteSupabaseUrl: boolean;
  hasServiceRoleKey: boolean;
  serviceRoleKeyType: SupabaseKeyType;
  isPrivilegedServerKey: boolean;
  matchesFrontendAnonKey: boolean;
}

export class BackendConfigError extends Error {
  readonly statusCode = 503;

  constructor(message: string) {
    super(message);
    this.name = 'BackendConfigError';
  }
}

let cachedClient: SupabaseClient | null = null;
let cachedKeyDigest = '';

const schemaCache = new Map<
  string,
  { fetchedAt: number; properties: TableSchemaMap | null }
>();
const SCHEMA_CACHE_TTL_MS = 5 * 60 * 1000;

function decodeJwtRole(token: string): string | null {
  const parts = token.split('.');
  if (parts.length !== 3 || !parts[1]) {
    return null;
  }

  try {
    const payloadJson = Buffer.from(parts[1], 'base64url').toString('utf8');
    const payload = JSON.parse(payloadJson) as { role?: unknown };
    return typeof payload?.role === 'string' ? payload.role.trim().toLowerCase() : '';
  } catch {
    return null;
  }
}

export function classifySupabaseKey(key: string): SupabaseKeyType {
  const trimmed = key.trim();
  if (!trimmed) return 'missing';
  if (trimmed.startsWith('sb_secret_')) return 'sb_secret';
  if (trimmed.startsWith('sb_publishable_')) return 'sb_publishable';

  const jwtRole = decodeJwtRole(trimmed);
  if (jwtRole !== null) {
    if (jwtRole === 'service_role') return 'jwt_service_role';
    if (jwtRole === 'anon') return 'jwt_anon';
    if (jwtRole === 'authenticated') return 'jwt_authenticated';
    return 'jwt_other_role';
  }

  return 'unrecognized';
}

export function getSafeServerSupabaseDiagnostics(): SafeSupabaseServerDiagnostics {
  const supabaseUrl = (process.env.SUPABASE_URL ?? '').trim();
  const viteSupabaseUrl = (process.env.VITE_SUPABASE_URL ?? '').trim();
  const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim();
  const frontendAnonKey = (
    process.env.VITE_SUPABASE_ANON_KEY ??
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
    ''
  ).trim();

  const keyType = classifySupabaseKey(serviceRoleKey);
  const matchesFrontendAnonKey =
    serviceRoleKey.length > 0 &&
    frontendAnonKey.length > 0 &&
    serviceRoleKey === frontendAnonKey;

  const isPrivilegedServerKey =
    !matchesFrontendAnonKey && (keyType === 'jwt_service_role' || keyType === 'sb_secret');

  return {
    hasSupabaseUrl: supabaseUrl.length > 0,
    hasViteSupabaseUrl: viteSupabaseUrl.length > 0,
    hasServiceRoleKey: serviceRoleKey.length > 0,
    serviceRoleKeyType: keyType,
    isPrivilegedServerKey,
    matchesFrontendAnonKey,
  };
}

function readServerSupabaseConfig(): {
  url: string;
  serviceRoleKey: string;
  keyType: 'jwt_service_role' | 'sb_secret';
} {
  const url = (process.env.SUPABASE_URL ?? '').trim().replace(/\/+$/, '');
  const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim();
  const diagnostics = getSafeServerSupabaseDiagnostics();

  if (!url) {
    console.error('[supabaseAdmin] Server configuration error:', diagnostics);
    const hint = diagnostics.hasViteSupabaseUrl
      ? ' Found VITE_SUPABASE_URL, but server routes strictly require SUPABASE_URL.'
      : '';
    throw new BackendConfigError(
      `Server database configuration is incomplete: process.env.SUPABASE_URL is missing.${hint}`
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    console.error('[supabaseAdmin] Invalid SUPABASE_URL format:', diagnostics);
    throw new BackendConfigError('SUPABASE_URL must be a valid URL.');
  }

  const isLocal = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
  if (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && isLocal)) {
    console.error('[supabaseAdmin] Non-HTTPS SUPABASE_URL rejected:', diagnostics);
    throw new BackendConfigError('SUPABASE_URL must use https://.');
  }

  if (!serviceRoleKey) {
    console.error('[supabaseAdmin] Missing server key:', diagnostics);
    throw new BackendConfigError(
      'Server database configuration is incomplete: process.env.SUPABASE_SERVICE_ROLE_KEY is missing. Server routes never fall back to the public anon key.'
    );
  }

  if (diagnostics.matchesFrontendAnonKey) {
    console.error('[supabaseAdmin] Rejected frontend anon key reused on server:', diagnostics);
    throw new BackendConfigError(
      `Server key misconfiguration: SUPABASE_SERVICE_ROLE_KEY matches the public frontend key (detected type: ${diagnostics.serviceRoleKeyType}). Set SUPABASE_SERVICE_ROLE_KEY to your private Supabase service_role or sb_secret_ key.`
    );
  }

  if (
    diagnostics.serviceRoleKeyType !== 'jwt_service_role' &&
    diagnostics.serviceRoleKeyType !== 'sb_secret'
  ) {
    console.error('[supabaseAdmin] Rejected non-privileged server key type:', diagnostics);
    throw new BackendConfigError(
      `Server key misconfiguration: SUPABASE_SERVICE_ROLE_KEY has non-privileged type "${diagnostics.serviceRoleKeyType}". Set SUPABASE_SERVICE_ROLE_KEY to your Supabase service_role JWT or sb_secret_ key (never anon or sb_publishable_).`
    );
  }

  return {
    url,
    serviceRoleKey,
    keyType: diagnostics.serviceRoleKeyType,
  };
}

export function getSupabaseAdminClient(): SupabaseClient {
  const { url, serviceRoleKey } = readServerSupabaseConfig();
  const nextDigest = createHash('sha256')
    .update(`${url}::${serviceRoleKey}`)
    .digest('hex');

  if (cachedClient && cachedKeyDigest === nextDigest) {
    return cachedClient;
  }

  cachedClient = createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  cachedKeyDigest = nextDigest;
  return cachedClient;
}

/**
 * Queries PostgREST's OpenAPI schema endpoint using the verified server-side
 * privileged key so backend inserts/updates match existing table columns and types,
 * even when tables currently contain 0 rows.
 */
export async function getTableSchemaProperties(
  table: 'registrations' | 'payment_submissions'
): Promise<TableSchemaMap | null> {
  const cached = schemaCache.get(table);
  if (cached && Date.now() - cached.fetchedAt < SCHEMA_CACHE_TTL_MS) {
    return cached.properties;
  }

  const { url, serviceRoleKey, keyType } = readServerSupabaseConfig();

  try {
    const headers: Record<string, string> = {
      apikey: serviceRoleKey,
      Accept: 'application/openapi+json, application/json',
    };
    if (keyType === 'jwt_service_role') {
      headers.Authorization = `Bearer ${serviceRoleKey}`;
    }

    const response = await fetch(`${url}/rest/v1/`, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      return null;
    }

    const spec = (await response.json()) as {
      definitions?: Record<string, { properties?: TableSchemaMap }>;
    };

    const tables: Array<'registrations' | 'payment_submissions'> = [
      'registrations',
      'payment_submissions',
    ];
    for (const name of tables) {
      const props = spec?.definitions?.[name]?.properties ?? null;
      schemaCache.set(name, { fetchedAt: Date.now(), properties: props });
    }

    return schemaCache.get(table)?.properties ?? null;
  } catch {
    return null;
  }
}
