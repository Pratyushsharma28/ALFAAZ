import type { SupabaseClient } from '@supabase/supabase-js';
import { ApiHttpError } from './httpUtils.js';
import { verifyPublicTicketQr } from './participantService.js';
import type { VerifiedAdminActor, VerifiedStaffActor } from './staffAuth.js';
import { getSupabaseAdminClient } from './supabaseAdmin.js';
import { deriveTicketId, signTicketVerificationToken } from './ticketService.js';

export type CheckInOutcome = 'ENTRY_APPROVED' | 'ALREADY_CHECKED_IN' | 'ENTRY_DENIED';

export interface SafeCheckInTicketInfo {
  ticketId: string;
  registrationCode: string;
  participantOrTeamName: string;
  passCategoryLabel: string;
  categoriesDisplay: string;
  participantCount: number;
  verifiedAt: string | null;
}

export interface StaffCheckInResponse {
  approved: boolean;
  outcome: CheckInOutcome;
  headline: string;
  message: string;
  checkedInAt: string | null;
  checkedInByName: string | null;
  scanMethod: 'qr' | 'manual';
  ticket: SafeCheckInTicketInfo | null;
}

export interface CheckInSummaryStats {
  totalValidTickets: number;
  checkedInCount: number;
  remainingCount: number;
  checkInRatePercent: number;
}

export interface SafeRecentCheckInItem {
  ticketId: string;
  registrationCode: string;
  participantOrTeamName: string;
  passCategoryLabel: string;
  participantCount: number;
  checkedInAt: string;
  checkedInByName: string;
  scanMethod: 'qr' | 'manual';
}

export interface StaffUserListItem {
  id: string;
  userId: string;
  email: string;
  fullName: string;
  role: string;
  isActive: boolean;
  authorizedAt: string;
  revokedAt: string | null;
}

export interface AdminCheckInRecordItem {
  id: string;
  ticketId: string;
  registrationId: string;
  registrationCode: string;
  participantOrTeamName: string;
  fullName: string;
  passCategoryLabel: string;
  categoriesDisplay: string;
  participantCount: number;
  checkedInAt: string;
  checkedInByUserId: string;
  checkedInByName: string;
  checkedInByEmail: string;
  scanMethod: 'qr' | 'manual';
}

export interface AdminCheckInAuditLogItem {
  id: string;
  action: 'CHECKED_IN' | 'REVERSED';
  ticketId: string;
  registrationId: string;
  registrationCode: string;
  performedByEmail: string;
  performedByRole: 'staff' | 'admin';
  originalCheckedInAt: string | null;
  reason: string | null;
  createdAt: string;
}

function pickString(row: Record<string, unknown>, keys: string[], fallback = ''): string {
  for (const key of keys) {
    const val = row[key];
    if (typeof val === 'string' && val.trim().length > 0) return val.trim();
    if (typeof val === 'number' && Number.isFinite(val)) return String(val);
  }
  return fallback;
}

function pickOptionalString(row: Record<string, unknown>, keys: string[]): string | null {
  const val = pickString(row, keys, '');
  return val.length > 0 ? val : null;
}

function pickNumber(row: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const val = row[key];
    if (typeof val === 'number' && Number.isFinite(val)) return val;
    if (typeof val === 'string' && val.trim().length > 0) {
      const parsed = Number(val.trim());
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}

function normalizeEntryType(raw: string): 'individual' | 'couple' | 'group' {
  const lower = raw.trim().toLowerCase();
  if (lower === 'couple' || lower === 'duo') return 'couple';
  if (lower === 'group' || lower === 'team') return 'group';
  return 'individual';
}

const PASS_LABELS: Record<'individual' | 'couple' | 'group', string> = {
  individual: 'INDIVIDUAL',
  couple: 'COUPLE',
  group: 'GROUP',
};

function normalizeCategoriesDisplay(raw: unknown): string {
  if (Array.isArray(raw)) {
    const items = raw.map((item) => String(item).trim()).filter(Boolean);
    return items.length > 0 ? items.join(', ') : 'General';
  }
  if (typeof raw === 'string' && raw.trim().length > 0) {
    const trimmed = raw.trim();
    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          const items = parsed.map((item) => String(item).trim()).filter(Boolean);
          return items.length > 0 ? items.join(', ') : 'General';
        }
      } catch {
        // fall through
      }
    }
    const items = trimmed
      .split(/[,;|]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    return items.length > 0 ? items.join(', ') : 'General';
  }
  return 'General';
}

function normalizeCanonicalStatus(rawStatus: string): 'verified' | 'rejected' | 'pending' {
  const lower = rawStatus.trim().toLowerCase();
  if (
    lower === 'verified' ||
    lower === 'confirmed' ||
    lower === 'paid' ||
    lower === 'approved' ||
    lower === 'completed' ||
    lower === 'success'
  ) {
    return 'verified';
  }
  if (
    lower === 'rejected' ||
    lower === 'declined' ||
    lower === 'failed' ||
    lower === 'invalid' ||
    lower === 'cancelled' ||
    lower === 'canceled'
  ) {
    return 'rejected';
  }
  return 'pending';
}

function isMissingTableError(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false;
  return (
    err.code === '42P01' ||
    err.code === 'PGRST205' ||
    /relation .* does not exist|Could not find the table/i.test(err.message ?? '')
  );
}

function isMissingFunctionError(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false;
  return (
    err.code === '42883' ||
    err.code === 'PGRST202' ||
    /function .* does not exist|Could not find the function/i.test(err.message ?? '')
  );
}

function assertStaffTablesReady(err: { code?: string; message?: string } | null, tableName: string): void {
  if (err && isMissingTableError(err)) {
    throw new ApiHttpError(
      503,
      `Database table "${tableName}" is not provisioned yet. Run supabase/staff_checkin_migration.sql in your Supabase SQL Editor.`,
      'SCHEMA_NOT_READY'
    );
  }
}

function assertStaffRpcReady(err: { code?: string; message?: string } | null, fnName: string): void {
  if (err && (isMissingTableError(err) || isMissingFunctionError(err))) {
    throw new ApiHttpError(
      503,
      `Database function "${fnName}" is not provisioned yet. Run the updated supabase/staff_checkin_migration.sql in your Supabase SQL Editor.`,
      'SCHEMA_NOT_READY'
    );
  }
}

interface NormalizedRegistrationSummary {
  registrationId: string;
  registrationCode: string;
  ticketId: string;
  fullName: string;
  participantOrTeamName: string;
  passCategoryLabel: string;
  categoriesDisplay: string;
  participantCount: number;
  isValidTicket: boolean;
  verifiedAt: string | null;
}

async function fetchAllNormalizedRegistrations(
  supabase: SupabaseClient
): Promise<NormalizedRegistrationSummary[]> {
  const [regsRes, subsRes] = await Promise.all([
    supabase.from('registrations').select('*'),
    supabase.from('payment_submissions').select('*'),
  ]);

  if (regsRes.error) {
    throw new ApiHttpError(
      500,
      `Unable to load registrations: ${regsRes.error.message}`,
      'DB_QUERY_ERROR'
    );
  }
  if (subsRes.error) {
    throw new ApiHttpError(
      500,
      `Unable to load payment submissions: ${subsRes.error.message}`,
      'DB_QUERY_ERROR'
    );
  }

  const regRows = (regsRes.data as Record<string, unknown>[] | null) ?? [];
  const subRows = (subsRes.data as Record<string, unknown>[] | null) ?? [];

  const subsByRegKey = new Map<string, Record<string, unknown>[]>();
  for (const sub of subRows) {
    const regId = pickString(sub, ['registration_id']);
    const regCode = pickString(sub, ['registration_code', 'reference_id']);
    for (const key of [regId, regCode]) {
      if (!key) continue;
      const list = subsByRegKey.get(key) ?? [];
      list.push(sub);
      subsByRegKey.set(key, list);
    }
  }

  return regRows.map((regRow) => {
    const registrationId = pickString(regRow, ['id', 'registration_id']);
    const registrationCode = pickString(
      regRow,
      ['registration_code', 'reference_id', 'code'],
      registrationId
    );
    const matchingSubs = [
      ...(subsByRegKey.get(registrationId) ?? []),
      ...(registrationCode !== registrationId ? subsByRegKey.get(registrationCode) ?? [] : []),
    ];

    matchingSubs.sort((a, b) => {
      const tA = new Date(pickString(a, ['created_at', 'submitted_at', 'updated_at'])).getTime() || 0;
      const tB = new Date(pickString(b, ['created_at', 'submitted_at', 'updated_at'])).getTime() || 0;
      return tB - tA;
    });

    const latestSub = matchingSubs[0] ?? null;
    const latestSubStatus = latestSub
      ? normalizeCanonicalStatus(
          pickString(latestSub, ['verification_status', 'status', 'payment_status'], 'pending')
        )
      : null;

    const regRawStatus = pickOptionalString(regRow, [
      'payment_status',
      'status',
      'verification_status',
    ]);
    const regCanonical = regRawStatus ? normalizeCanonicalStatus(regRawStatus) : null;

    let reconciled: 'verified' | 'rejected' | 'pending' = 'pending';
    if (latestSubStatus && latestSubStatus !== 'pending') {
      reconciled = latestSubStatus;
    } else if (regCanonical && regCanonical !== 'pending') {
      reconciled = regCanonical;
    }

    const explicitTicketStatus = (
      pickOptionalString(regRow, ['ticket_status', 'pass_status', 'payment_status', 'status']) ?? ''
    ).toLowerCase();
    const isExplicitlyRevoked =
      regRow.is_revoked === true ||
      regRow.ticket_revoked === true ||
      Boolean(pickOptionalString(regRow, ['revoked_at'])) ||
      ['revoked', 'cancelled', 'canceled', 'void', 'invalidated'].includes(explicitTicketStatus);

    const existingTicketId = pickOptionalString(regRow, ['ticket_id']) ?? undefined;
    const ticketId = deriveTicketId(registrationId, existingTicketId);
    const entryType = normalizeEntryType(
      pickString(regRow, ['entry_type', 'participation_type', 'pass_type'], 'individual')
    );

    const verifiedAt =
      reconciled === 'verified'
        ? pickOptionalString(regRow, ['verified_at', 'reviewed_at']) ??
          (latestSub ? pickOptionalString(latestSub, ['verified_at', 'reviewed_at']) : null)
        : null;

    const participantCount =
      pickNumber(regRow, ['participant_count', 'team_size']) ?? (entryType === 'couple' ? 2 : 1);

    const fullName = pickString(regRow, ['full_name', 'participant_name', 'name'], 'Participant');

    return {
      registrationId,
      registrationCode,
      ticketId,
      fullName,
      participantOrTeamName: pickString(
        regRow,
        ['team_or_individual_name', 'team_name', 'stage_name'],
        fullName
      ),
      passCategoryLabel: PASS_LABELS[entryType],
      categoriesDisplay: normalizeCategoriesDisplay(
        regRow.categories ?? regRow.category ?? regRow.participation_categories
      ),
      participantCount,
      isValidTicket: reconciled === 'verified' && !isExplicitlyRevoked,
      verifiedAt,
    };
  });
}

function parseVerificationParamsFromRaw(rawText: string): {
  ticketId: string;
  registrationId: string;
  signature: string;
} | null {
  const trimmed = rawText.trim();
  if (!trimmed) return null;

  let searchParams: URLSearchParams | null = null;

  if (/^https?:\/\//i.test(trimmed) || trimmed.includes('verify-ticket') || trimmed.includes('?')) {
    try {
      const normalizedUrl = trimmed.startsWith('http')
        ? trimmed
        : `https://alfaaz-unfiltered.vercel.app/${trimmed.replace(/^\/+/, '')}`;
      const parsed = new URL(normalizedUrl);
      searchParams = parsed.searchParams;
    } catch {
      searchParams = null;
    }
  } else if (trimmed.includes('ticketId=') || trimmed.includes('verify=')) {
    searchParams = new URLSearchParams(trimmed.replace(/^\?/, ''));
  }

  if (searchParams) {
    const ticketId = (searchParams.get('ticketId') || searchParams.get('verify') || '').trim();
    const registrationId = (searchParams.get('reg') || '').trim();
    const signature = (searchParams.get('sig') || '').trim();
    if (ticketId || registrationId || signature) {
      return { ticketId, registrationId, signature };
    }
  }

  // Also support JSON-encoded QR payloads if ever generated
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed) as Record<string, unknown>;
      const ticketId = pickString(parsed, ['ticketId', 'verify']);
      const registrationId = pickString(parsed, ['reg', 'registrationId']);
      const signature = pickString(parsed, ['sig', 'signature']);
      if (ticketId || registrationId || signature) {
        return { ticketId, registrationId, signature };
      }
    } catch {
      // ignore invalid JSON
    }
  }

  return null;
}

export async function performAtomicStaffCheckIn(params: {
  staff: VerifiedStaffActor;
  qrPayload?: string;
  ticketId?: string;
  registrationId?: string;
  signature?: string;
  manualCode?: string;
  scanMethod?: 'qr' | 'manual';
}): Promise<StaffCheckInResponse> {
  const supabase = getSupabaseAdminClient();
  const scanMethod: 'qr' | 'manual' =
    params.scanMethod === 'manual' || Boolean(params.manualCode?.trim()) ? 'manual' : 'qr';

  let ticketId = (params.ticketId ?? '').trim().toUpperCase();
  let registrationId = (params.registrationId ?? '').trim();
  let signature = (params.signature ?? '').trim();
  let resolvedByManualLookup = false;

  const rawInput = (params.qrPayload || params.manualCode || '').trim();
  if (!ticketId && !registrationId && rawInput) {
    const parsedQr = parseVerificationParamsFromRaw(rawInput);
    if (parsedQr) {
      ticketId = parsedQr.ticketId.toUpperCase();
      registrationId = parsedQr.registrationId;
      signature = parsedQr.signature;
    } else if (scanMethod === 'manual' || /^[A-Za-z0-9_-]{4,80}$/.test(rawInput)) {
      const lookupCode = rawInput.toUpperCase();
      const allRegs = await fetchAllNormalizedRegistrations(supabase);
      const matched = allRegs.find(
        (r) =>
          r.ticketId.toUpperCase() === lookupCode ||
          r.registrationCode.toUpperCase() === lookupCode ||
          r.registrationId.toUpperCase() === lookupCode
      );
      if (!matched) {
        return {
          approved: false,
          outcome: 'ENTRY_DENIED',
          headline: 'ENTRY DENIED',
          message: 'Ticket not found. No valid registration matches that Ticket ID or Registration Code.',
          checkedInAt: null,
          checkedInByName: null,
          scanMethod,
          ticket: null,
        };
      }
      ticketId = matched.ticketId;
      registrationId = matched.registrationId;
      signature = signTicketVerificationToken(matched.ticketId, matched.registrationId);
      resolvedByManualLookup = true;
    }
  }

  if (!ticketId && !registrationId) {
    throw new ApiHttpError(
      400,
      'Provide a scanned QR code payload or a valid Ticket ID / Registration Code.',
      'VALIDATION_ERROR'
    );
  }

  // Always verify server-side using the canonical public QR verification logic
  const verification = await verifyPublicTicketQr({
    ticketId,
    registrationId,
    signature,
  });

  if (!verification.valid || verification.status !== 'verified') {
    const deniedReason =
      verification.status === 'invalid' && resolvedByManualLookup
        ? 'Ticket record could not be verified for entry.'
        : verification.message;

    return {
      approved: false,
      outcome: 'ENTRY_DENIED',
      headline: 'ENTRY DENIED',
      message: deniedReason,
      checkedInAt: null,
      checkedInByName: null,
      scanMethod,
      ticket: verification.registrationCode
        ? {
            ticketId: verification.ticketId,
            registrationCode: verification.registrationCode,
            participantOrTeamName: verification.participantOrTeamName || 'Participant',
            passCategoryLabel: verification.passCategoryLabel || 'INDIVIDUAL',
            categoriesDisplay: verification.categoriesDisplay || 'General',
            participantCount: verification.participantCount ?? 1,
            verifiedAt: verification.verifiedAt ?? null,
          }
        : null,
    };
  }

  const canonicalTicketId = verification.ticketId.trim().toUpperCase();
  const canonicalRegId = registrationId.trim();
  const safeTicketInfo: SafeCheckInTicketInfo = {
    ticketId: canonicalTicketId,
    registrationCode: verification.registrationCode || canonicalRegId,
    participantOrTeamName: verification.participantOrTeamName || 'Participant',
    passCategoryLabel: verification.passCategoryLabel || 'INDIVIDUAL',
    categoriesDisplay: verification.categoriesDisplay || 'General',
    participantCount: verification.participantCount ?? 1,
    verifiedAt: verification.verifiedAt ?? null,
  };

  const rpcRes = await supabase.rpc('perform_atomic_ticket_checkin', {
    p_ticket_id: canonicalTicketId,
    p_registration_id: canonicalRegId,
    p_registration_code: safeTicketInfo.registrationCode,
    p_staff_user_id: params.staff.userId,
    p_staff_email: params.staff.email,
    p_staff_name: params.staff.fullName,
    p_scan_method: scanMethod,
  });

  assertStaffRpcReady(rpcRes.error, 'perform_atomic_ticket_checkin');
  if (rpcRes.error || !rpcRes.data || typeof rpcRes.data !== 'object') {
    throw new ApiHttpError(
      500,
      `Failed to record check-in: ${rpcRes.error?.message || 'Database error'}`,
      'DB_INSERT_ERROR'
    );
  }

  const rpcPayload = rpcRes.data as Record<string, unknown>;
  const outcome = pickString(rpcPayload, ['outcome']);
  const checkedInAt = pickOptionalString(rpcPayload, ['checked_in_at']);
  const checkedInByName = pickOptionalString(rpcPayload, ['checked_in_by_name', 'checked_in_by_email']);

  if (outcome === 'ALREADY_CHECKED_IN') {
    return {
      approved: false,
      outcome: 'ALREADY_CHECKED_IN',
      headline: 'ALREADY CHECKED IN',
      message: checkedInAt
        ? `This ticket was already scanned and checked in at ${checkedInAt}.`
        : 'This ticket has already been checked in at the gate.',
      checkedInAt,
      checkedInByName,
      scanMethod,
      ticket: safeTicketInfo,
    };
  }

  return {
    approved: true,
    outcome: 'ENTRY_APPROVED',
    headline: 'ENTRY APPROVED — CHECKED IN',
    message: 'Pass verified and attendee checked in.',
    checkedInAt: checkedInAt || new Date().toISOString(),
    checkedInByName: checkedInByName || params.staff.fullName,
    scanMethod,
    ticket: safeTicketInfo,
  };
}

export async function getStaffGateSummary(staff: VerifiedStaffActor): Promise<{
  staff: VerifiedStaffActor;
  stats: CheckInSummaryStats;
  recentCheckins: SafeRecentCheckInItem[];
}> {
  const supabase = getSupabaseAdminClient();
  const [normalizedRegs, checkinsRes] = await Promise.all([
    fetchAllNormalizedRegistrations(supabase),
    supabase.from('ticket_checkins').select('*').order('checked_in_at', { ascending: false }),
  ]);

  assertStaffTablesReady(checkinsRes.error, 'ticket_checkins');
  if (checkinsRes.error) {
    throw new ApiHttpError(
      500,
      `Unable to load check-in summary: ${checkinsRes.error.message}`,
      'DB_QUERY_ERROR'
    );
  }

  const regById = new Map<string, NormalizedRegistrationSummary>();
  const regByTicketId = new Map<string, NormalizedRegistrationSummary>();
  let totalValidTickets = 0;

  for (const reg of normalizedRegs) {
    regById.set(reg.registrationId, reg);
    regByTicketId.set(reg.ticketId, reg);
    if (reg.isValidTicket) totalValidTickets += 1;
  }

  const checkinRows = (checkinsRes.data as Record<string, unknown>[] | null) ?? [];
  const checkedInCount = checkinRows.length;
  const remainingCount = Math.max(0, totalValidTickets - checkedInCount);
  const checkInRatePercent =
    totalValidTickets > 0 ? Math.round((checkedInCount / totalValidTickets) * 100) : 0;

  const recentCheckins: SafeRecentCheckInItem[] = checkinRows.slice(0, 15).map((row) => {
    const ticketId = pickString(row, ['ticket_id']);
    const regId = pickString(row, ['registration_id']);
    const reg = regByTicketId.get(ticketId) ?? regById.get(regId);

    return {
      ticketId,
      registrationCode: reg?.registrationCode || pickString(row, ['registration_code'], regId),
      participantOrTeamName: reg?.participantOrTeamName || 'Verified Guest',
      passCategoryLabel: reg?.passCategoryLabel || 'PASS',
      participantCount: reg?.participantCount ?? 1,
      checkedInAt: pickString(row, ['checked_in_at', 'created_at']),
      checkedInByName: pickString(row, ['checked_in_by_name'], 'Gate Staff'),
      scanMethod: pickString(row, ['scan_method'], 'qr') === 'manual' ? 'manual' : 'qr',
    };
  });

  return {
    staff,
    stats: {
      totalValidTickets,
      checkedInCount,
      remainingCount,
      checkInRatePercent,
    },
    recentCheckins,
  };
}

export async function listStaffUsers(): Promise<StaffUserListItem[]> {
  const supabase = getSupabaseAdminClient();
  const res = await supabase
    .from('staff_users')
    .select('*')
    .order('authorized_at', { ascending: false });

  assertStaffTablesReady(res.error, 'staff_users');
  if (res.error) {
    throw new ApiHttpError(
      500,
      `Unable to load staff accounts: ${res.error.message}`,
      'DB_QUERY_ERROR'
    );
  }

  const rows = (res.data as Record<string, unknown>[] | null) ?? [];
  return rows.map((row) => ({
    id: pickString(row, ['id', 'user_id']),
    userId: pickString(row, ['user_id']),
    email: pickString(row, ['email']),
    fullName: pickString(row, ['full_name', 'name'], 'Event Staff'),
    role: pickString(row, ['role'], 'checkin_staff'),
    isActive: row.is_active !== false && !pickOptionalString(row, ['revoked_at']),
    authorizedAt: pickString(row, ['authorized_at', 'created_at']),
    revokedAt: pickOptionalString(row, ['revoked_at']),
  }));
}

async function findSupabaseAuthUserByEmail(
  supabase: SupabaseClient,
  email: string
): Promise<{ id: string; email: string } | null> {
  const target = email.trim().toLowerCase();
  for (let page = 1; page <= 10; page++) {
    const res = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (res.error) {
      throw new ApiHttpError(
        500,
        `Unable to search Supabase Auth accounts: ${res.error.message}`,
        'AUTH_LOOKUP_ERROR'
      );
    }
    const users = res.data?.users ?? [];
    const match = users.find((u) => (u.email ?? '').trim().toLowerCase() === target);
    if (match) {
      return { id: match.id, email: (match.email ?? target).toLowerCase() };
    }
    if (users.length < 200) break;
  }
  return null;
}

export async function authorizeStaffUser(params: {
  email: string;
  fullName: string;
  initialPassword?: string;
  admin: VerifiedAdminActor;
}): Promise<StaffUserListItem> {
  const cleanEmail = params.email.trim().toLowerCase();
  const cleanName = params.fullName.trim();
  const initialPassword = (params.initialPassword ?? '').trim();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    throw new ApiHttpError(400, 'Enter a valid staff email address.', 'VALIDATION_ERROR');
  }
  if (!cleanName || cleanName.length < 2) {
    throw new ApiHttpError(400, 'Enter the staff member’s full name.', 'VALIDATION_ERROR');
  }

  const supabase = getSupabaseAdminClient();
  let authUser = await findSupabaseAuthUserByEmail(supabase, cleanEmail);

  if (!authUser) {
    if (initialPassword.length < 8) {
      throw new ApiHttpError(
        400,
        'No existing Supabase account was found for this email. Provide an initial password (minimum 8 characters) to create their staff login.',
        'INITIAL_PASSWORD_REQUIRED'
      );
    }

    const created = await supabase.auth.admin.createUser({
      email: cleanEmail,
      password: initialPassword,
      email_confirm: true,
      user_metadata: { full_name: cleanName },
    });

    if (created.error || !created.data?.user) {
      throw new ApiHttpError(
        500,
        `Unable to create Supabase Auth login for staff member: ${created.error?.message || 'Unknown error'}`,
        'AUTH_CREATE_ERROR'
      );
    }

    authUser = {
      id: created.data.user.id,
      email: (created.data.user.email ?? cleanEmail).toLowerCase(),
    };
  }

  const nowIso = new Date().toISOString();
  const upsertRes = await supabase
    .from('staff_users')
    .upsert(
      {
        user_id: authUser.id,
        email: authUser.email,
        full_name: cleanName,
        role: 'checkin_staff',
        is_active: true,
        authorized_by: params.admin.userId,
        authorized_at: nowIso,
        revoked_by: null,
        revoked_at: null,
        updated_at: nowIso,
      },
      { onConflict: 'user_id' }
    )
    .select('*')
    .single();

  assertStaffTablesReady(upsertRes.error, 'staff_users');
  if (upsertRes.error || !upsertRes.data) {
    throw new ApiHttpError(
      500,
      `Unable to save staff authorization: ${upsertRes.error?.message || 'Database error'}`,
      'DB_UPSERT_ERROR'
    );
  }

  const row = upsertRes.data as Record<string, unknown>;
  return {
    id: pickString(row, ['id', 'user_id']),
    userId: pickString(row, ['user_id'], authUser.id),
    email: pickString(row, ['email'], authUser.email),
    fullName: pickString(row, ['full_name'], cleanName),
    role: pickString(row, ['role'], 'checkin_staff'),
    isActive: row.is_active !== false,
    authorizedAt: pickString(row, ['authorized_at'], nowIso),
    revokedAt: pickOptionalString(row, ['revoked_at']),
  };
}

export async function updateStaffAccess(params: {
  userId: string;
  action: 'revoke' | 'reactivate';
  admin: VerifiedAdminActor;
}): Promise<StaffUserListItem> {
  const targetUserId = params.userId.trim();
  if (!targetUserId) {
    throw new ApiHttpError(400, 'Staff userId is required.', 'VALIDATION_ERROR');
  }

  const supabase = getSupabaseAdminClient();
  const nowIso = new Date().toISOString();

  const patch =
    params.action === 'revoke'
      ? {
          is_active: false,
          revoked_by: params.admin.userId,
          revoked_at: nowIso,
          updated_at: nowIso,
        }
      : {
          is_active: true,
          revoked_by: null,
          revoked_at: null,
          authorized_by: params.admin.userId,
          updated_at: nowIso,
        };

  const updateRes = await supabase
    .from('staff_users')
    .update(patch)
    .eq('user_id', targetUserId)
    .select('*')
    .maybeSingle();

  assertStaffTablesReady(updateRes.error, 'staff_users');
  if (updateRes.error) {
    throw new ApiHttpError(
      500,
      `Unable to update staff access: ${updateRes.error.message}`,
      'DB_UPDATE_ERROR'
    );
  }

  if (!updateRes.data) {
    throw new ApiHttpError(404, 'Staff member record not found.', 'NOT_FOUND');
  }

  const row = updateRes.data as Record<string, unknown>;
  return {
    id: pickString(row, ['id', 'user_id']),
    userId: pickString(row, ['user_id'], targetUserId),
    email: pickString(row, ['email']),
    fullName: pickString(row, ['full_name'], 'Event Staff'),
    role: pickString(row, ['role'], 'checkin_staff'),
    isActive: row.is_active !== false && !pickOptionalString(row, ['revoked_at']),
    authorizedAt: pickString(row, ['authorized_at']),
    revokedAt: pickOptionalString(row, ['revoked_at']),
  };
}

export async function getAdminCheckinReport(): Promise<{
  stats: CheckInSummaryStats;
  checkedInTickets: AdminCheckInRecordItem[];
  auditLogs: AdminCheckInAuditLogItem[];
}> {
  const supabase = getSupabaseAdminClient();
  const [normalizedRegs, checkinsRes, auditRes] = await Promise.all([
    fetchAllNormalizedRegistrations(supabase),
    supabase.from('ticket_checkins').select('*').order('checked_in_at', { ascending: false }),
    supabase
      .from('ticket_checkin_audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100),
  ]);

  assertStaffTablesReady(checkinsRes.error, 'ticket_checkins');
  assertStaffTablesReady(auditRes.error, 'ticket_checkin_audit_logs');

  if (checkinsRes.error) {
    throw new ApiHttpError(
      500,
      `Unable to load check-in records: ${checkinsRes.error.message}`,
      'DB_QUERY_ERROR'
    );
  }
  if (auditRes.error) {
    throw new ApiHttpError(
      500,
      `Unable to load check-in audit logs: ${auditRes.error.message}`,
      'DB_QUERY_ERROR'
    );
  }

  const regById = new Map<string, NormalizedRegistrationSummary>();
  const regByTicketId = new Map<string, NormalizedRegistrationSummary>();
  let totalValidTickets = 0;

  for (const reg of normalizedRegs) {
    regById.set(reg.registrationId, reg);
    regByTicketId.set(reg.ticketId, reg);
    if (reg.isValidTicket) totalValidTickets += 1;
  }

  const checkinRows = (checkinsRes.data as Record<string, unknown>[] | null) ?? [];
  const checkedInCount = checkinRows.length;
  const remainingCount = Math.max(0, totalValidTickets - checkedInCount);
  const checkInRatePercent =
    totalValidTickets > 0 ? Math.round((checkedInCount / totalValidTickets) * 100) : 0;

  const checkedInTickets: AdminCheckInRecordItem[] = checkinRows.map((row) => {
    const ticketId = pickString(row, ['ticket_id']);
    const registrationId = pickString(row, ['registration_id']);
    const reg = regByTicketId.get(ticketId) ?? regById.get(registrationId);

    return {
      id: pickString(row, ['id'], ticketId),
      ticketId,
      registrationId,
      registrationCode: reg?.registrationCode || pickString(row, ['registration_code'], registrationId),
      participantOrTeamName: reg?.participantOrTeamName || 'Verified Guest',
      fullName: reg?.fullName || 'Participant',
      passCategoryLabel: reg?.passCategoryLabel || 'PASS',
      categoriesDisplay: reg?.categoriesDisplay || 'General',
      participantCount: reg?.participantCount ?? 1,
      checkedInAt: pickString(row, ['checked_in_at', 'created_at']),
      checkedInByUserId: pickString(row, ['checked_in_by_user_id']),
      checkedInByName: pickString(row, ['checked_in_by_name'], 'Staff'),
      checkedInByEmail: pickString(row, ['checked_in_by_email']),
      scanMethod: pickString(row, ['scan_method'], 'qr') === 'manual' ? 'manual' : 'qr',
    };
  });

  const auditRows = (auditRes.data as Record<string, unknown>[] | null) ?? [];
  const auditLogs: AdminCheckInAuditLogItem[] = auditRows.map((row) => ({
    id: pickString(row, ['id']),
    action: pickString(row, ['action']) === 'REVERSED' ? 'REVERSED' : 'CHECKED_IN',
    ticketId: pickString(row, ['ticket_id']),
    registrationId: pickString(row, ['registration_id']),
    registrationCode: pickString(row, ['registration_code']),
    performedByEmail: pickString(row, ['performed_by_email']),
    performedByRole: pickString(row, ['performed_by_role']) === 'admin' ? 'admin' : 'staff',
    originalCheckedInAt: pickOptionalString(row, ['original_checked_in_at']),
    reason: pickOptionalString(row, ['reason']),
    createdAt: pickString(row, ['created_at']),
  }));

  return {
    stats: {
      totalValidTickets,
      checkedInCount,
      remainingCount,
      checkInRatePercent,
    },
    checkedInTickets,
    auditLogs,
  };
}

export async function reverseTicketCheckin(params: {
  ticketId: string;
  reason: string;
  admin: VerifiedAdminActor;
}): Promise<{
  reversed: boolean;
  ticketId: string;
  message: string;
}> {
  const cleanTicketId = params.ticketId.trim().toUpperCase();
  const cleanReason = params.reason.trim();

  if (!cleanTicketId) {
    throw new ApiHttpError(400, 'Ticket ID is required to reverse a check-in.', 'VALIDATION_ERROR');
  }
  if (cleanReason.length < 3) {
    throw new ApiHttpError(
      400,
      'Provide a brief reason (minimum 3 characters) for reversing this check-in.',
      'VALIDATION_ERROR'
    );
  }

  const supabase = getSupabaseAdminClient();

  const rpcRes = await supabase.rpc('reverse_ticket_checkin_atomic', {
    p_ticket_id: cleanTicketId,
    p_admin_user_id: params.admin.userId,
    p_admin_email: params.admin.email,
    p_reason: cleanReason.slice(0, 300),
  });

  assertStaffRpcReady(rpcRes.error, 'reverse_ticket_checkin_atomic');
  if (rpcRes.error || !rpcRes.data || typeof rpcRes.data !== 'object') {
    throw new ApiHttpError(
      500,
      `Unable to reverse check-in: ${rpcRes.error?.message || 'Database error'}`,
      'DB_DELETE_ERROR'
    );
  }

  const rpcPayload = rpcRes.data as Record<string, unknown>;
  if (rpcPayload.not_found === true || rpcPayload.reversed !== true) {
    throw new ApiHttpError(
      404,
      'No active check-in record found for this ticket ID (it may already have been reversed).',
      'NOT_FOUND'
    );
  }

  return {
    reversed: true,
    ticketId: cleanTicketId,
    message: `Check-in for ${cleanTicketId} was reversed and recorded in the audit log.`,
  };
}
