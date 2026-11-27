import { ApiHttpError, type NodeHttpRequest } from './httpUtils.js';
import { extractBearerToken } from './participantAuth.js';
import { getSupabaseAdminClient } from './supabaseAdmin.js';

export interface VerifiedStaffActor {
  userId: string;
  email: string;
  fullName: string;
  role: string;
}

export interface VerifiedAdminActor {
  userId: string;
  email: string;
  fullName: string;
  role: string;
}

function isUndefinedColumnError(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false;
  return (
    err.code === '42703' ||
    err.code === 'PGRST204' ||
    /column .* does not exist/i.test(err.message ?? '') ||
    /Could not find the '.*' column/i.test(err.message ?? '')
  );
}

function isMissingTableError(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false;
  return (
    err.code === '42P01' ||
    err.code === 'PGRST205' ||
    /relation .* does not exist|Could not find the table/i.test(err.message ?? '')
  );
}

function pickString(row: Record<string, unknown>, keys: string[], fallback = ''): string {
  for (const key of keys) {
    const val = row[key];
    if (typeof val === 'string' && val.trim().length > 0) return val.trim();
  }
  return fallback;
}

/**
 * Verifies a caller holds a valid Supabase Auth JWT AND is an active row in `staff_users`.
 */
export async function requireAuthorizedStaff(
  req: NodeHttpRequest
): Promise<VerifiedStaffActor> {
  const token = extractBearerToken(req);
  if (!token) {
    throw new ApiHttpError(
      401,
      'Staff sign-in required. Please sign in with an authorized staff account.',
      'UNAUTHENTICATED'
    );
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data?.user) {
    throw new ApiHttpError(
      401,
      'Your staff session has expired or is invalid. Please sign in again.',
      'UNAUTHENTICATED'
    );
  }

  const authUser = data.user;
  const email = (authUser.email ?? '').trim().toLowerCase();

  let staffRow: Record<string, unknown> | null = null;
  let queryErr: { code?: string; message?: string } | null = null;

  const res = await supabase
    .from('staff_users')
    .select('*')
    .eq('user_id', authUser.id)
    .maybeSingle();

  staffRow = (res.data as Record<string, unknown> | null) ?? null;
  queryErr = res.error;

  if (queryErr) {
    if (isMissingTableError(queryErr)) {
      throw new ApiHttpError(
        503,
        'Event staff database table (staff_users) is not provisioned yet. Run supabase/staff_checkin_migration.sql first.',
        'SCHEMA_NOT_READY'
      );
    }
    throw new ApiHttpError(
      500,
      `Unable to verify staff authorization: ${queryErr.message}`,
      'DB_QUERY_ERROR'
    );
  }

  if (!staffRow) {
    throw new ApiHttpError(
      403,
      'Access denied: this account is not authorized for event staff check-in.',
      'ACCESS_DENIED'
    );
  }

  const isActive = staffRow.is_active === true;
  const revokedAt = typeof staffRow.revoked_at === 'string' && staffRow.revoked_at.trim().length > 0;

  if (!isActive || revokedAt) {
    throw new ApiHttpError(
      403,
      'Access denied: staff check-in authorization for this account has been revoked.',
      'ACCESS_REVOKED'
    );
  }

  return {
    userId: authUser.id,
    email: pickString(staffRow, ['email'], email),
    fullName: pickString(staffRow, ['full_name', 'name'], email.split('@')[0] || 'Event Staff'),
    role: pickString(staffRow, ['role'], 'checkin_staff'),
  };
}

/**
 * Verifies a caller holds a valid Supabase Auth JWT AND is an active row in `admin_users`.
 */
export async function requireAuthorizedAdmin(
  req: NodeHttpRequest
): Promise<VerifiedAdminActor> {
  const token = extractBearerToken(req);
  if (!token) {
    throw new ApiHttpError(
      401,
      'Admin authentication required.',
      'UNAUTHENTICATED'
    );
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data?.user) {
    throw new ApiHttpError(
      401,
      'Admin session is invalid or expired. Please sign in again.',
      'UNAUTHENTICATED'
    );
  }

  const authUser = data.user;
  const email = (authUser.email ?? '').trim().toLowerCase();

  let row: Record<string, unknown> | null = null;
  let queryErr: { code?: string; message?: string } | null = null;

  const byUserId = await supabase
    .from('admin_users')
    .select('*')
    .eq('user_id', authUser.id)
    .maybeSingle();

  if (byUserId.error && isUndefinedColumnError(byUserId.error)) {
    const byId = await supabase
      .from('admin_users')
      .select('*')
      .eq('id', authUser.id)
      .maybeSingle();
    row = (byId.data as Record<string, unknown> | null) ?? null;
    queryErr = byId.error;
  } else {
    row = (byUserId.data as Record<string, unknown> | null) ?? null;
    queryErr = byUserId.error;
  }

  if (queryErr) {
    throw new ApiHttpError(
      500,
      `Unable to verify admin authorization: ${queryErr.message}`,
      'DB_QUERY_ERROR'
    );
  }

  if (!row) {
    throw new ApiHttpError(
      403,
      'Access denied: account is not an authorized ALFAAZ admin.',
      'ACCESS_DENIED'
    );
  }

  const matchedUserId = pickString(row, ['user_id', 'id']);
  if (matchedUserId !== authUser.id) {
    throw new ApiHttpError(
      403,
      'Access denied: admin record mismatch.',
      'ACCESS_DENIED'
    );
  }

  const adminRevokedAt =
    typeof row.revoked_at === 'string' && row.revoked_at.trim().length > 0;
  const adminRole = pickString(row, ['role'], 'admin');

  if (
    row.is_active === false ||
    row.active === false ||
    adminRevokedAt ||
    adminRole.toLowerCase() === 'revoked' ||
    adminRole.toLowerCase() === 'disabled'
  ) {
    throw new ApiHttpError(
      403,
      'Access denied: admin account is inactive.',
      'ACCESS_DENIED'
    );
  }

  return {
    userId: authUser.id,
    email: pickString(row, ['email'], email),
    fullName: pickString(row, ['full_name', 'name'], email.split('@')[0] || 'Organizer Admin'),
    role: adminRole,
  };
}
