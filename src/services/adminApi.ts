import { User } from '@supabase/supabase-js';
import { getSupabaseClient } from '../lib/supabaseClient';
import {
  AdminAnalyticsSummary,
  AdminDashboardPayload,
  AdminDashboardStats,
  AdminPaymentSubmissionRecord,
  AdminRegistrationRecord,
  AdminUserRecord,
  CanonicalPaymentStatus,
  RegistrationGrowthMetrics,
  RegistrationTimeBucket,
  TierBreakdownItem,
} from '../types/admin';
import {
  AUDIENCE_PASS_FEE_INR,
  ENTRY_PASS_OPTIONS,
  EntryPassTierId,
  ParticipationCategory,
  RegistrationType,
} from '../types/registration';

export type AdminApiErrorCode =
  | 'NOT_CONFIGURED'
  | 'UNAUTHENTICATED'
  | 'ACCESS_DENIED'
  | 'RLS_FORBIDDEN'
  | 'QUERY_ERROR'
  | 'STORAGE_ERROR';

export class AdminApiError extends Error {
  readonly code: AdminApiErrorCode;
  readonly details?: string;

  constructor(message: string, code: AdminApiErrorCode, details?: string) {
    super(message);
    this.name = 'AdminApiError';
    this.code = code;
    this.details = details;
  }
}

function isUndefinedColumnError(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false;
  return (
    err.code === '42703' ||
    err.code === 'PGRST204' ||
    /column .* does not exist/i.test(err.message ?? '')
  );
}

function isRlsOrPermissionError(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false;
  return (
    err.code === '42501' ||
    /permission denied|row-level security|not authorized|insufficient privilege/i.test(
      err.message ?? ''
    )
  );
}

function isConstraintOrEnumError(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false;
  return (
    err.code === '22P02' ||
    err.code === '23514' ||
    /invalid input value for enum|violates check constraint/i.test(err.message ?? '')
  );
}

function pickString(row: Record<string, unknown>, keys: string[], fallback = ''): string {
  for (const key of keys) {
    const val = row[key];
    if (typeof val === 'string' && val.trim().length > 0) {
      return val.trim();
    }
    if (typeof val === 'number' && Number.isFinite(val)) {
      return String(val);
    }
  }
  return fallback;
}

function pickOptionalString(row: Record<string, unknown>, keys: string[]): string | undefined {
  const val = pickString(row, keys, '');
  return val.length > 0 ? val : undefined;
}

function pickNumber(row: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const val = row[key];
    if (typeof val === 'number' && Number.isFinite(val)) {
      return val;
    }
    if (typeof val === 'string' && val.trim().length > 0) {
      const parsed = Number(val.trim());
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }
  return null;
}

function normalizeEntryType(raw: string): EntryPassTierId {
  const lower = raw.trim().toLowerCase();
  if (lower === 'couple' || lower === 'duo') return 'couple';
  if (lower === 'group' || lower === 'team') return 'group';
  return 'individual';
}

function resolveRegistrationType(
  row: Record<string, unknown>,
  fallback: RegistrationType = 'PARTICIPANT'
): RegistrationType {
  const raw = row.registration_type;
  if (typeof raw === 'string') {
    const upper = raw.trim().toUpperCase();
    if (upper === 'AUDIENCE') return 'AUDIENCE';
    if (upper === 'PARTICIPANT') return 'PARTICIPANT';
  }
  return fallback;
}

function normalizeCategories(raw: unknown): {
  categories: ParticipationCategory[];
  display: string;
} {
  let items: string[] = [];

  if (Array.isArray(raw)) {
    items = raw.map((item) => String(item).trim()).filter(Boolean);
  } else if (typeof raw === 'string' && raw.trim().length > 0) {
    const trimmed = raw.trim();
    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          items = parsed.map((item) => String(item).trim()).filter(Boolean);
        }
      } catch {
        items = trimmed.split(/[,;|]+/).map((s) => s.trim()).filter(Boolean);
      }
    } else {
      items = trimmed.split(/[,;|]+/).map((s) => s.trim()).filter(Boolean);
    }
  }

  const canonical: ParticipationCategory[] = [];
  for (const item of items) {
    const lower = item.toLowerCase();
    if (lower.includes('dance') && !canonical.includes('Dance')) canonical.push('Dance');
    else if (lower.includes('sing') && !canonical.includes('Singing')) canonical.push('Singing');
    else if (lower.includes('poet') && !canonical.includes('Poetry')) canonical.push('Poetry');
  }

  return {
    categories: canonical,
    display: canonical.length > 0 ? canonical.join(', ') : items.join(', ') || '—',
  };
}

export function normalizePaymentStatus(rawStatus: string): CanonicalPaymentStatus {
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

function normalizeParticipantNames(raw: unknown): string {
  if (Array.isArray(raw)) {
    return raw.map((item) => String(item).trim()).filter(Boolean).join(', ');
  }
  if (typeof raw === 'string') {
    return raw.trim();
  }
  return '';
}

function detectExistingColumn(row: Record<string, unknown>, candidates: string[]): string | null {
  for (const candidate of candidates) {
    if (Object.prototype.hasOwnProperty.call(row, candidate)) {
      return candidate;
    }
  }
  return null;
}

/**
 * Verifies that the authenticated Supabase user exists in `admin_users` and is active.
 * Always queries Supabase with the current user's session — never trusts client state.
 */
export async function verifyAdminMembership(user: User): Promise<AdminUserRecord> {
  const supabase = getSupabaseClient();

  let row: Record<string, unknown> | null = null;
  let queryError: { code?: string; message?: string } | null = null;

  const byUserId = await supabase
    .from('admin_users')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  if (byUserId.error && isUndefinedColumnError(byUserId.error)) {
    const byId = await supabase
      .from('admin_users')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();
    row = (byId.data as Record<string, unknown> | null) ?? null;
    queryError = byId.error;
  } else {
    row = (byUserId.data as Record<string, unknown> | null) ?? null;
    queryError = byUserId.error;
  }

  if (queryError) {
    if (isRlsOrPermissionError(queryError)) {
      throw new AdminApiError(
        'Access denied: your account is not authorized to verify admin membership.',
        'ACCESS_DENIED',
        queryError.message
      );
    }
    throw new AdminApiError(
      'Unable to verify admin privileges with Supabase.',
      'QUERY_ERROR',
      queryError.message
    );
  }

  if (!row) {
    throw new AdminApiError(
      'Access denied: this authenticated account is not listed in admin_users.',
      'ACCESS_DENIED'
    );
  }

  const matchedUuid = pickString(row, ['user_id', 'id'], '');
  if (matchedUuid !== user.id) {
    throw new AdminApiError(
      'Access denied: admin record mismatch.',
      'ACCESS_DENIED'
    );
  }

  if (
    (typeof row.is_active === 'boolean' && !row.is_active) ||
    (typeof row.active === 'boolean' && !row.active)
  ) {
    throw new AdminApiError(
      'Access denied: this admin account is currently disabled.',
      'ACCESS_DENIED'
    );
  }

  const role = pickString(row, ['role'], 'Admin');
  if (role.toLowerCase() === 'revoked' || role.toLowerCase() === 'disabled') {
    throw new AdminApiError(
      'Access denied: this admin account has been revoked.',
      'ACCESS_DENIED'
    );
  }

  return {
    uuid: user.id,
    email: pickString(row, ['email'], user.email ?? ''),
    fullName: pickString(row, ['full_name', 'name', 'display_name'], user.email ?? 'Admin'),
    role,
    isActive: true,
    raw: row,
  };
}

export async function getCurrentVerifiedAdmin(): Promise<AdminUserRecord | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    return null;
  }

  try {
    return await verifyAdminMembership(data.user);
  } catch (err) {
    if (err instanceof AdminApiError && err.code === 'ACCESS_DENIED') {
      await supabase.auth.signOut();
    }
    throw err;
  }
}

export async function signInAdminWithPassword(
  email: string,
  password: string
): Promise<AdminUserRecord> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });

  if (error) {
    throw new AdminApiError(
      error.message || 'Invalid email or password.',
      'UNAUTHENTICATED'
    );
  }

  if (!data.user) {
    throw new AdminApiError(
      'Authentication failed: no user session returned.',
      'UNAUTHENTICATED'
    );
  }

  try {
    return await verifyAdminMembership(data.user);
  } catch (err) {
    if (err instanceof AdminApiError && err.code === 'ACCESS_DENIED') {
      await supabase.auth.signOut();
    }
    throw err;
  }
}

export async function signOutAdminSession(): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.auth.signOut();
  if (error) {
    throw new AdminApiError('Unable to sign out cleanly.', 'QUERY_ERROR', error.message);
  }
}

const SUPABASE_PAGE_SIZE = 1000;

async function selectAllTableRows(
  table: 'registrations' | 'payment_submissions'
): Promise<Record<string, unknown>[]> {
  const supabase = getSupabaseClient();
  const allRows: Record<string, unknown>[] = [];
  let useCreatedAtOrder = true;
  let offset = 0;

  while (true) {
    const query = supabase.from(table).select('*');
    const res = useCreatedAtOrder
      ? await query
          .order('created_at', { ascending: false })
          .range(offset, offset + SUPABASE_PAGE_SIZE - 1)
      : await query.range(offset, offset + SUPABASE_PAGE_SIZE - 1);

    if (res.error) {
      if (useCreatedAtOrder && isUndefinedColumnError(res.error)) {
        useCreatedAtOrder = false;
        allRows.length = 0;
        offset = 0;
        continue;
      }

      if (isRlsOrPermissionError(res.error)) {
        throw new AdminApiError(
          `Database permission denied while reading ${table}. Check your Supabase RLS policies for admin_users.`,
          'RLS_FORBIDDEN',
          res.error.message
        );
      }

      throw new AdminApiError(
        `Failed to fetch ${table}: ${res.error.message}`,
        'QUERY_ERROR',
        res.error.message
      );
    }

    const batch = (res.data as Record<string, unknown>[] | null) ?? [];
    allRows.push(...batch);

    if (batch.length < SUPABASE_PAGE_SIZE) {
      break;
    }
    offset += SUPABASE_PAGE_SIZE;
  }

  return allRows;
}

export async function fetchAdminDashboardData(): Promise<AdminDashboardPayload> {
  const admin = await getCurrentVerifiedAdmin();
  if (!admin) {
    throw new AdminApiError('Please sign in to access the dashboard.', 'UNAUTHENTICATED');
  }

  const [rawRegistrations, rawSubmissions] = await Promise.all([
    selectAllTableRows('registrations'),
    selectAllTableRows('payment_submissions'),
  ]);

  const warnings: string[] = [];

  // Index registrations by both id and registration_code for joining with payment_submissions
  const regById = new Map<string, Record<string, unknown>>();
  const regByCode = new Map<string, Record<string, unknown>>();
  for (const row of rawRegistrations) {
    const id = pickString(row, ['id', 'registration_id']);
    const code = pickString(row, ['registration_code', 'reference_id', 'code']);
    if (id) regById.set(id, row);
    if (code) regByCode.set(code, row);
  }

  // Normalize payment_submissions
  const normalizedSubmissions: AdminPaymentSubmissionRecord[] = rawSubmissions.map((row) => {
    const id = pickString(row, ['id', 'submission_id']);
    const registrationId = pickString(row, ['registration_id']);
    const linkedReg =
      (registrationId ? regById.get(registrationId) : undefined) ??
      regByCode.get(pickString(row, ['registration_code', 'reference_id']));

    const linkedRegType: RegistrationType = linkedReg
      ? resolveRegistrationType(linkedReg, 'PARTICIPANT')
      : 'PARTICIPANT';
    const registrationType = resolveRegistrationType(row, linkedRegType);

    const entryType = normalizeEntryType(
      pickString(
        row,
        ['entry_type', 'participation_type', 'pass_type'],
        linkedReg ? pickString(linkedReg, ['entry_type', 'participation_type', 'pass_type']) : ''
      )
    );

    const dbAmount =
      pickNumber(row, ['amount', 'amount_inr', 'expected_fee_inr', 'fee_inr', 'amount_paid']) ??
      (linkedReg
        ? pickNumber(linkedReg, ['amount', 'amount_inr', 'expected_fee_inr', 'fee_inr', 'amount_paid'])
        : null);

    const rawStatus = pickString(
      row,
      ['verification_status', 'status', 'payment_status'],
      'pending'
    );

    const proofPath = pickString(row, [
      'proof_storage_path',
      'proof_path',
      'storage_path',
      'file_path',
      'proof_file_path',
      'object_path',
      'proof_url',
      'file_url',
      'screenshot_path',
    ]);

    return {
      id,
      registrationId:
        registrationId || (linkedReg ? pickString(linkedReg, ['id', 'registration_id']) : ''),
      registrationCode: pickString(
        row,
        ['registration_code', 'reference_id'],
        linkedReg ? pickString(linkedReg, ['registration_code', 'reference_id', 'id']) : registrationId
      ),
      registrationType,
      participantName: pickString(
        row,
        ['full_name', 'participant_name', 'name'],
        linkedReg ? pickString(linkedReg, ['full_name', 'participant_name', 'name'], 'Unknown') : 'Unknown'
      ),
      teamOrIndividualName: pickString(
        row,
        ['team_or_individual_name', 'team_name'],
        linkedReg ? pickString(linkedReg, ['team_or_individual_name', 'team_name'], '—') : '—'
      ),
      email: pickString(
        row,
        ['email'],
        linkedReg ? pickString(linkedReg, ['email'], '—') : '—'
      ),
      mobileNumber: pickString(
        row,
        ['mobile_number', 'phone', 'mobile'],
        linkedReg ? pickString(linkedReg, ['mobile_number', 'phone', 'mobile'], '—') : '—'
      ),
      collegeName: pickString(
        row,
        ['college_name', 'college'],
        linkedReg ? pickString(linkedReg, ['college_name', 'college'], '—') : '—'
      ),
      entryType,
      amountInr:
        dbAmount ??
        (registrationType === 'AUDIENCE'
          ? AUDIENCE_PASS_FEE_INR
          : ENTRY_PASS_OPTIONS[entryType].price),
      utr: pickString(row, ['utr', 'transaction_id', 'utr_number', 'upi_ref'], '—'),
      proofPath,
      proofMimeType: pickString(row, ['mime_type', 'proof_mime_type', 'content_type', 'file_type']),
      proofFileName: pickString(
        row,
        ['file_name', 'original_filename', 'proof_file_name'],
        proofPath ? proofPath.split('/').pop() || 'payment-proof' : 'payment-proof'
      ),
      submittedAt: pickString(row, ['created_at', 'submitted_at', 'updated_at']),
      status: normalizePaymentStatus(rawStatus),
      rawStatus,
      adminRemarks: pickString(row, ['admin_remarks', 'remarks', 'reviewer_notes', 'notes']),
      verifiedAt: pickOptionalString(row, ['verified_at', 'reviewed_at']),
      verifiedBy: pickOptionalString(row, ['verified_by', 'reviewed_by']),
      raw: row,
    };
  });

  // Sort submissions newest first
  normalizedSubmissions.sort((a, b) => {
    const timeA = a.submittedAt ? new Date(a.submittedAt).getTime() : 0;
    const timeB = b.submittedAt ? new Date(b.submittedAt).getTime() : 0;
    return timeB - timeA;
  });

  // Index latest submission per registrationId
  const latestSubByRegId = new Map<string, AdminPaymentSubmissionRecord>();
  for (const sub of normalizedSubmissions) {
    if (sub.registrationId && !latestSubByRegId.has(sub.registrationId)) {
      latestSubByRegId.set(sub.registrationId, sub);
    }
  }

  // Normalize registrations
  const normalizedRegistrations: AdminRegistrationRecord[] = rawRegistrations.map((row) => {
    const id = pickString(row, ['id', 'registration_id']);
    const registrationCode = pickString(row, ['registration_code', 'reference_id', 'code'], id);
    const latestSub = latestSubByRegId.get(id) ?? latestSubByRegId.get(registrationCode);

    const registrationType = resolveRegistrationType(
      row,
      latestSub?.registrationType ?? 'PARTICIPANT'
    );

    const entryType = normalizeEntryType(
      pickString(row, ['entry_type', 'participation_type', 'pass_type'], 'individual')
    );

    const dbAmount = pickNumber(row, [
      'amount',
      'amount_inr',
      'expected_fee_inr',
      'fee_inr',
      'amount_paid',
    ]);
    const amountInr =
      dbAmount ??
      latestSub?.amountInr ??
      (registrationType === 'AUDIENCE'
        ? AUDIENCE_PASS_FEE_INR
        : ENTRY_PASS_OPTIONS[entryType].price);

    const { categories, display } = normalizeCategories(
      row.categories ?? row.category ?? row.participation_categories
    );

    const ownRawStatus = pickOptionalString(row, [
      'payment_status',
      'status',
      'verification_status',
    ]);
    const ownNormalizedStatus = ownRawStatus ? normalizePaymentStatus(ownRawStatus) : null;

    // Reconcile status: if registration has no status or is still default 'pending'
    // while its latest payment submission has been explicitly verified or rejected, reflect the submission decision.
    const effectiveRawStatus =
      !ownRawStatus || (ownNormalizedStatus === 'pending' && latestSub && latestSub.status !== 'pending')
        ? latestSub?.rawStatus ?? ownRawStatus ?? 'pending'
        : ownRawStatus;

    const fullName = pickString(row, ['full_name', 'participant_name', 'name'], '—');

    return {
      id,
      registrationCode,
      registrationType,
      fullName,
      email: pickString(row, ['email'], '—'),
      mobileNumber: pickString(row, ['mobile_number', 'phone', 'mobile'], '—'),
      collegeName: pickString(row, ['college_name', 'college'], '—'),
      city: pickString(row, ['city'], '—'),
      categories: registrationType === 'AUDIENCE' ? [] : categories,
      categoriesDisplay:
        registrationType === 'AUDIENCE'
          ? 'Watch Only (No Stage Performance Rights)'
          : display,
      entryType,
      teamOrIndividualName: pickString(
        row,
        ['team_or_individual_name', 'team_name', 'stage_name'],
        registrationType === 'AUDIENCE' ? fullName : '—'
      ),
      participantCount:
        registrationType === 'AUDIENCE'
          ? 1
          : pickNumber(row, ['participant_count', 'team_size']) ??
            ENTRY_PASS_OPTIONS[entryType].fixedParticipantCount ??
            1,
      participantNames:
        registrationType === 'AUDIENCE'
          ? fullName
          : normalizeParticipantNames(row.participant_names ?? row.members ?? row.participants),
      teamLeaderName:
        registrationType === 'AUDIENCE'
          ? '—'
          : pickString(row, ['team_leader_name', 'team_leader', 'leader_name'], '—'),
      emergencyContactNumber: pickString(
        row,
        ['emergency_contact_number', 'emergency_contact'],
        '—'
      ),
      amountInr,
      createdAt: pickString(row, ['created_at', 'registered_at', 'registration_date']),
      paymentStatus: normalizePaymentStatus(effectiveRawStatus),
      rawPaymentStatus: effectiveRawStatus,
      utr: pickString(
        row,
        ['utr', 'transaction_id', 'utr_number', 'upi_ref'],
        latestSub?.utr ?? '—'
      ),
      adminRemarks: pickString(
        row,
        ['admin_remarks', 'remarks', 'notes'],
        latestSub?.adminRemarks ?? ''
      ),
      verifiedAt:
        pickOptionalString(row, ['verified_at', 'reviewed_at']) ?? latestSub?.verifiedAt,
      verifiedBy:
        pickOptionalString(row, ['verified_by', 'reviewed_by']) ?? latestSub?.verifiedBy,
      latestSubmissionId: latestSub?.id,
      proofPath:
        pickOptionalString(row, ['proof_storage_path', 'proof_path', 'storage_path', 'file_path']) ??
        latestSub?.proofPath,
      proofMimeType:
        pickOptionalString(row, ['proof_mime_type', 'mime_type']) ?? latestSub?.proofMimeType,
      proofFileName:
        pickOptionalString(row, ['proof_file_name', 'file_name']) ?? latestSub?.proofFileName,
      raw: row,
    };
  });

  // Sort registrations newest first
  normalizedRegistrations.sort((a, b) => {
    const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return timeB - timeA;
  });

  // Deduplicated verified revenue calculation (prevents double-counting across
  // multiple payment_submissions for the same registration or across both tables).
  const verifiedPaymentByRegKey = new Map<
    string,
    { amountInr: number; entryType: EntryPassTierId; registrationType: RegistrationType }
  >();

  for (const sub of normalizedSubmissions) {
    if (sub.status !== 'verified') continue;
    const dedupKey = sub.registrationId || sub.registrationCode || `sub:${sub.id}`;
    if (!verifiedPaymentByRegKey.has(dedupKey)) {
      verifiedPaymentByRegKey.set(dedupKey, {
        amountInr: Number.isFinite(sub.amountInr) ? sub.amountInr : 0,
        entryType: sub.entryType,
        registrationType: sub.registrationType,
      });
    }
  }

  for (const reg of normalizedRegistrations) {
    if (reg.paymentStatus !== 'verified') continue;
    const alreadyCounted =
      (reg.id && verifiedPaymentByRegKey.has(reg.id)) ||
      (reg.registrationCode && verifiedPaymentByRegKey.has(reg.registrationCode));
    if (!alreadyCounted) {
      const dedupKey = reg.id || reg.registrationCode;
      verifiedPaymentByRegKey.set(dedupKey, {
        amountInr: Number.isFinite(reg.amountInr) ? reg.amountInr : 0,
        entryType: reg.entryType,
        registrationType: reg.registrationType,
      });
    }
  }

  let totalVerifiedAmountInr = 0;
  let participantVerifiedAmountInr = 0;
  let audienceVerifiedAmountInr = 0;
  for (const entry of verifiedPaymentByRegKey.values()) {
    totalVerifiedAmountInr += entry.amountInr;
    if (entry.registrationType === 'AUDIENCE') {
      audienceVerifiedAmountInr += entry.amountInr;
    } else {
      participantVerifiedAmountInr += entry.amountInr;
    }
  }

  const pendingSubmissionCount = normalizedSubmissions.filter(
    (s) => s.status === 'pending'
  ).length;
  const verifiedSubmissionCount = normalizedSubmissions.filter(
    (s) => s.status === 'verified'
  ).length;
  const rejectedSubmissionCount = normalizedSubmissions.filter(
    (s) => s.status === 'rejected'
  ).length;
  const totalSubmissionCount = normalizedSubmissions.length;

  const pendingRegCount = normalizedRegistrations.filter(
    (r) => r.paymentStatus === 'pending'
  ).length;
  const verifiedRegCount = normalizedRegistrations.filter(
    (r) => r.paymentStatus === 'verified'
  ).length;
  const rejectedRegCount = normalizedRegistrations.filter(
    (r) => r.paymentStatus === 'rejected'
  ).length;

  const participantRegs = normalizedRegistrations.filter(
    (r) => r.registrationType === 'PARTICIPANT'
  );
  const audienceRegs = normalizedRegistrations.filter(
    (r) => r.registrationType === 'AUDIENCE'
  );

  const stats: AdminDashboardStats = {
    totalRegistrations: normalizedRegistrations.length,
    participantCount: participantRegs.length,
    audienceCount: audienceRegs.length,
    participantVerifiedCount: participantRegs.filter((r) => r.paymentStatus === 'verified').length,
    audienceVerifiedCount: audienceRegs.filter((r) => r.paymentStatus === 'verified').length,
    participantPendingCount: participantRegs.filter((r) => r.paymentStatus === 'pending').length,
    audiencePendingCount: audienceRegs.filter((r) => r.paymentStatus === 'pending').length,
    participantVerifiedAmountInr,
    audienceVerifiedAmountInr,
    individualCount: participantRegs.filter((r) => r.entryType === 'individual').length,
    coupleCount: participantRegs.filter((r) => r.entryType === 'couple').length,
    groupCount: participantRegs.filter((r) => r.entryType === 'group').length,
    pendingCount: totalSubmissionCount > 0 ? pendingSubmissionCount : pendingRegCount,
    verifiedCount: totalSubmissionCount > 0 ? verifiedSubmissionCount : verifiedRegCount,
    rejectedCount: totalSubmissionCount > 0 ? rejectedSubmissionCount : rejectedRegCount,
    totalVerifiedAmountInr,
    pendingSubmissionCount,
    verifiedSubmissionCount,
    rejectedSubmissionCount,
    totalSubmissionCount,
    verifiedUniqueRegistrationCount: verifiedPaymentByRegKey.size,
    verificationRatePercent:
      totalSubmissionCount > 0
        ? Math.round((verifiedSubmissionCount / totalSubmissionCount) * 100)
        : null,
  };

  const analytics = buildRegistrationAndPaymentAnalytics(
    normalizedRegistrations,
    verifiedPaymentByRegKey
  );

  return {
    registrations: normalizedRegistrations,
    submissions: normalizedSubmissions,
    stats,
    analytics,
    warnings,
    fetchedAt: new Date().toISOString(),
  };
}

function toLocalDayKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function toLocalMonthKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function buildTimeSeries(
  registrations: AdminRegistrationRecord[],
  verifiedPaymentByRegKey: Map<
    string,
    { amountInr: number; entryType: EntryPassTierId; registrationType: RegistrationType }
  >,
  granularity: 'day' | 'month'
): RegistrationTimeBucket[] {
  const bucketMap = new Map<
    string,
    { label: string; count: number; verifiedRevenueInr: number }
  >();

  for (const reg of registrations) {
    if (!reg.createdAt) continue;
    const date = new Date(reg.createdAt);
    if (Number.isNaN(date.getTime())) continue;

    const key = granularity === 'day' ? toLocalDayKey(date) : toLocalMonthKey(date);
    const label =
      granularity === 'day'
        ? new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short' }).format(date)
        : new Intl.DateTimeFormat('en-IN', { month: 'short', year: 'numeric' }).format(date);

    const existing = bucketMap.get(key) ?? { label, count: 0, verifiedRevenueInr: 0 };
    existing.count += 1;

    if (reg.paymentStatus === 'verified') {
      const verifiedEntry =
        (reg.id ? verifiedPaymentByRegKey.get(reg.id) : undefined) ??
        (reg.registrationCode ? verifiedPaymentByRegKey.get(reg.registrationCode) : undefined);
      existing.verifiedRevenueInr += verifiedEntry?.amountInr ?? reg.amountInr;
    }

    bucketMap.set(key, existing);
  }

  const sortedKeys = Array.from(bucketMap.keys()).sort((a, b) => a.localeCompare(b));
  let cumulative = 0;

  return sortedKeys.map((key) => {
    const item = bucketMap.get(key)!;
    cumulative += item.count;
    return {
      key,
      label: item.label,
      count: item.count,
      cumulativeCount: cumulative,
      verifiedRevenueInr: item.verifiedRevenueInr,
    };
  });
}

function buildRegistrationAndPaymentAnalytics(
  registrations: AdminRegistrationRecord[],
  verifiedPaymentByRegKey: Map<
    string,
    { amountInr: number; entryType: EntryPassTierId; registrationType: RegistrationType }
  >
): AdminAnalyticsSummary {
  const dailySeries = buildTimeSeries(registrations, verifiedPaymentByRegKey, 'day');
  const monthlySeries = buildTimeSeries(registrations, verifiedPaymentByRegKey, 'month');

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const sevenDaysAgoStart = todayStart - 6 * 24 * 60 * 60 * 1000;
  const fourteenDaysAgoStart = todayStart - 13 * 24 * 60 * 60 * 1000;

  let todayCount = 0;
  let last7DaysCount = 0;
  let previous7DaysCount = 0;

  for (const reg of registrations) {
    if (!reg.createdAt) continue;
    const ts = new Date(reg.createdAt).getTime();
    if (Number.isNaN(ts)) continue;
    if (ts >= todayStart) todayCount += 1;
    if (ts >= sevenDaysAgoStart) last7DaysCount += 1;
    else if (ts >= fourteenDaysAgoStart && ts < sevenDaysAgoStart) previous7DaysCount += 1;
  }

  const growthDeltaCount = last7DaysCount - previous7DaysCount;
  const growthDeltaPercent =
    previous7DaysCount > 0
      ? Math.round((growthDeltaCount / previous7DaysCount) * 100)
      : null;

  const growth: RegistrationGrowthMetrics = {
    todayCount,
    last7DaysCount,
    previous7DaysCount,
    growthDeltaCount,
    growthDeltaPercent,
  };

  const tiers: EntryPassTierId[] = ['individual', 'couple', 'group'];
  const tierBreakdown: TierBreakdownItem[] = tiers.map((tier) => {
    const tierRegs = registrations.filter(
      (r) => r.registrationType === 'PARTICIPANT' && r.entryType === tier
    );
    let verifiedCount = 0;
    let verifiedRevenueInr = 0;
    for (const entry of verifiedPaymentByRegKey.values()) {
      if (entry.registrationType === 'PARTICIPANT' && entry.entryType === tier) {
        verifiedCount += 1;
        verifiedRevenueInr += entry.amountInr;
      }
    }
    return {
      key: tier,
      registrationType: 'PARTICIPANT',
      entryType: tier,
      label: ENTRY_PASS_OPTIONS[tier].label,
      totalCount: tierRegs.length,
      verifiedCount,
      verifiedRevenueInr,
    };
  });

  const audienceRegs = registrations.filter((r) => r.registrationType === 'AUDIENCE');
  let audienceVerifiedCount = 0;
  let audienceVerifiedRevenueInr = 0;
  for (const entry of verifiedPaymentByRegKey.values()) {
    if (entry.registrationType === 'AUDIENCE') {
      audienceVerifiedCount += 1;
      audienceVerifiedRevenueInr += entry.amountInr;
    }
  }
  tierBreakdown.push({
    key: 'audience',
    registrationType: 'AUDIENCE',
    entryType: 'individual',
    label: 'AUDIENCE PASS (₹59)',
    totalCount: audienceRegs.length,
    verifiedCount: audienceVerifiedCount,
    verifiedRevenueInr: audienceVerifiedRevenueInr,
  });

  return {
    dailySeries,
    monthlySeries,
    growth,
    tierBreakdown,
  };
}

/**
 * Normalizes a stored path into the relative object key inside private bucket `payment-proofs`
 * and generates a short-lived authenticated signed URL (5 minutes).
 */
export function normalizeProofObjectPath(rawPath: string): string {
  let clean = rawPath.trim();
  if (!clean) return '';

  // If a full Supabase storage URL was stored, extract the object path after /payment-proofs/
  const bucketMarker = '/payment-proofs/';
  const markerIdx = clean.indexOf(bucketMarker);
  if (markerIdx !== -1) {
    clean = clean.slice(markerIdx + bucketMarker.length);
  }

  // Strip query strings if any were appended
  const queryIdx = clean.indexOf('?');
  if (queryIdx !== -1) {
    clean = clean.slice(0, queryIdx);
  }

  // Strip leading slashes or redundant bucket prefix
  clean = clean.replace(/^\/+/, '');
  if (clean.startsWith('payment-proofs/')) {
    clean = clean.slice('payment-proofs/'.length);
  }

  return clean;
}

export async function getSignedPaymentProofUrl(rawPath: string): Promise<string> {
  const admin = await getCurrentVerifiedAdmin();
  if (!admin) {
    throw new AdminApiError('Authentication required to view payment proofs.', 'UNAUTHENTICATED');
  }

  const objectPath = normalizeProofObjectPath(rawPath);
  if (!objectPath) {
    throw new AdminApiError('No payment proof file path recorded for this submission.', 'STORAGE_ERROR');
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase.storage
    .from('payment-proofs')
    .createSignedUrl(objectPath, 300);

  if (error || !data?.signedUrl) {
    if (isRlsOrPermissionError(error)) {
      throw new AdminApiError(
        'Storage permission denied for bucket payment-proofs. Ensure your Storage RLS policy grants SELECT to admin_users.',
        'RLS_FORBIDDEN',
        error?.message
      );
    }
    throw new AdminApiError(
      error?.message || 'Unable to generate secure signed URL for payment proof.',
      'STORAGE_ERROR',
      error?.message
    );
  }

  try {
    const parsed = new URL(data.signedUrl);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      throw new Error('Invalid URL protocol');
    }
  } catch {
    throw new AdminApiError('Received an invalid signed URL from Supabase Storage.', 'STORAGE_ERROR');
  }

  return data.signedUrl;
}

function resolveStatusValueCandidates(
  decision: 'verified' | 'rejected',
  sampleRawStatus: string
): string[] {
  const isUpper = sampleRawStatus && sampleRawStatus === sampleRawStatus.toUpperCase();
  if (decision === 'verified') {
    return isUpper
      ? ['VERIFIED', 'verified', 'confirmed', 'CONFIRMED', 'approved', 'paid']
      : ['verified', 'VERIFIED', 'confirmed', 'CONFIRMED', 'approved', 'paid'];
  }
  return isUpper
    ? ['REJECTED', 'rejected', 'declined', 'failed']
    : ['rejected', 'REJECTED', 'declined', 'failed'];
}

export interface UpdateVerificationParams {
  submission: AdminPaymentSubmissionRecord;
  decision: 'verified' | 'rejected';
  remarks: string;
}

export interface UpdateVerificationOutcome {
  submissionUpdated: boolean;
  registrationSynced: boolean;
  warning?: string;
}

export async function updatePaymentVerificationStatus({
  submission,
  decision,
  remarks,
}: UpdateVerificationParams): Promise<UpdateVerificationOutcome> {
  const admin = await getCurrentVerifiedAdmin();
  if (!admin) {
    throw new AdminApiError('Session expired. Please sign in again.', 'UNAUTHENTICATED');
  }

  const supabase = getSupabaseClient();
  const nowIso = new Date().toISOString();
  const trimmedRemarks = remarks.trim();

  const statusCol =
    detectExistingColumn(submission.raw, ['verification_status', 'status', 'payment_status']) ??
    'status';
  const remarksCol = detectExistingColumn(submission.raw, [
    'admin_remarks',
    'remarks',
    'reviewer_notes',
    'notes',
  ]);
  const verifiedByCol = detectExistingColumn(submission.raw, ['verified_by', 'reviewed_by']);
  const verifiedAtCol = detectExistingColumn(submission.raw, ['verified_at', 'reviewed_at']);
  const updatedAtCol = detectExistingColumn(submission.raw, ['updated_at']);

  const statusCandidates = resolveStatusValueCandidates(decision, submission.rawStatus);
  let lastError: { code?: string; message?: string } | null = null;
  let updatedSubmissionRow: Record<string, unknown> | null = null;

  for (const statusValue of statusCandidates) {
    const payload: Record<string, unknown> = {
      [statusCol]: statusValue,
    };

    if (remarksCol) {
      payload[remarksCol] = trimmedRemarks || null;
    }
    if (verifiedByCol) {
      payload[verifiedByCol] = admin.uuid;
    }
    if (verifiedAtCol) {
      payload[verifiedAtCol] = nowIso;
    }
    if (updatedAtCol) {
      payload[updatedAtCol] = nowIso;
    }

    const subIdCol = detectExistingColumn(submission.raw, ['id', 'submission_id']) ?? 'id';
    const res = await supabase
      .from('payment_submissions')
      .update(payload)
      .eq(subIdCol, submission.id)
      .select()
      .maybeSingle();

    if (!res.error) {
      updatedSubmissionRow = (res.data as Record<string, unknown> | null) ?? null;
      lastError = null;
      break;
    }

    lastError = res.error;
    if (isRlsOrPermissionError(res.error)) {
      throw new AdminApiError(
        'Permission denied: your database RLS policy blocked updating payment_submissions.',
        'RLS_FORBIDDEN',
        res.error.message
      );
    }

    if (!isConstraintOrEnumError(res.error)) {
      throw new AdminApiError(
        `Unable to update payment submission: ${res.error.message}`,
        'QUERY_ERROR',
        res.error.message
      );
    }
  }

  if (lastError) {
    throw new AdminApiError(
      `Database rejected verification status value: ${lastError.message}`,
      'QUERY_ERROR',
      lastError.message
    );
  }

  if (!updatedSubmissionRow) {
    throw new AdminApiError(
      'Update did not modify any row. Verify that an UPDATE RLS policy exists on payment_submissions for admin_users.',
      'RLS_FORBIDDEN'
    );
  }

  // Attempt to sync linked registration row if registrationId is present
  let registrationSynced = false;
  let warning: string | undefined;

  if (submission.registrationId) {
    let regLookup = await supabase
      .from('registrations')
      .select('*')
      .eq('id', submission.registrationId)
      .maybeSingle();

    if (regLookup.error && isUndefinedColumnError(regLookup.error)) {
      regLookup = await supabase
        .from('registrations')
        .select('*')
        .eq('registration_id', submission.registrationId)
        .maybeSingle();
    }

    if (!regLookup.error && regLookup.data) {
      const regRow = regLookup.data as Record<string, unknown>;
      const regIdCol = detectExistingColumn(regRow, ['id', 'registration_id']) ?? 'id';
      const regStatusCol = detectExistingColumn(regRow, [
        'payment_status',
        'status',
        'verification_status',
      ]);

      if (regStatusCol) {
        const regRemarksCol = detectExistingColumn(regRow, ['admin_remarks', 'remarks', 'notes']);
        const regVerifiedAtCol = detectExistingColumn(regRow, ['verified_at', 'reviewed_at']);
        const regVerifiedByCol = detectExistingColumn(regRow, ['verified_by', 'reviewed_by']);
        const regUpdatedAtCol = detectExistingColumn(regRow, ['updated_at']);
        const regSample = pickString(regRow, [regStatusCol], submission.rawStatus);
        const regCandidates = resolveStatusValueCandidates(decision, regSample);

        for (const regStatusVal of regCandidates) {
          const regPayload: Record<string, unknown> = {
            [regStatusCol]: regStatusVal,
          };
          if (regRemarksCol) regPayload[regRemarksCol] = trimmedRemarks || null;
          if (regVerifiedAtCol) regPayload[regVerifiedAtCol] = nowIso;
          if (regVerifiedByCol) regPayload[regVerifiedByCol] = admin.uuid;
          if (regUpdatedAtCol) regPayload[regUpdatedAtCol] = nowIso;

          const regUpdate = await supabase
            .from('registrations')
            .update(regPayload)
            .eq(regIdCol, submission.registrationId)
            .select()
            .maybeSingle();

          if (!regUpdate.error && regUpdate.data) {
            registrationSynced = true;
            break;
          }
          if (regUpdate.error && !isConstraintOrEnumError(regUpdate.error)) {
            if (isRlsOrPermissionError(regUpdate.error)) {
              warning =
                'Payment submission updated, but registrations table lacks an admin UPDATE RLS policy (unless synced automatically by a database trigger).';
            }
            break;
          }
        }
      }
    }
  }

  return {
    submissionUpdated: true,
    registrationSynced,
    warning,
  };
}

function sanitizeCsvCell(value: unknown): string {
  const raw = value === null || value === undefined ? '' : String(value);
  // Prevent CSV formula injection in spreadsheet software
  const safe = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  if (/[",\n\r]/.test(safe)) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

export function exportRegistrationsCsv(records: AdminRegistrationRecord[], filenamePrefix = 'alfaaz-registrations'): void {
  const headers = [
    'Registration ID',
    'Registration Code',
    'Registration Type',
    'Full Name',
    'Email',
    'Mobile Number',
    'College',
    'City',
    'Participation Type',
    'Categories',
    'Team / Stage Name',
    'Participant Count',
    'Participant Names',
    'Team Leader',
    'Emergency Contact',
    'Amount (INR)',
    'Payment Status',
    'UTR / Transaction ID',
    'Admin Remarks',
    'Verified At',
    'Registration Date',
  ];

  const rows = records.map((rec) => [
    rec.id,
    rec.registrationCode,
    rec.registrationType,
    rec.fullName,
    rec.email,
    rec.mobileNumber,
    rec.collegeName,
    rec.city,
    rec.registrationType === 'AUDIENCE'
      ? 'Audience Pass (Watch Only)'
      : ENTRY_PASS_OPTIONS[rec.entryType].label,
    rec.categoriesDisplay,
    rec.teamOrIndividualName,
    rec.participantCount,
    rec.participantNames,
    rec.teamLeaderName,
    rec.emergencyContactNumber,
    rec.amountInr,
    rec.paymentStatus.toUpperCase(),
    rec.utr,
    rec.adminRemarks,
    rec.verifiedAt ?? '',
    rec.createdAt,
  ]);

  const csvContent =
    '\uFEFF' +
    [headers, ...rows].map((row) => row.map((cell) => sanitizeCsvCell(cell)).join(',')).join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const dateStamp = new Date().toISOString().slice(0, 10);
  link.href = url;
  link.setAttribute('download', `${filenamePrefix}-${dateStamp}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
