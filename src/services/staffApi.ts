import { getStaffSupabaseClient } from '../lib/staffSupabaseClient';
import { getSupabaseClient } from '../lib/supabaseClient';
import type {
  AdminCheckInReportPayload,
  StaffCheckInResponse,
  StaffGateSessionPayload,
  StaffUserListItem,
} from '../types/staff';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').trim().replace(/\/+$/, '');

function apiUrl(path: string): string {
  return API_BASE_URL ? `${API_BASE_URL}${path}` : path;
}

export class StaffApiError extends Error {
  readonly statusCode?: number;
  readonly code?: string;

  constructor(message: string, statusCode?: number, code?: string) {
    super(message);
    this.name = 'StaffApiError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

async function parseJsonOrThrow<T>(response: Response, fallbackMsg: string): Promise<T> {
  let parsed: Record<string, unknown> | null = null;
  try {
    parsed = (await response.json()) as Record<string, unknown>;
  } catch {
    parsed = null;
  }

  if (!response.ok) {
    const message =
      (parsed && typeof parsed.message === 'string' && parsed.message) ||
      `${fallbackMsg} (${response.status})`;
    const code = parsed && typeof parsed.error === 'string' ? parsed.error : undefined;
    throw new StaffApiError(message, response.status, code);
  }

  return (parsed ?? {}) as T;
}

async function getStaffAccessToken(): Promise<string> {
  const supabase = getStaffSupabaseClient();
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.access_token) {
    throw new StaffApiError(
      'Staff sign-in required. Sign in with an authorized account.',
      401,
      'UNAUTHENTICATED'
    );
  }
  return data.session.access_token;
}

async function getAdminAccessToken(): Promise<string> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.access_token) {
    throw new StaffApiError('Admin authentication required.', 401, 'UNAUTHENTICATED');
  }
  return data.session.access_token;
}

export async function signInStaffWithPassword(
  email: string,
  password: string
): Promise<StaffGateSessionPayload> {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail || !password) {
    throw new StaffApiError('Enter both your staff email and password.', 400, 'VALIDATION_ERROR');
  }

  const supabase = getStaffSupabaseClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: cleanEmail,
    password,
  });

  if (error || !data.session?.access_token) {
    throw new StaffApiError(
      error?.message || 'Invalid staff credentials.',
      401,
      'UNAUTHENTICATED'
    );
  }

  try {
    return await fetchStaffGateSession();
  } catch (err) {
    if (
      err instanceof StaffApiError &&
      (err.code === 'ACCESS_DENIED' || err.code === 'ACCESS_REVOKED')
    ) {
      await supabase.auth.signOut().catch(() => undefined);
    }
    throw err;
  }
}

export async function signOutStaffSession(): Promise<void> {
  const supabase = getStaffSupabaseClient();
  await supabase.auth.signOut();
}

export async function getActiveStaffAccessToken(): Promise<string | null> {
  try {
    const supabase = getStaffSupabaseClient();
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  } catch {
    return null;
  }
}

export async function fetchStaffGateSession(): Promise<StaffGateSessionPayload> {
  const token = await getStaffAccessToken();
  const res = await fetch(apiUrl('/api/staff/session'), {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });
  return parseJsonOrThrow<StaffGateSessionPayload>(res, 'Unable to verify staff session');
}

export async function submitStaffCheckIn(payload: {
  qrPayload?: string;
  manualCode?: string;
  scanMethod: 'qr' | 'manual';
}): Promise<StaffCheckInResponse> {
  const token = await getStaffAccessToken();
  const res = await fetch(apiUrl('/api/staff/checkin'), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });
  return parseJsonOrThrow<StaffCheckInResponse>(res, 'Unable to process gate check-in');
}

export async function fetchAdminStaffList(): Promise<StaffUserListItem[]> {
  const token = await getAdminAccessToken();
  const res = await fetch(apiUrl('/api/admin/staff'), {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });
  const data = await parseJsonOrThrow<{ staffUsers: StaffUserListItem[] }>(
    res,
    'Unable to load authorized staff list'
  );
  return data.staffUsers ?? [];
}

export async function authorizeAdminStaffMember(params: {
  email: string;
  fullName: string;
  initialPassword?: string;
}): Promise<{ staffUser: StaffUserListItem; message: string }> {
  const token = await getAdminAccessToken();
  const res = await fetch(apiUrl('/api/admin/staff'), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(params),
  });
  return parseJsonOrThrow<{ staffUser: StaffUserListItem; message: string }>(
    res,
    'Unable to authorize staff member'
  );
}

export async function updateAdminStaffAccess(params: {
  userId: string;
  action: 'revoke' | 'reactivate';
}): Promise<{ staffUser: StaffUserListItem; message: string }> {
  const token = await getAdminAccessToken();
  const res = await fetch(apiUrl('/api/admin/staff'), {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(params),
  });
  return parseJsonOrThrow<{ staffUser: StaffUserListItem; message: string }>(
    res,
    'Unable to update staff access'
  );
}

export async function fetchAdminCheckinReport(): Promise<AdminCheckInReportPayload> {
  const token = await getAdminAccessToken();
  const res = await fetch(apiUrl('/api/admin/checkins'), {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });
  return parseJsonOrThrow<AdminCheckInReportPayload>(
    res,
    'Unable to load check-in report'
  );
}

export async function reverseAdminCheckin(params: {
  ticketId: string;
  reason: string;
}): Promise<{ reversed: boolean; ticketId: string; message: string }> {
  const token = await getAdminAccessToken();
  const res = await fetch(apiUrl('/api/admin/checkins'), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      action: 'reverse',
      ticketId: params.ticketId,
      reason: params.reason,
    }),
  });
  return parseJsonOrThrow<{ reversed: boolean; ticketId: string; message: string }>(
    res,
    'Unable to reverse check-in'
  );
}
