import { randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  ApiHttpError,
  detectProofFileType,
  type NodeHttpRequest,
  type ParsedUploadedFile,
} from './httpUtils.js';
import {
  AUDIENCE_PASS_FEE_INR,
  AUTHORITATIVE_PASS_FEES_INR,
  type EntryPassTierId,
  MAX_PROOF_FILE_SIZE_BYTES,
  PAYMENT_PROOFS_BUCKET,
  resolveRegistrationType,
  type RegistrationType,
} from './registrationService.js';
import {
  getSupabaseAdminClient,
  getTableSchemaProperties,
  type TableSchemaMap,
} from './supabaseAdmin.js';
import {
  buildVerifiedTicketUrls,
  generateConfirmedTicketPdf,
  verifyTicketSignature,
  type VerifiedTicketPayload,
} from './ticketService.js';

export type ParticipantPaymentStatusCode =
  | 'payment_pending'
  | 'proof_submitted'
  | 'verified'
  | 'rejected';

export interface ParticipantPaymentHistoryItem {
  id: string;
  submittedAt: string;
  paymentMethod: 'UPI';
  amountSubmittedInr: number;
  utr: string;
  proofFileName: string;
  proofSubmitted: boolean;
  proofStatusLabel: string;
  verificationStatus: 'pending' | 'verified' | 'rejected';
  verificationStatusLabel: string;
  reviewedAt: string | null;
  rejectionReason: string | null;
}

export interface ParticipantConfirmedTicketInfo {
  ticketId: string;
  registrationId: string;
  registrationCode: string;
  verifiedAt: string | null;
  qrVerificationUrl: string;
}

export interface ParticipantRegistrationItem {
  registrationId: string;
  registrationCode: string;
  registrationType: RegistrationType;
  eventName: string;
  eventDate: string;
  venue: string;
  participantName: string;
  teamOrIndividualName: string;
  entryType: EntryPassTierId;
  passCategoryLabel: string;
  categories: string[];
  categoriesDisplay: string;
  participantCount: number;
  participantNames: string;
  registeredAt: string;
  amountPayableInr: number;
  amountPaidInr: number | null;
  paymentStatus: ParticipantPaymentStatusCode;
  paymentStatusLabel: string;
  ticketStatusLabel: string;
  rejectionReason: string | null;
  canResubmitProof: boolean;
  ticket: ParticipantConfirmedTicketInfo | null;
  paymentHistory: ParticipantPaymentHistoryItem[];
}

export interface TicketQrVerificationResponse {
  valid: boolean;
  status: 'verified' | 'revoked' | 'pending' | 'invalid';
  statusLabel: string;
  message: string;
  ticketId: string;
  registrationCode?: string;
  registrationType?: RegistrationType;
  eventName: string;
  eventDate: string;
  venue: string;
  participantOrTeamName?: string;
  passCategoryLabel?: string;
  categoriesDisplay?: string;
  participantCount?: number;
  verifiedAt?: string | null;
}

const PASS_LABELS: Record<EntryPassTierId, string> = {
  individual: 'INDIVIDUAL',
  couple: 'COUPLE',
  group: 'GROUP',
};

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

function normalizeEntryType(raw: string): EntryPassTierId {
  const lower = raw.trim().toLowerCase();
  if (lower === 'couple' || lower === 'duo') return 'couple';
  if (lower === 'group' || lower === 'team') return 'group';
  return 'individual';
}

function normalizeCategories(raw: unknown): { categories: string[]; display: string } {
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

  return {
    categories: items,
    display: items.length > 0 ? items.join(', ') : 'General',
  };
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

function isUndefinedColumnError(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false;
  return (
    err.code === '42703' ||
    err.code === 'PGRST204' ||
    /column .* does not exist/i.test(err.message ?? '') ||
    /Could not find the '.*' column/i.test(err.message ?? '')
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

function extractMissingColumnName(message: string): string | null {
  const pgrstMatch = message.match(/Could not find the '([^']+)' column/i);
  if (pgrstMatch?.[1]) return pgrstMatch[1];

  const pgMatch = message.match(/column "([^"]+)"(?: of relation "[^"]+")? does not exist/i);
  if (pgMatch?.[1]) return pgMatch[1];

  return null;
}

const PRODUCTION_SITE_URL = 'https://alfaaz-unfiltered.vercel.app';

export function deriveRequestOrigin(req: NodeHttpRequest): string {
  const configuredPublic = (
    process.env.PUBLIC_SITE_URL ??
    process.env.VITE_PUBLIC_SITE_URL ??
    ''
  )
    .trim()
    .replace(/\/+$/, '');

  const originHeader = typeof req.headers.origin === 'string' ? req.headers.origin.trim() : '';
  const forwardedProto = req.headers['x-forwarded-proto'];
  const protoRaw = Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto;
  const forwardedHost = req.headers['x-forwarded-host'];
  const hostRaw = Array.isArray(forwardedHost)
    ? forwardedHost[0]
    : forwardedHost || req.headers.host || '';
  const host = String(hostRaw).split(',')[0].trim().toLowerCase();

  // Keep local origin only for genuine local development/tests
  const isLocalHost =
    host.startsWith('localhost') || host.startsWith('127.0.0.1') || host.startsWith('[::1]');
  if (isLocalHost) {
    const proto = protoRaw ? String(protoRaw).split(',')[0].trim() : 'http';
    return `${proto}://${host}`;
  }

  if (!host && originHeader) {
    try {
      const parsed = new URL(originHeader);
      if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') {
        return parsed.origin;
      }
    } catch {
      // ignore invalid origin header
    }
  }

  if (configuredPublic) {
    try {
      const parsed = new URL(configuredPublic);
      if (parsed.protocol === 'https:') {
        return parsed.origin;
      }
    } catch {
      // ignore invalid configured public URL
    }
  }

  // Use custom non-preview domain if hosted on one; otherwise canonical production URL
  if (
    host &&
    !host.endsWith('.vercel.app') &&
    !host.endsWith('.run.app') &&
    !host.includes('localhost')
  ) {
    return `https://${host}`;
  }

  return PRODUCTION_SITE_URL;
}

async function fetchRegistrationsForEmail(
  supabase: SupabaseClient,
  email: string
): Promise<Record<string, unknown>[]> {
  let res = await supabase
    .from('registrations')
    .select('*')
    .ilike('email', email)
    .order('created_at', { ascending: false });

  if (res.error && isUndefinedColumnError(res.error)) {
    res = await supabase.from('registrations').select('*').ilike('email', email);
  }

  if (res.error) {
    throw new ApiHttpError(
      500,
      `Unable to load your registrations: ${res.error.message}`,
      'DB_QUERY_ERROR'
    );
  }

  return (res.data as Record<string, unknown>[] | null) ?? [];
}

async function fetchSubmissionsForRegistrations(
  supabase: SupabaseClient,
  regIds: string[],
  regCodes: string[]
): Promise<Record<string, unknown>[]> {
  const allRows: Record<string, unknown>[] = [];
  const seenKey = new Set<string>();

  const addRows = (rows: Record<string, unknown>[] | null) => {
    if (!rows) return;
    for (const row of rows) {
      const id = pickString(row, ['id', 'submission_id']);
      const regId = pickString(row, ['registration_id']);
      const utr = pickString(row, ['utr', 'transaction_id', 'utr_number', 'upi_ref']);
      const created = pickString(row, ['created_at', 'submitted_at']);
      const dedupKey = id || `${regId}::${utr}::${created}`;
      if (!seenKey.has(dedupKey)) {
        seenKey.add(dedupKey);
        allRows.push(row);
      }
    }
  };

  if (regIds.length > 0) {
    let byRegId = await supabase
      .from('payment_submissions')
      .select('*')
      .in('registration_id', regIds)
      .order('created_at', { ascending: false });

    if (byRegId.error && isUndefinedColumnError(byRegId.error)) {
      byRegId = await supabase
        .from('payment_submissions')
        .select('*')
        .in('registration_id', regIds);
    }

    if (byRegId.error && !isUndefinedColumnError(byRegId.error)) {
      throw new ApiHttpError(
        500,
        `Unable to load payment history: ${byRegId.error.message}`,
        'DB_QUERY_ERROR'
      );
    }
    addRows((byRegId.data as Record<string, unknown>[] | null) ?? null);
  }

  if (regCodes.length > 0) {
    const byCode = await supabase
      .from('payment_submissions')
      .select('*')
      .in('registration_code', regCodes);
    if (!byCode.error) {
      addRows((byCode.data as Record<string, unknown>[] | null) ?? null);
    }
  }

  return allRows;
}

function mapSubmissionRowToHistoryItem(
  row: Record<string, unknown>,
  fallbackAmountInr: number
): ParticipantPaymentHistoryItem {
  const id = pickString(row, ['id', 'submission_id'], randomUUID());
  const rawStatus = pickString(row, ['verification_status', 'status', 'payment_status'], 'pending');
  const verificationStatus = normalizeCanonicalStatus(rawStatus);
  const utr = pickString(row, ['utr', 'transaction_id', 'utr_number', 'upi_ref'], '—');
  const proofPath = pickString(row, [
    'proof_storage_path',
    'proof_path',
    'storage_path',
    'file_path',
    'proof_file_path',
    'object_path',
    'screenshot_path',
  ]);
  const proofSubmitted = Boolean(proofPath || (utr && utr !== '—'));

  const proofFileName = pickString(
    row,
    ['proof_file_name', 'file_name', 'original_filename', 'proof_filename'],
    proofPath ? proofPath.split('/').pop() || 'Payment Proof' : 'No file attached'
  );

  const amountSubmittedInr =
    pickNumber(row, ['amount_inr', 'amount', 'expected_fee_inr', 'fee_inr', 'amount_paid']) ??
    fallbackAmountInr;

  const rejectionReason = pickOptionalString(row, [
    'admin_remarks',
    'rejection_reason',
    'rejection_notes',
    'remarks',
    'reviewer_notes',
    'notes',
  ]);

  const reviewedAt = pickOptionalString(row, ['verified_at', 'reviewed_at']);
  const submittedAt = pickString(row, ['created_at', 'submitted_at', 'updated_at']);

  let verificationStatusLabel = 'Proof Submitted — Awaiting Verification';
  let proofStatusLabel = 'Submitted — Awaiting Admin Verification';

  if (verificationStatus === 'verified') {
    verificationStatusLabel = 'Verified — Payment Confirmed';
    proofStatusLabel = 'Proof Verified';
  } else if (verificationStatus === 'rejected') {
    verificationStatusLabel = 'Rejected — Action Required';
    proofStatusLabel = 'Proof Rejected';
  } else if (!proofSubmitted) {
    verificationStatusLabel = 'Payment Pending';
    proofStatusLabel = 'Not Submitted';
  }

  return {
    id,
    submittedAt,
    paymentMethod: 'UPI',
    amountSubmittedInr,
    utr,
    proofFileName,
    proofSubmitted,
    proofStatusLabel,
    verificationStatus,
    verificationStatusLabel,
    reviewedAt,
    rejectionReason: verificationStatus === 'rejected' ? rejectionReason : null,
  };
}

function buildRegistrationItem(params: {
  regRow: Record<string, unknown>;
  submissions: Record<string, unknown>[];
  requestOrigin: string;
}): ParticipantRegistrationItem {
  const { regRow, submissions, requestOrigin } = params;

  const registrationId = pickString(regRow, ['id', 'registration_id']);
  const registrationCode = pickString(
    regRow,
    ['registration_code', 'reference_id', 'code'],
    registrationId
  );

  const registrationType = resolveRegistrationType(regRow);

  const entryType = normalizeEntryType(
    pickString(regRow, ['entry_type', 'participation_type', 'pass_type'], 'individual')
  );
  const amountPayableInr =
    pickNumber(regRow, ['amount_inr', 'amount', 'expected_fee_inr', 'fee_inr']) ??
    (registrationType === 'AUDIENCE'
      ? AUDIENCE_PASS_FEE_INR
      : AUTHORITATIVE_PASS_FEES_INR[entryType]);

  const historyItems = submissions
    .map((sub) => mapSubmissionRowToHistoryItem(sub, amountPayableInr))
    .sort((a, b) => {
      const timeA = a.submittedAt ? new Date(a.submittedAt).getTime() : 0;
      const timeB = b.submittedAt ? new Date(b.submittedAt).getTime() : 0;
      return timeB - timeA;
    });

  const latestHistory = historyItems[0] ?? null;

  const regRawStatus = pickOptionalString(regRow, [
    'payment_status',
    'status',
    'verification_status',
  ]);
  const regCanonical = regRawStatus ? normalizeCanonicalStatus(regRawStatus) : null;

  // Match Admin Dashboard reconciliation: honor explicit verified/rejected from latest submission or registration
  let reconciled: 'verified' | 'rejected' | 'pending' = 'pending';
  if (latestHistory && latestHistory.verificationStatus !== 'pending') {
    reconciled = latestHistory.verificationStatus;
  } else if (regCanonical && regCanonical !== 'pending') {
    reconciled = regCanonical;
  }

  const regHasUtrOrProof = Boolean(
    pickOptionalString(regRow, ['utr', 'transaction_id', 'utr_number', 'upi_ref']) ||
      pickOptionalString(regRow, ['proof_storage_path', 'proof_path', 'storage_path', 'file_path'])
  );

  let paymentStatus: ParticipantPaymentStatusCode;
  let paymentStatusLabel: string;
  let ticketStatusLabel: string;

  if (reconciled === 'verified') {
    paymentStatus = 'verified';
    paymentStatusLabel = 'Verified — Payment Confirmed';
    ticketStatusLabel =
      registrationType === 'AUDIENCE' ? 'Confirmed Audience Pass Ready' : 'Confirmed Ticket Ready';
  } else if (reconciled === 'rejected') {
    paymentStatus = 'rejected';
    paymentStatusLabel = 'Rejected — Action Required';
    ticketStatusLabel = 'Not Issued (Action Required)';
  } else if (historyItems.length > 0 || regHasUtrOrProof) {
    paymentStatus = 'proof_submitted';
    paymentStatusLabel = 'Proof Submitted — Awaiting Verification';
    ticketStatusLabel = 'Pending Admin Verification';
  } else {
    paymentStatus = 'payment_pending';
    paymentStatusLabel = 'Payment Pending';
    ticketStatusLabel = 'Payment Pending';
  }

  const parsedCategories = normalizeCategories(
    regRow.categories ?? regRow.category ?? regRow.participation_categories
  );
  const categories = registrationType === 'AUDIENCE' ? [] : parsedCategories.categories;
  const categoriesDisplay =
    registrationType === 'AUDIENCE'
      ? 'Watch Only (No Stage Performance Rights)'
      : parsedCategories.display;

  const rejectionReason =
    paymentStatus === 'rejected'
      ? latestHistory?.rejectionReason ||
        pickOptionalString(regRow, [
          'admin_remarks',
          'rejection_reason',
          'rejection_notes',
          'remarks',
          'notes',
        ]) ||
        'Submitted payment proof could not be verified. Please verify your UTR and upload a clear payment screenshot.'
      : null;

  const verifiedAt =
    paymentStatus === 'verified'
      ? pickOptionalString(regRow, ['verified_at', 'reviewed_at']) ?? latestHistory?.reviewedAt ?? null
      : null;

  const existingTicketId = pickOptionalString(regRow, ['ticket_id']) ?? undefined;
  const ticket =
    paymentStatus === 'verified'
      ? (() => {
          const built = buildVerifiedTicketUrls({
            registrationId,
            existingTicketId,
            requestOrigin,
          });
          return {
            ticketId: built.ticketId,
            registrationId,
            registrationCode,
            verifiedAt,
            qrVerificationUrl: built.qrVerificationUrl,
          };
        })()
      : null;

  const amountPaidInr =
    paymentStatus === 'verified'
      ? latestHistory?.amountSubmittedInr ?? amountPayableInr
      : null;

  const participantCount =
    registrationType === 'AUDIENCE'
      ? 1
      : pickNumber(regRow, ['participant_count', 'team_size']) ?? (entryType === 'couple' ? 2 : 1);

  const participantName = pickString(
    regRow,
    ['full_name', 'participant_name', 'name'],
    registrationType === 'AUDIENCE' ? 'Audience Guest' : 'Participant'
  );

  return {
    registrationId,
    registrationCode,
    registrationType,
    eventName: 'ALFAAZ — UNFILTERED',
    eventDate: '18 December 2026 · 4:00 PM',
    venue: 'Quad AI, Bengaluru',
    participantName,
    teamOrIndividualName:
      registrationType === 'AUDIENCE'
        ? participantName
        : pickString(regRow, ['team_or_individual_name', 'team_name', 'stage_name'], participantName),
    entryType,
    passCategoryLabel: registrationType === 'AUDIENCE' ? 'AUDIENCE PASS' : PASS_LABELS[entryType],
    categories,
    categoriesDisplay,
    participantCount,
    participantNames:
      registrationType === 'AUDIENCE'
        ? participantName
        : normalizeParticipantNames(regRow.participant_names ?? regRow.members ?? regRow.participants),
    registeredAt: pickString(regRow, ['created_at', 'registered_at', 'registration_date']),
    amountPayableInr,
    amountPaidInr,
    paymentStatus,
    paymentStatusLabel,
    ticketStatusLabel,
    rejectionReason,
    canResubmitProof: paymentStatus === 'rejected' || paymentStatus === 'payment_pending',
    ticket,
    paymentHistory: historyItems,
  };
}

export async function getParticipantPortalData(params: {
  email: string;
  requestOrigin: string;
}): Promise<{
  email: string;
  registrations: ParticipantRegistrationItem[];
  fetchedAt: string;
}> {
  const supabase = getSupabaseAdminClient();
  const cleanEmail = params.email.trim().toLowerCase();

  const regRows = await fetchRegistrationsForEmail(supabase, cleanEmail);
  if (regRows.length === 0) {
    return {
      email: cleanEmail,
      registrations: [],
      fetchedAt: new Date().toISOString(),
    };
  }

  const regIds: string[] = [];
  const regCodes: string[] = [];
  for (const row of regRows) {
    const id = pickString(row, ['id', 'registration_id']);
    const code = pickString(row, ['registration_code', 'reference_id', 'code']);
    if (id) regIds.push(id);
    if (code) regCodes.push(code);
  }

  const subRows = await fetchSubmissionsForRegistrations(supabase, regIds, regCodes);

  const items: ParticipantRegistrationItem[] = regRows.map((regRow) => {
    const regId = pickString(regRow, ['id', 'registration_id']);
    const regCode = pickString(regRow, ['registration_code', 'reference_id', 'code']);

    const matchingSubs = subRows.filter((sub) => {
      const subRegId = pickString(sub, ['registration_id']);
      const subRegCode = pickString(sub, ['registration_code', 'reference_id']);
      return (
        (regId && subRegId === regId) ||
        (regCode && subRegCode === regCode)
      );
    });

    return buildRegistrationItem({
      regRow,
      submissions: matchingSubs,
      requestOrigin: params.requestOrigin,
    });
  });

  items.sort((a, b) => {
    const timeA = a.registeredAt ? new Date(a.registeredAt).getTime() : 0;
    const timeB = b.registeredAt ? new Date(b.registeredAt).getTime() : 0;
    return timeB - timeA;
  });

  return {
    email: cleanEmail,
    registrations: items,
    fetchedAt: new Date().toISOString(),
  };
}

async function findRegistrationById(
  supabase: SupabaseClient,
  registrationId: string,
  schema: TableSchemaMap | null
): Promise<Record<string, unknown> | null> {
  const candidates = ['id', 'registration_id', 'registration_code', 'reference_id', 'code'].filter(
    (col) => !schema || Object.prototype.hasOwnProperty.call(schema, col)
  );

  for (const col of candidates) {
    const res = await supabase
      .from('registrations')
      .select('*')
      .eq(col, registrationId)
      .limit(1)
      .maybeSingle();

    if (!res.error && res.data) {
      return res.data as Record<string, unknown>;
    }
    if (res.error && !isUndefinedColumnError(res.error) && res.error.code !== '22P02') {
      throw new ApiHttpError(
        500,
        `Unable to look up registration: ${res.error.message}`,
        'DB_QUERY_ERROR'
      );
    }
  }

  return null;
}

export async function getVerifiedTicketPdfForParticipant(params: {
  registrationId: string;
  verifiedEmail: string;
  requestOrigin: string;
}): Promise<{ pdfBuffer: Buffer; fileName: string; ticketId: string }> {
  const trimmedId = params.registrationId.trim();
  if (!trimmedId || trimmedId.length > 120) {
    throw new ApiHttpError(400, 'A valid registrationId is required.', 'VALIDATION_ERROR');
  }

  const supabase = getSupabaseAdminClient();
  const regSchema = await getTableSchemaProperties('registrations');
  const regRow = await findRegistrationById(supabase, trimmedId, regSchema);

  if (!regRow) {
    throw new ApiHttpError(404, 'Registration not found.', 'REGISTRATION_NOT_FOUND');
  }

  const ownerEmail = pickString(regRow, ['email']).toLowerCase();
  if (!ownerEmail || ownerEmail !== params.verifiedEmail.trim().toLowerCase()) {
    throw new ApiHttpError(
      403,
      'You are not authorized to access or download a ticket for this registration.',
      'FORBIDDEN'
    );
  }

  const regId = pickString(regRow, ['id', 'registration_id']);
  const regCode = pickString(regRow, ['registration_code', 'reference_id', 'code'], regId);
  const subs = await fetchSubmissionsForRegistrations(supabase, regId ? [regId] : [], regCode ? [regCode] : []);

  const item = buildRegistrationItem({
    regRow,
    submissions: subs,
    requestOrigin: params.requestOrigin,
  });

  if (item.paymentStatus !== 'verified' || !item.ticket) {
    throw new ApiHttpError(
      403,
      'Confirmed ticket download is only available after an ALFAAZ organizer verifies your payment.',
      'PAYMENT_NOT_VERIFIED'
    );
  }

  const ticketPayload: VerifiedTicketPayload = {
    ticketId: item.ticket.ticketId,
    registrationId: item.registrationId,
    registrationCode: item.registrationCode,
    registrationType: item.registrationType,
    participantOrTeamName: item.teamOrIndividualName,
    fullName: item.participantName,
    entryTypeLabel: item.passCategoryLabel,
    categoriesDisplay: item.categoriesDisplay,
    participantCount: item.participantCount,
    amountPaidInr: item.amountPaidInr ?? item.amountPayableInr,
    verifiedAtIso: item.ticket.verifiedAt || new Date().toISOString(),
    qrVerificationUrl: item.ticket.qrVerificationUrl,
  };

  const pdfBuffer = await generateConfirmedTicketPdf(ticketPayload);
  const safeCode = item.registrationCode.replace(/[^a-zA-Z0-9_-]/g, '');

  return {
    pdfBuffer,
    fileName: `ALFAAZ-Ticket-${safeCode || item.ticket.ticketId}.pdf`,
    ticketId: item.ticket.ticketId,
  };
}

export async function resubmitParticipantPaymentProof(params: {
  verifiedEmail: string;
  fields: Record<string, string>;
  file: ParsedUploadedFile | null;
}): Promise<{
  registrationId: string;
  registrationCode: string;
  status: 'pending_verification';
  utr: string;
  message: string;
}> {
  const registrationId = (params.fields.registrationId ?? '').trim();
  if (!registrationId || registrationId.length > 120) {
    throw new ApiHttpError(400, 'A valid registrationId is required.', 'VALIDATION_ERROR');
  }

  const utr = (params.fields.utr ?? '').trim();
  if (!/^[A-Za-z0-9]{6,36}$/.test(utr)) {
    throw new ApiHttpError(
      400,
      'Enter a valid UPI Transaction ID / UTR (6–36 letters or numbers, no spaces).',
      'VALIDATION_ERROR'
    );
  }

  if (!params.file) {
    throw new ApiHttpError(
      400,
      'Payment screenshot or PDF receipt is required.',
      'VALIDATION_ERROR'
    );
  }

  if (params.file.buffer.length > MAX_PROOF_FILE_SIZE_BYTES) {
    throw new ApiHttpError(413, 'File size must be 10 MB or smaller.', 'FILE_TOO_LARGE');
  }

  const verifiedFile = detectProofFileType(
    params.file.buffer,
    params.file.originalFilename,
    params.file.mimeType
  );

  const supabase = getSupabaseAdminClient();
  const [regSchema, subSchema] = await Promise.all([
    getTableSchemaProperties('registrations'),
    getTableSchemaProperties('payment_submissions'),
  ]);

  const regRow = await findRegistrationById(supabase, registrationId, regSchema);
  if (!regRow) {
    throw new ApiHttpError(404, 'Registration record not found.', 'REGISTRATION_NOT_FOUND');
  }

  const ownerEmail = pickString(regRow, ['email']).toLowerCase();
  if (!ownerEmail || ownerEmail !== params.verifiedEmail.trim().toLowerCase()) {
    throw new ApiHttpError(
      403,
      'You are not authorized to update payment proof for this registration.',
      'FORBIDDEN'
    );
  }

  const regPrimaryId = pickString(regRow, ['id', 'registration_id'], registrationId);
  const regCode = pickString(regRow, ['registration_code', 'reference_id', 'code'], regPrimaryId);
  const existingSubs = await fetchSubmissionsForRegistrations(
    supabase,
    [regPrimaryId],
    regCode ? [regCode] : []
  );

  // Check current reconciled state — never allow overwriting an already verified payment
  const regCanonical = normalizeCanonicalStatus(
    pickString(regRow, ['payment_status', 'status', 'verification_status'], 'pending')
  );
  const hasVerifiedSub = existingSubs.some(
    (s) =>
      normalizeCanonicalStatus(
        pickString(s, ['verification_status', 'status', 'payment_status'], 'pending')
      ) === 'verified'
  );
  if (regCanonical === 'verified' || hasVerifiedSub) {
    throw new ApiHttpError(
      409,
      'Payment for this registration has already been verified and cannot be resubmitted.',
      'ALREADY_VERIFIED'
    );
  }

  // Prevent reusing a UTR belonging to a DIFFERENT registration (pending or verified)
  const utrColumns = ['utr', 'transaction_id', 'utr_number', 'upi_ref'].filter(
    (col) => !subSchema || Object.prototype.hasOwnProperty.call(subSchema, col)
  );
  for (const utrCol of utrColumns) {
    const dupCheck = await supabase
      .from('payment_submissions')
      .select('*')
      .ilike(utrCol, utr)
      .limit(5);

    if (!dupCheck.error && Array.isArray(dupCheck.data)) {
      const conflict = dupCheck.data.find((row) => {
        const rec = row as Record<string, unknown>;
        const subOwnerRegId = pickString(rec, ['registration_id']);
        const subStatus = normalizeCanonicalStatus(
          pickString(rec, ['verification_status', 'status', 'payment_status'], 'pending')
        );
        return subOwnerRegId !== regPrimaryId && subStatus !== 'rejected';
      });
      if (conflict) {
        throw new ApiHttpError(
          409,
          'This UPI Transaction ID / UTR has already been used for another registration.',
          'DUPLICATE_UTR'
        );
      }
      break;
    }
  }

  const registrationType = resolveRegistrationType(regRow);
  if (
    registrationType === 'AUDIENCE' &&
    subSchema &&
    !Object.prototype.hasOwnProperty.call(subSchema, 'registration_type')
  ) {
    throw new ApiHttpError(
      503,
      'Audience registration database migration is pending (missing payment_submissions.registration_type). Run supabase/audience_registration_migration.sql in your Supabase SQL Editor.',
      'SCHEMA_NOT_READY'
    );
  }

  const entryType = normalizeEntryType(
    pickString(regRow, ['entry_type', 'participation_type', 'pass_type'], 'individual')
  );
  const authoritativeFee =
    registrationType === 'AUDIENCE'
      ? AUDIENCE_PASS_FEE_INR
      : AUTHORITATIVE_PASS_FEES_INR[entryType];

  const safeOriginalName =
    params.file.originalFilename.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80) ||
    'payment-proof';
  const safeRegSegment = regPrimaryId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64) || 'reg';
  const objectPath = `registrations/${safeRegSegment}/${Date.now()}-${randomUUID()}.${verifiedFile.ext}`;

  const uploadRes = await supabase.storage
    .from(PAYMENT_PROOFS_BUCKET)
    .upload(objectPath, params.file.buffer, {
      contentType: verifiedFile.mimeType,
      upsert: false,
    });

  if (uploadRes.error) {
    throw new ApiHttpError(
      500,
      `Failed to store payment proof in Supabase Storage: ${uploadRes.error.message}`,
      'STORAGE_UPLOAD_ERROR'
    );
  }

  const uploadedStoragePath = (uploadRes.data?.path || objectPath || '').trim();
  if (!uploadedStoragePath) {
    throw new ApiHttpError(
      500,
      'Payment proof upload did not return a valid storage object path.',
      'STORAGE_UPLOAD_ERROR'
    );
  }

  const proofPathKeys = [
    'proof_storage_path',
    'proof_path',
    'storage_path',
    'file_path',
    'proof_file_path',
    'object_path',
    'screenshot_path',
  ];

  const buildPayload = (
    schema: TableSchemaMap | null,
    defs: Array<{
      keys: string[];
      populateAllMatched?: boolean;
      value: string | number | ((col: TableSchemaMap[string] | undefined) => unknown);
    }>
  ) => {
    const out: Record<string, unknown> = {};
    for (const def of defs) {
      if (schema) {
        const matched = def.populateAllMatched
          ? def.keys.filter((k) => Object.prototype.hasOwnProperty.call(schema, k))
          : def.keys.filter((k) => Object.prototype.hasOwnProperty.call(schema, k)).slice(0, 1);
        for (const key of matched) {
          out[key] = typeof def.value === 'function' ? def.value(schema[key]) : def.value;
        }
      } else {
        const key = def.keys[0];
        out[key] = typeof def.value === 'function' ? def.value(undefined) : def.value;
      }
    }
    return out;
  };

  const pendingStatusCandidates = ['pending', 'pending_verification', 'PENDING', 'PENDING_VERIFICATION'];
  const submissionPayload = buildPayload(subSchema, [
    { keys: ['registration_id'], value: regPrimaryId },
    { keys: ['registration_code', 'reference_id'], value: regCode },
    { keys: ['registration_type'], value: registrationType },
    { keys: ['entry_type', 'participation_type', 'pass_type'], value: entryType },
    { keys: ['amount_inr', 'amount', 'expected_fee_inr', 'fee_inr', 'amount_paid'], value: authoritativeFee },
    { keys: ['utr', 'transaction_id', 'utr_number', 'upi_ref'], value: utr },
    { keys: proofPathKeys, populateAllMatched: true, value: uploadedStoragePath },
    { keys: ['proof_mime_type', 'mime_type', 'content_type', 'file_type'], populateAllMatched: true, value: verifiedFile.mimeType },
    { keys: ['proof_file_name', 'file_name', 'original_filename', 'proof_filename'], populateAllMatched: true, value: safeOriginalName },
    { keys: ['proof_file_size', 'file_size', 'file_size_bytes'], value: params.file.buffer.length },
    { keys: ['full_name', 'participant_name', 'name'], value: pickString(regRow, ['full_name', 'participant_name', 'name']) },
    { keys: ['team_or_individual_name', 'team_name'], value: pickString(regRow, ['team_or_individual_name', 'team_name']) },
    { keys: ['email'], value: ownerEmail },
    { keys: ['mobile_number', 'phone', 'mobile'], value: pickString(regRow, ['mobile_number', 'phone', 'mobile']) },
    { keys: ['college_name', 'college'], value: pickString(regRow, ['college_name', 'college']) },
    {
      keys: ['status', 'verification_status', 'payment_status'],
      value: (col) => {
        if (col?.enum && col.enum.length > 0) {
          const match = col.enum.find((val) => val.toLowerCase().includes('pend'));
          if (match) return match;
        }
        return 'pending';
      },
    },
    { keys: ['idempotency_key'], value: `resubmit_${regPrimaryId}_${utr}_${Date.now()}` },
  ]);

  if (registrationType === 'AUDIENCE' && !Object.prototype.hasOwnProperty.call(submissionPayload, 'registration_type')) {
    submissionPayload.registration_type = 'AUDIENCE';
  }

  const hasPopulatedProofPath = proofPathKeys.some((key) => {
    const val = submissionPayload[key];
    return typeof val === 'string' && val.trim().length > 0;
  });
  if (!hasPopulatedProofPath) {
    await supabase.storage.from(PAYMENT_PROOFS_BUCKET).remove([uploadedStoragePath]);
    throw new ApiHttpError(
      500,
      'Unable to map storage path column on payment_submissions.',
      'SCHEMA_MISMATCH'
    );
  }

  // Adaptive insert into payment_submissions (preserving past rejected rows!)
  const workingPayload: Record<string, unknown> = { ...submissionPayload };
  const statusCol = ['status', 'verification_status', 'payment_status'].find((c) =>
    Object.prototype.hasOwnProperty.call(workingPayload, c)
  );
  let statusIdx = 0;
  let inserted = false;

  try {
    for (let attempt = 0; attempt < 15; attempt++) {
      const res = await supabase.from('payment_submissions').insert(workingPayload).select('*').single();
      if (!res.error && res.data) {
        inserted = true;
        break;
      }
      const err = res.error;
      if (!err) break;
      if (isUndefinedColumnError(err)) {
        const missingCol = extractMissingColumnName(err.message ?? '');
        if (missingCol === 'registration_type' && registrationType === 'AUDIENCE') {
          throw new ApiHttpError(
            503,
            'Audience registration database migration is pending (missing payment_submissions.registration_type). Run supabase/audience_registration_migration.sql in your Supabase SQL Editor.',
            'SCHEMA_NOT_READY'
          );
        }
        if (missingCol && Object.prototype.hasOwnProperty.call(workingPayload, missingCol)) {
          delete workingPayload[missingCol];
          continue;
        }
      }
      if (err.code === '23502' && /null value in column "id"/i.test(err.message ?? '') && !workingPayload.id) {
        workingPayload.id = randomUUID();
        continue;
      }
      if (isConstraintOrEnumError(err) && statusCol && statusIdx + 1 < pendingStatusCandidates.length) {
        statusIdx += 1;
        workingPayload[statusCol] = pendingStatusCandidates[statusIdx];
        continue;
      }
      throw new ApiHttpError(
        500,
        `Database error while saving payment resubmission: ${err.message}`,
        'DB_INSERT_ERROR'
      );
    }

    if (!inserted) {
      throw new ApiHttpError(500, 'Unable to save payment resubmission.', 'DB_INSERT_ERROR');
    }
  } catch (err) {
    await supabase.storage.from(PAYMENT_PROOFS_BUCKET).remove([uploadedStoragePath]);
    throw err;
  }

  // Sync registration row back to Pending Verification so admin queue & status stay aligned
  const regIdCol = Object.prototype.hasOwnProperty.call(regRow, 'id') ? 'id' : 'registration_id';
  const regSyncPayload = buildPayload(regSchema, [
    { keys: ['utr', 'transaction_id', 'utr_number', 'upi_ref'], value: utr },
    { keys: ['proof_storage_path', 'proof_path', 'storage_path', 'file_path'], populateAllMatched: true, value: uploadedStoragePath },
    { keys: ['proof_mime_type', 'mime_type'], populateAllMatched: true, value: verifiedFile.mimeType },
    { keys: ['proof_file_name', 'file_name'], populateAllMatched: true, value: safeOriginalName },
    {
      keys: ['payment_status', 'status', 'verification_status'],
      value: (col) => {
        if (col?.enum && col.enum.length > 0) {
          const match = col.enum.find((val) => val.toLowerCase().includes('pend'));
          if (match) return match;
        }
        return 'pending';
      },
    },
  ]);

  if (Object.keys(regSyncPayload).length > 0) {
    await supabase.from('registrations').update(regSyncPayload).eq(regIdCol, regPrimaryId);
  }

  return {
    registrationId: regPrimaryId,
    registrationCode: regCode,
    status: 'pending_verification',
    utr,
    message:
      'Updated payment proof submitted. Status is now Proof Submitted — Awaiting Verification.',
  };
}

export async function verifyPublicTicketQr(params: {
  ticketId: string;
  registrationId: string;
  signature: string;
}): Promise<TicketQrVerificationResponse> {
  const ticketId = params.ticketId.trim().toUpperCase();
  const registrationId = params.registrationId.trim();
  const signature = params.signature.trim();

  const baseInfo = {
    eventName: 'ALFAAZ — UNFILTERED',
    eventDate: '18 December 2026 · 4:00 PM',
    venue: 'Quad AI, Bengaluru',
    ticketId: ticketId || 'INVALID',
  };

  if (!verifyTicketSignature({ ticketId, registrationId, signature })) {
    return {
      ...baseInfo,
      valid: false,
      status: 'invalid',
      statusLabel: 'INVALID TICKET',
      message: 'This ticket QR code has an invalid or tampered server signature.',
    };
  }

  const supabase = getSupabaseAdminClient();
  const regSchema = await getTableSchemaProperties('registrations');
  const regRow = await findRegistrationById(supabase, registrationId, regSchema);

  if (!regRow) {
    return {
      ...baseInfo,
      valid: false,
      status: 'invalid',
      statusLabel: 'INVALID TICKET',
      message: 'Unknown ticket. No registration record matches this verification link.',
    };
  }

  const regPrimaryId = pickString(regRow, ['id', 'registration_id'], registrationId);
  const regCode = pickString(regRow, ['registration_code', 'reference_id', 'code'], regPrimaryId);
  const subs = await fetchSubmissionsForRegistrations(
    supabase,
    [regPrimaryId],
    regCode ? [regCode] : []
  );

  const built = buildRegistrationItem({
    regRow,
    submissions: subs,
    requestOrigin: PRODUCTION_SITE_URL,
  });

  const explicitTicketStatus = (
    pickOptionalString(regRow, ['ticket_status', 'pass_status', 'payment_status', 'status']) ?? ''
  ).toLowerCase();
  const isExplicitlyRevoked =
    regRow.is_revoked === true ||
    regRow.ticket_revoked === true ||
    Boolean(pickOptionalString(regRow, ['revoked_at'])) ||
    ['revoked', 'cancelled', 'canceled', 'void', 'invalidated'].includes(explicitTicketStatus);

  // If verified in DB, verify ticketId strictly matches derived/stored ticketId
  if (built.paymentStatus === 'verified' && built.ticket && built.ticket.ticketId !== ticketId) {
    return {
      ...baseInfo,
      valid: false,
      status: 'invalid',
      statusLabel: 'INVALID TICKET',
      message: 'Ticket identifier does not match the registered pass record.',
    };
  }

  if (isExplicitlyRevoked || built.paymentStatus === 'rejected') {
    return {
      ...baseInfo,
      valid: false,
      status: 'revoked',
      statusLabel: 'REVOKED / NOT VALID',
      message:
        isExplicitlyRevoked
          ? 'This ticket has been revoked and is no longer valid for event entry.'
          : 'This registration payment was rejected. Entry is not permitted.',
      registrationCode: built.registrationCode,
      registrationType: built.registrationType,
      participantOrTeamName: built.teamOrIndividualName,
      passCategoryLabel: built.passCategoryLabel,
      categoriesDisplay: built.categoriesDisplay,
      participantCount: built.participantCount,
    };
  }

  if (built.paymentStatus !== 'verified' || !built.ticket) {
    return {
      ...baseInfo,
      valid: false,
      status: 'pending',
      statusLabel: 'REVOKED / NOT VALID',
      message:
        'Payment has not been verified for this registration. Passes are valid only after admin confirmation.',
      registrationCode: built.registrationCode,
      registrationType: built.registrationType,
      participantOrTeamName: built.teamOrIndividualName,
      passCategoryLabel: built.passCategoryLabel,
      categoriesDisplay: built.categoriesDisplay,
      participantCount: built.participantCount,
    };
  }

  return {
    ...baseInfo,
    valid: true,
    status: 'verified',
    statusLabel: 'VALID TICKET',
    message:
      built.registrationType === 'AUDIENCE'
        ? 'Confirmed Audience Pass (Watch Only) verified for entry to ALFAAZ — UNFILTERED.'
        : 'Confirmed Participant Pass verified for entry to ALFAAZ — UNFILTERED.',
    registrationCode: built.registrationCode,
    registrationType: built.registrationType,
    participantOrTeamName: built.teamOrIndividualName,
    passCategoryLabel: built.passCategoryLabel,
    categoriesDisplay: built.categoriesDisplay,
    participantCount: built.participantCount,
    verifiedAt: built.ticket.verifiedAt,
  };
}
