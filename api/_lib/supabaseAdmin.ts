import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface TableColumnSchema {
  type?: string;
  format?: string;
  enum?: string[];
}

export type TableSchemaMap = Record<string, TableColumnSchema>;

export class BackendConfigError extends Error {
  readonly statusCode = 503;

  constructor(message: string) {
    super(message);
    this.name = 'BackendConfigError';
  }
}

let cachedClient: SupabaseClient | null = null;
let cachedKey = '';

const schemaCache = new Map<
  string,
  { fetchedAt: number; properties: TableSchemaMap | null }
>();
const SCHEMA_CACHE_TTL_MS = 5 * 60 * 1000;

function readServerSupabaseConfig(): { url: string; serviceRoleKey: string } {
  const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '')
    .trim()
    .replace(/\/+$/, '');
  const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

  if (!url) {
    throw new BackendConfigError(
      'Server database configuration is incomplete: set SUPABASE_URL in your backend environment variables.'
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new BackendConfigError('SUPABASE_URL must be a valid URL.');
  }

  const isLocal = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
  if (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && isLocal)) {
    throw new BackendConfigError('SUPABASE_URL must use https://.');
  }

  if (!serviceRoleKey) {
    throw new BackendConfigError(
      'Server database configuration is incomplete: set SUPABASE_SERVICE_ROLE_KEY in your backend environment variables.'
    );
  }

  return { url, serviceRoleKey };
}

export function getSupabaseAdminClient(): SupabaseClient {
  const { url, serviceRoleKey } = readServerSupabaseConfig();
  const nextKey = `${url}::${serviceRoleKey.slice(-12)}`;
  if (cachedClient && cachedKey === nextKey) {
    return cachedClient;
  }

  cachedClient = createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  cachedKey = nextKey;
  return cachedClient;
}

/**
 * Queries PostgREST's OpenAPI schema endpoint using the server-side service role key
 * so backend inserts/updates match the user's exact existing table columns and types,
 * even when tables currently contain 0 rows.
 */
export async function getTableSchemaProperties(
  table: 'registrations' | 'payment_submissions'
): Promise<TableSchemaMap | null> {
  const cached = schemaCache.get(table);
  if (cached && Date.now() - cached.fetchedAt < SCHEMA_CACHE_TTL_MS) {
    return cached.properties;
  }

  try {
    const { url, serviceRoleKey } = readServerSupabaseConfig();
    const response = await fetch(`${url}/rest/v1/`, {
      method: 'GET',
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        Accept: 'application/openapi+json, application/json',
      },
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
