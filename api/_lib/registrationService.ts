import { randomBytes, randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  ApiHttpError,
  detectProofFileType,
  type ParsedUploadedFile,
} from './httpUtils.js';
import {
  getSafeServerSupabaseDiagnostics,
  getSupabaseAdminClient,
  getTableSchemaProperties,
  type TableSchemaMap,
} from './supabaseAdmin.js';

export type RegistrationType = 'PARTICIPANT' | 'AUDIENCE';
export type EntryPassTierId = 'individual' | 'couple' | 'group';
export type ParticipationCategory = 'Dance' | 'Singing' | 'Poetry';

export const AUDIENCE_PASS_FEE_INR = 59;

export const AUTHORITATIVE_PASS_FEES_INR: Record<EntryPassTierId, number> = {
  individual: 99,
  couple: 149,
  group: 199,
};

export const PAYMENT_PROOFS_BUCKET = 'payment-proofs';
export const MAX_PROOF_FILE_SIZE_BYTES = 10 * 1024 * 1024;

const ALLOWED_CATEGORIES: readonly ParticipationCategory[] = ['Dance', 'Singing', 'Poetry'];

export function resolveRegistrationType(row: Record<string, unknown>): RegistrationType {
  const raw = String(row.registration_type ?? '').trim().toUpperCase();
  return raw === 'AUDIENCE' ? 'AUDIENCE' : 'PARTICIPANT';
}

export interface NormalizedRegistrationInput {
  idempotencyKey: string;
  registrationType: RegistrationType;
  entryType: EntryPassTierId;
  amountInr: number;
  fullName: string;
  email: string;
  mobileNumber: string;
  collegeName: string;
  city: string;
  categories: ParticipationCategory[];
  teamOrIndividualName: string;
  participantCount: number;
  participantNames: string;
  teamLeaderName: string;
  emergencyContactNumber: string;
}

export interface RegistrationCreationResult {
  registrationId: string;
  referenceId: string;
  registrationType: RegistrationType;
  amountInr: number;
}

export interface PaymentProofSubmissionResult {
  registrationId: string;
  referenceId: string;
  registrationType: RegistrationType;
  status: 'pending_verification';
  utr: string;
  proofStatus: string;
  message: string;
}

export interface PaymentVerificationStatusResult {
  status: 'verified' | 'pending_verification' | 'failed';
  registrationId: string;
  referenceId: string;
  registrationType: RegistrationType;
  participantOrTeamName: string;
  entryType: EntryPassTierId;
  amountPaid: number;
  utr?: string;
  proofStatus?: string;
  verifiedStatusLabel: string;
  message?: string;
}

function normalizeIndianMobile(raw: string): string {
  const digitsOnly = raw.replace(/[\s()-]/g, '');
  if (digitsOnly.startsWith('+91')) return digitsOnly.slice(3);
  if (digitsOnly.startsWith('91') && digitsOnly.length === 12) return digitsOnly.slice(2);
  if (digitsOnly.startsWith('0') && digitsOnly.length === 11) return digitsOnly.slice(1);
  return digitsOnly;
}

function isValidIndianMobile(raw: string): boolean {
  return /^[6-9]\d{9}$/.test(normalizeIndianMobile(raw.trim()));
}

function isValidEmail(raw: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(raw.trim());
}

function asTrimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80) || 'payment-proof';
}

function generateRegistrationCode(): string {
  const token = randomBytes(4).toString('hex').toUpperCase();
  return `ALF-${token}`;
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

function isPermissionDeniedError(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false;
  return (
    err.code === '42501' ||
    /permission denied|row-level security|insufficient privilege/i.test(err.message ?? '')
  );
}

function throwPermissionDeniedError(
  err: { code?: string; message?: string },
  table: 'registrations' | 'payment_submissions',
  operation: 'insert' | 'select'
): never {
  const diagnostics = getSafeServerSupabaseDiagnostics();
  console.error('[registrationService] Supabase permission denied', {
    table,
    operation,
    pgCode: err.code ?? null,
    diagnostics,
  });

  throw new ApiHttpError(
    500,
    `Database permission denied for table ${table} (server key type: ${diagnostics.serviceRoleKeyType}, matching anon key: ${diagnostics.matchesFrontendAnonKey}). Confirm SUPABASE_SERVICE_ROLE_KEY in Vercel is the project's privileged service_role/sb_secret key and ensure PostgreSQL role service_role has INSERT/SELECT privileges on public.${table}.`,
    'DB_PERMISSION_DENIED'
  );
}

function pickString(row: Record<string, unknown>, keys: string[], fallback = ''): string {
  for (const key of keys) {
    const val = row[key];
    if (typeof val === 'string' && val.trim().length > 0) return val.trim();
    if (typeof val === 'number' && Number.isFinite(val)) return String(val);
  }
  return fallback;
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

function buildSchemaAwarePayload(
  schema: TableSchemaMap | null,
  candidates: Array<{
    keys: string[];
    populateAllMatched?: boolean;
    value:
      | string
      | number
      | boolean
      | string[]
      | ((colSchema: TableSchemaMap[string] | undefined) => unknown);
  }>
): Record<string, unknown> {
  const payload: Record<string, unknown> = {};

  for (const item of candidates) {
    if (schema) {
      const matchedKeys = item.populateAllMatched
        ? item.keys.filter((key) => Object.prototype.hasOwnProperty.call(schema, key))
        : item.keys.filter((key) => Object.prototype.hasOwnProperty.call(schema, key)).slice(0, 1);
      if (matchedKeys.length === 0) continue;

      for (const matchedKey of matchedKeys) {
        const colSchema = schema[matchedKey];
        const resolved = typeof item.value === 'function' ? item.value(colSchema) : item.value;
        if (resolved !== undefined) {
          payload[matchedKey] = resolved;
        }
      }
    } else {
      const primaryKey = item.keys[0];
      const resolved = typeof item.value === 'function' ? item.value(undefined) : item.value;
      if (resolved !== undefined) {
        payload[primaryKey] = resolved;
      }
    }
  }

  return payload;
}

async function insertRowAdaptively(
  supabase: SupabaseClient,
  table: 'registrations' | 'payment_submissions',
  initialPayload: Record<string, unknown>,
  statusColumnCandidates: string[],
  pendingStatusCandidates: string[],
  options?: { requiredColumns?: string[] }
): Promise<Record<string, unknown>> {
  const workingPayload: Record<string, unknown> = { ...initialPayload };
  const statusCol = statusColumnCandidates.find((col) =>
    Object.prototype.hasOwnProperty.call(workingPayload, col)
  );
  const requiredCols = new Set(options?.requiredColumns ?? []);
  let statusIdx = 0;

  for (let attempt = 0; attempt < 15; attempt++) {
    const res = await supabase.from(table).insert(workingPayload).select('*').single();

    if (!res.error && res.data) {
      return res.data as Record<string, unknown>;
    }

    const err = res.error;
    if (!err) {
      throw new ApiHttpError(500, `Failed to save record in ${table}.`, 'DB_INSERT_ERROR');
    }

    if (isUndefinedColumnError(err)) {
      const missingCol = extractMissingColumnName(err.message ?? '');
      if (missingCol && requiredCols.has(missingCol)) {
        throw new ApiHttpError(
          503,
          `Audience registration database migration is pending (missing ${table}.${missingCol}). Run supabase/audience_registration_migration.sql in your Supabase SQL Editor.`,
          'SCHEMA_NOT_READY'
        );
      }
      if (missingCol && Object.prototype.hasOwnProperty.call(workingPayload, missingCol)) {
        delete workingPayload[missingCol];
        continue;
      }
    }

    if (
      err.code === '23502' &&
      /null value in column "id"/i.test(err.message ?? '') &&
      !Object.prototype.hasOwnProperty.call(workingPayload, 'id')
    ) {
      workingPayload.id = randomUUID();
      continue;
    }

    if (isConstraintOrEnumError(err)) {
      if (workingPayload.entry_type === 'audience') {
        workingPayload.entry_type = 'individual';
        continue;
      }
      if (statusCol && statusIdx + 1 < pendingStatusCandidates.length) {
        statusIdx += 1;
        workingPayload[statusCol] = pendingStatusCandidates[statusIdx];
        continue;
      }
    }

    if (isPermissionDeniedError(err)) {
      throwPermissionDeniedError(err, table, 'insert');
    }

    if (err.code === '23505') {
      throw new ApiHttpError(
        409,
        `A duplicate entry conflict occurred while saving to ${table}.`,
        'DUPLICATE_RECORD'
      );
    }

    throw new ApiHttpError(
      500,
      `Database error while saving ${table}: ${err.message}`,
      'DB_INSERT_ERROR'
    );
  }

  throw new ApiHttpError(
    500,
    `Unable to match database columns while saving ${table}.`,
    'SCHEMA_MISMATCH'
  );
}

export function validateRegistrationInput(body: Record<string, unknown>): NormalizedRegistrationInput {
  const rawRegistrationType = asTrimmedString(body.registrationType).toUpperCase();
  let registrationType: RegistrationType = 'PARTICIPANT';
  if (rawRegistrationType.length > 0) {
    if (rawRegistrationType !== 'PARTICIPANT' && rawRegistrationType !== 'AUDIENCE') {
      throw new ApiHttpError(
        400,
        'Invalid registrationType. Must be PARTICIPANT or AUDIENCE.',
        'VALIDATION_ERROR'
      );
    }
    registrationType = rawRegistrationType;
  }

  const fullName = asTrimmedString(body.fullName);
  if (fullName.length < 2 || fullName.length > 120) {
    throw new ApiHttpError(400, 'Full name is required (2–120 characters).', 'VALIDATION_ERROR');
  }

  const email = asTrimmedString(body.email).toLowerCase();
  if (!isValidEmail(email) || email.length > 160) {
    throw new ApiHttpError(400, 'A valid email address is required.', 'VALIDATION_ERROR');
  }

  const mobileRaw = asTrimmedString(body.mobileNumber);
  if (!isValidIndianMobile(mobileRaw)) {
    throw new ApiHttpError(
      400,
      'Enter a valid 10-digit Indian mobile number (starting with 6–9).',
      'VALIDATION_ERROR'
    );
  }
  const mobileNumber = normalizeIndianMobile(mobileRaw);

  const collegeName = asTrimmedString(body.collegeName);
  if (collegeName.length < 2 || collegeName.length > 180) {
    throw new ApiHttpError(400, 'College / institution name is required.', 'VALIDATION_ERROR');
  }

  const city = asTrimmedString(body.city);
  if (city.length < 2 || city.length > 100) {
    throw new ApiHttpError(400, 'City is required.', 'VALIDATION_ERROR');
  }

  const rawIdempotencyKey = asTrimmedString(body.idempotencyKey);
  const idempotencyKey =
    rawIdempotencyKey && /^[a-zA-Z0-9._-]{8,100}$/.test(rawIdempotencyKey)
      ? rawIdempotencyKey
      : randomUUID();

  if (registrationType === 'AUDIENCE') {
    if (
      body.expectedFeeInr !== undefined &&
      body.expectedFeeInr !== null &&
      body.expectedFeeInr !== ''
    ) {
      const clientFee = Number(body.expectedFeeInr);
      if (!Number.isFinite(clientFee) || clientFee !== AUDIENCE_PASS_FEE_INR) {
        throw new ApiHttpError(
          400,
          `Registration fee mismatch for Audience Pass. Expected ₹${AUDIENCE_PASS_FEE_INR}.`,
          'FEE_MISMATCH'
        );
      }
    }

    if (body.acknowledgedWatchOnly !== true) {
      throw new ApiHttpError(
        400,
        'Please confirm that audience registration is watch-only and does not include participation or stage performance rights.',
        'VALIDATION_ERROR'
      );
    }

    return {
      idempotencyKey,
      registrationType: 'AUDIENCE',
      entryType: 'individual',
      amountInr: AUDIENCE_PASS_FEE_INR,
      fullName,
      email,
      mobileNumber,
      collegeName,
      city,
      categories: [],
      teamOrIndividualName: fullName,
      participantCount: 1,
      participantNames: fullName,
      teamLeaderName: fullName,
      emergencyContactNumber: mobileNumber,
    };
  }

  const rawEntryType = asTrimmedString(body.entryType).toLowerCase();
  if (rawEntryType !== 'individual' && rawEntryType !== 'couple' && rawEntryType !== 'group') {
    throw new ApiHttpError(
      400,
      'Invalid entryType. Must be individual, couple, or group.',
      'VALIDATION_ERROR'
    );
  }
  const entryType = rawEntryType as EntryPassTierId;
  const authoritativeFee = AUTHORITATIVE_PASS_FEES_INR[entryType];

  if (body.expectedFeeInr !== undefined && body.expectedFeeInr !== null && body.expectedFeeInr !== '') {
    const clientFee = Number(body.expectedFeeInr);
    if (!Number.isFinite(clientFee) || clientFee !== authoritativeFee) {
      throw new ApiHttpError(
        400,
        `Registration fee mismatch for ${entryType} pass. Expected ₹${authoritativeFee}.`,
        'FEE_MISMATCH'
      );
    }
  }

  const rawCategories = Array.isArray(body.categories) ? body.categories : [];
  const categories = Array.from(
    new Set(
      rawCategories
        .map((c) => asTrimmedString(c))
        .filter((c): c is ParticipationCategory =>
          ALLOWED_CATEGORIES.includes(c as ParticipationCategory)
        )
    )
  );
  if (categories.length === 0) {
    throw new ApiHttpError(
      400,
      'Select at least one participation category (Dance, Singing, or Poetry).',
      'VALIDATION_ERROR'
    );
  }

  const teamOrIndividualName = asTrimmedString(body.teamOrIndividualName);
  if (teamOrIndividualName.length < 2 || teamOrIndividualName.length > 120) {
    throw new ApiHttpError(
      400,
      entryType === 'individual' ? 'Individual / stage name is required.' : 'Team name is required.',
      'VALIDATION_ERROR'
    );
  }

  const participantCount = Number(body.participantCount);
  if (!Number.isInteger(participantCount)) {
    throw new ApiHttpError(400, 'Participant count must be a whole number.', 'VALIDATION_ERROR');
  }
  if (entryType === 'individual' && participantCount !== 1) {
    throw new ApiHttpError(400, 'Individual registration must have 1 participant.', 'VALIDATION_ERROR');
  }
  if (entryType === 'couple' && participantCount !== 2) {
    throw new ApiHttpError(400, 'Couple registration must have 2 participants.', 'VALIDATION_ERROR');
  }
  if (entryType === 'group' && (participantCount < 2 || participantCount > 50)) {
    throw new ApiHttpError(
      400,
      'Group registration requires between 2 and 50 participants.',
      'VALIDATION_ERROR'
    );
  }

  const participantNames = asTrimmedString(body.participantNames);
  if (participantNames.length < 2 || participantNames.length > 1500) {
    throw new ApiHttpError(400, 'Names of all participants are required.', 'VALIDATION_ERROR');
  }

  const teamLeaderName = asTrimmedString(body.teamLeaderName);
  if (teamLeaderName.length < 2 || teamLeaderName.length > 120) {
    throw new ApiHttpError(400, 'Team leader / primary contact name is required.', 'VALIDATION_ERROR');
  }

  const emergencyRaw = asTrimmedString(body.emergencyContactNumber);
  if (!isValidIndianMobile(emergencyRaw)) {
    throw new ApiHttpError(
      400,
      'Enter a valid 10-digit Indian emergency contact number (starting with 6–9).',
      'VALIDATION_ERROR'
    );
  }
  const emergencyContactNumber = normalizeIndianMobile(emergencyRaw);

  return {
    idempotencyKey,
    registrationType: 'PARTICIPANT',
    entryType,
    amountInr: authoritativeFee,
    fullName,
    email,
    mobileNumber,
    collegeName,
    city,
    categories,
    teamOrIndividualName,
    participantCount,
    participantNames,
    teamLeaderName,
    emergencyContactNumber,
  };
}

async function findRegistrationByKeyOrId(
  supabase: SupabaseClient,
  identifier: string,
  schema: TableSchemaMap | null
): Promise<Record<string, unknown> | null> {
  const candidates = ['id', 'registration_id', 'registration_code', 'reference_id', 'code'].filter(
    (col) => !schema || Object.prototype.hasOwnProperty.call(schema, col)
  );

  for (const col of candidates) {
    const res = await supabase
      .from('registrations')
      .select('*')
      .eq(col, identifier)
      .limit(1)
      .maybeSingle();

    if (!res.error && res.data) {
      return res.data as Record<string, unknown>;
    }
    if (res.error && isPermissionDeniedError(res.error)) {
      throwPermissionDeniedError(res.error, 'registrations', 'select');
    }
    if (res.error && !isUndefinedColumnError(res.error) && res.error.code !== '22P02') {
      throw new ApiHttpError(500, `Failed to query registration: ${res.error.message}`, 'DB_ERROR');
    }
  }

  return null;
}

export async function createOrReuseRegistration(
  input: NormalizedRegistrationInput
): Promise<RegistrationCreationResult> {
  const supabase = getSupabaseAdminClient();
  const regSchema = await getTableSchemaProperties('registrations');

  if (
    input.registrationType === 'AUDIENCE' &&
    regSchema &&
    !Object.prototype.hasOwnProperty.call(regSchema, 'registration_type')
  ) {
    throw new ApiHttpError(
      503,
      'Audience registration database migration is pending (missing registrations.registration_type). Run supabase/audience_registration_migration.sql in your Supabase SQL Editor.',
      'SCHEMA_NOT_READY'
    );
  }

  // Idempotency lookup if idempotency_key column exists
  if (!regSchema || Object.prototype.hasOwnProperty.call(regSchema, 'idempotency_key')) {
    const existing = await supabase
      .from('registrations')
      .select('*')
      .eq('idempotency_key', input.idempotencyKey)
      .limit(1)
      .maybeSingle();

    if (existing.error && isPermissionDeniedError(existing.error)) {
      throwPermissionDeniedError(existing.error, 'registrations', 'select');
    }

    if (!existing.error && existing.data) {
      const row = existing.data as Record<string, unknown>;
      const existingType = resolveRegistrationType(row);
      if (existingType !== input.registrationType) {
        throw new ApiHttpError(
          409,
          'Registration key conflicts with a different registration type.',
          'REGISTRATION_TYPE_CONFLICT'
        );
      }
      const registrationId = pickString(row, ['id', 'registration_id', 'registration_code']);
      const referenceId = pickString(
        row,
        ['registration_code', 'reference_id', 'code', 'id', 'registration_id'],
        registrationId
      );
      if (registrationId) {
        return {
          registrationId,
          referenceId,
          registrationType: existingType,
          amountInr: input.amountInr,
        };
      }
    }
  }

  const generatedCode = generateRegistrationCode();
  const pendingStatusCandidates = ['pending', 'PENDING', 'pending_verification', 'PENDING_VERIFICATION'];

  const insertPayload = buildSchemaAwarePayload(regSchema, [
    { keys: ['registration_code', 'reference_id', 'code'], value: generatedCode },
    { keys: ['registration_type'], value: input.registrationType },
    {
      keys: ['entry_type', 'participation_type', 'pass_type'],
      value: (col) => {
        if (input.registrationType === 'AUDIENCE') {
          if (col?.enum && col.enum.some((val) => val.toLowerCase() === 'audience')) {
            return 'audience';
          }
          return 'individual';
        }
        return input.entryType;
      },
    },
    { keys: ['full_name', 'participant_name', 'name'], value: input.fullName },
    { keys: ['email'], value: input.email },
    { keys: ['mobile_number', 'phone', 'mobile'], value: input.mobileNumber },
    { keys: ['college_name', 'college'], value: input.collegeName },
    { keys: ['city'], value: input.city },
    {
      keys: ['categories', 'category', 'participation_categories'],
      value: (col) =>
        col?.type === 'array' || col?.format?.endsWith('[]')
          ? input.categories
          : input.registrationType === 'AUDIENCE'
            ? 'Audience (Watch Only)'
            : input.categories.join(', '),
    },
    { keys: ['team_or_individual_name', 'team_name', 'stage_name'], value: input.teamOrIndividualName },
    { keys: ['participant_count', 'team_size'], value: input.participantCount },
    {
      keys: ['participant_names', 'members', 'participants'],
      value: (col) =>
        col?.type === 'array' || col?.format?.endsWith('[]')
          ? input.participantNames
              .split(/[\n,]+/)
              .map((s) => s.trim())
              .filter(Boolean)
          : input.participantNames,
    },
    { keys: ['team_leader_name', 'team_leader', 'leader_name'], value: input.teamLeaderName },
    { keys: ['emergency_contact_number', 'emergency_contact'], value: input.emergencyContactNumber },
    {
      keys: ['amount_inr', 'amount', 'expected_fee_inr', 'fee_inr', 'amount_paid'],
      value: input.amountInr,
    },
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
    { keys: ['idempotency_key'], value: input.idempotencyKey },
  ]);

  if (input.registrationType === 'AUDIENCE' && !Object.prototype.hasOwnProperty.call(insertPayload, 'registration_type')) {
    insertPayload.registration_type = 'AUDIENCE';
  }

  const inserted = await insertRowAdaptively(
    supabase,
    'registrations',
    insertPayload,
    ['payment_status', 'status', 'verification_status'],
    pendingStatusCandidates,
    {
      requiredColumns: input.registrationType === 'AUDIENCE' ? ['registration_type'] : [],
    }
  );

  if (input.registrationType === 'AUDIENCE' && resolveRegistrationType(inserted) !== 'AUDIENCE') {
    throw new ApiHttpError(
      503,
      'Audience registration type could not be persisted. Run supabase/audience_registration_migration.sql in your Supabase SQL Editor.',
      'SCHEMA_NOT_READY'
    );
  }

  const registrationId = pickString(inserted, ['id', 'registration_id', 'registration_code']);
  const referenceId = pickString(
    inserted,
    ['registration_code', 'reference_id', 'code', 'id', 'registration_id'],
    generatedCode
  );

  if (!registrationId) {
    throw new ApiHttpError(
      500,
      'Registration was saved, but no registration ID was returned by the database.',
      'DB_INSERT_ERROR'
    );
  }

  return {
    registrationId,
    referenceId,
    registrationType: input.registrationType,
    amountInr: input.amountInr,
  };
}

export async function submitManualUpiPaymentProof(params: {
  fields: Record<string, string>;
  file: ParsedUploadedFile | null;
}): Promise<PaymentProofSubmissionResult> {
  const { fields, file } = params;

  const registrationId = asTrimmedString(fields.registrationId);
  if (!registrationId || registrationId.length > 120) {
    throw new ApiHttpError(400, 'A valid registrationId is required.', 'VALIDATION_ERROR');
  }

  const rawClientRegistrationType = asTrimmedString(fields.registrationType).toUpperCase();
  if (
    rawClientRegistrationType.length > 0 &&
    rawClientRegistrationType !== 'PARTICIPANT' &&
    rawClientRegistrationType !== 'AUDIENCE'
  ) {
    throw new ApiHttpError(400, 'Invalid registrationType.', 'VALIDATION_ERROR');
  }

  const rawEntryType = asTrimmedString(fields.entryType).toLowerCase();
  if (
    rawEntryType &&
    rawEntryType !== 'individual' &&
    rawEntryType !== 'couple' &&
    rawEntryType !== 'group' &&
    rawEntryType !== 'audience'
  ) {
    throw new ApiHttpError(400, 'Invalid entryType.', 'VALIDATION_ERROR');
  }
  const entryType: EntryPassTierId =
    rawEntryType === 'couple' || rawEntryType === 'group' ? rawEntryType : 'individual';

  const utr = asTrimmedString(fields.utr);
  if (!/^[A-Za-z0-9]{6,36}$/.test(utr)) {
    throw new ApiHttpError(
      400,
      'Enter a valid UPI Transaction ID / UTR (6–36 letters or numbers, no spaces).',
      'VALIDATION_ERROR'
    );
  }

  if (!file) {
    throw new ApiHttpError(
      400,
      'Payment screenshot or PDF receipt is required.',
      'VALIDATION_ERROR'
    );
  }

  if (file.buffer.length > MAX_PROOF_FILE_SIZE_BYTES) {
    throw new ApiHttpError(413, 'File size must be 10 MB or smaller.', 'FILE_TOO_LARGE');
  }

  const verifiedFile = detectProofFileType(file.buffer, file.originalFilename, file.mimeType);
  const rawIdempotency = asTrimmedString(fields.idempotencyKey);
  const idempotencyKey =
    rawIdempotency && /^[a-zA-Z0-9._-]{8,100}$/.test(rawIdempotency)
      ? rawIdempotency
      : `${registrationId}_${utr}`;

  const supabase = getSupabaseAdminClient();
  const [regSchema, subSchema] = await Promise.all([
    getTableSchemaProperties('registrations'),
    getTableSchemaProperties('payment_submissions'),
  ]);

  const registrationRow = await findRegistrationByKeyOrId(supabase, registrationId, regSchema);
  if (!registrationRow) {
    throw new ApiHttpError(
      404,
      'Registration record not found. Please review your details and try submitting again.',
      'REGISTRATION_NOT_FOUND'
    );
  }

  const savedRegistrationType = resolveRegistrationType(registrationRow);
  if (rawClientRegistrationType && rawClientRegistrationType !== savedRegistrationType) {
    throw new ApiHttpError(
      400,
      `Registration type mismatch. Expected ${savedRegistrationType}.`,
      'REGISTRATION_TYPE_MISMATCH'
    );
  }

  if (
    savedRegistrationType === 'AUDIENCE' &&
    subSchema &&
    !Object.prototype.hasOwnProperty.call(subSchema, 'registration_type')
  ) {
    throw new ApiHttpError(
      503,
      'Audience registration database migration is pending (missing payment_submissions.registration_type). Run supabase/audience_registration_migration.sql in your Supabase SQL Editor.',
      'SCHEMA_NOT_READY'
    );
  }

  const regRowPrimaryId = pickString(registrationRow, ['id', 'registration_id'], registrationId);
  const regCode = pickString(
    registrationRow,
    ['registration_code', 'reference_id', 'code'],
    regRowPrimaryId
  );

  // Authoritative server-side pass fee derived strictly from saved registration_type + tier
  const savedEntryType = normalizeEntryType(
    pickString(registrationRow, ['entry_type', 'participation_type', 'pass_type'], entryType)
  );
  const authoritativeFee =
    savedRegistrationType === 'AUDIENCE'
      ? AUDIENCE_PASS_FEE_INR
      : AUTHORITATIVE_PASS_FEES_INR[savedEntryType];

  if (fields.expectedFeeInr && Number(fields.expectedFeeInr) !== authoritativeFee) {
    throw new ApiHttpError(
      400,
      `Payment amount mismatch for ${
        savedRegistrationType === 'AUDIENCE' ? 'Audience Pass' : `${savedEntryType} pass`
      }. Expected ₹${authoritativeFee}.`,
      'FEE_MISMATCH'
    );
  }

  // Prevent overwriting an already verified registration
  const currentRegStatus = normalizeCanonicalStatus(
    pickString(registrationRow, ['payment_status', 'status', 'verification_status'], 'pending')
  );
  if (currentRegStatus === 'verified') {
    throw new ApiHttpError(
      409,
      'This registration payment has already been verified.',
      'ALREADY_VERIFIED'
    );
  }

  // Check existing submissions for this registration or duplicate UTR reuse
  const existingSubRes = await supabase
    .from('payment_submissions')
    .select('*')
    .eq('registration_id', regRowPrimaryId);

  const existingForReg = (existingSubRes.data as Record<string, unknown>[] | null) ?? [];
  for (const sub of existingForReg) {
    const subStatus = normalizeCanonicalStatus(
      pickString(sub, ['verification_status', 'status', 'payment_status'], 'pending')
    );
    if (subStatus === 'verified') {
      throw new ApiHttpError(
        409,
        'Payment for this registration has already been verified by an organizer.',
        'ALREADY_VERIFIED'
      );
    }

    const subKey = pickString(sub, ['idempotency_key']);
    const subUtr = pickString(sub, ['utr', 'transaction_id', 'utr_number', 'upi_ref']);
    if (
      subStatus === 'pending' &&
      ((subKey && subKey === idempotencyKey) || subUtr.toLowerCase() === utr.toLowerCase())
    ) {
      return {
        registrationId: regRowPrimaryId,
        referenceId: regCode,
        registrationType: savedRegistrationType,
        status: 'pending_verification',
        utr: subUtr || utr,
        proofStatus: 'Uploaded · Pending Verification',
        message:
          'Your registration, UTR, and payment proof are already saved with Pending Verification status. An ALFAAZ organizer will verify your payment shortly.',
      };
    }
  }

  // Check if UTR was already submitted by another registration (pending or verified)
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
        const ownerRegId = pickString(rec, ['registration_id']);
        const status = normalizeCanonicalStatus(
          pickString(rec, ['verification_status', 'status', 'payment_status'], 'pending')
        );
        return ownerRegId !== regRowPrimaryId && status !== 'rejected';
      });

      if (conflict) {
        throw new ApiHttpError(
          409,
          'This UPI Transaction ID / UTR has already been used for another registration. Please verify your UTR.',
          'DUPLICATE_UTR'
        );
      }
      break;
    }
  }

  // Upload payment proof file into private Supabase Storage bucket `payment-proofs`
  const safeOriginalName = sanitizeFilename(file.originalFilename);
  const safeRegSegment = regRowPrimaryId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64) || 'reg';
  const objectPath = `registrations/${safeRegSegment}/${Date.now()}-${randomUUID()}.${verifiedFile.ext}`;

  const uploadRes = await supabase.storage
    .from(PAYMENT_PROOFS_BUCKET)
    .upload(objectPath, file.buffer, {
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
      'Payment proof upload succeeded without returning a valid storage object path.',
      'STORAGE_UPLOAD_ERROR'
    );
  }

  // Strictly Pending status — NEVER auto-verified on user submission
  const pendingStatusCandidates = ['pending', 'pending_verification', 'PENDING', 'PENDING_VERIFICATION'];

  const proofPathKeys = [
    'proof_storage_path',
    'proof_path',
    'storage_path',
    'file_path',
    'proof_file_path',
    'object_path',
    'screenshot_path',
  ];

  const submissionPayload = buildSchemaAwarePayload(subSchema, [
    { keys: ['registration_id'], value: regRowPrimaryId },
    { keys: ['registration_code', 'reference_id'], value: regCode },
    { keys: ['registration_type'], value: savedRegistrationType },
    { keys: ['entry_type', 'participation_type', 'pass_type'], value: savedEntryType },
    {
      keys: ['amount', 'amount_inr', 'expected_fee_inr', 'fee_inr', 'amount_paid'],
      value: authoritativeFee,
    },
    { keys: ['utr', 'transaction_id', 'utr_number', 'upi_ref'], value: utr },
    {
      keys: proofPathKeys,
      populateAllMatched: true,
      value: uploadedStoragePath,
    },
    {
      keys: ['proof_mime_type', 'mime_type', 'content_type', 'file_type'],
      populateAllMatched: true,
      value: verifiedFile.mimeType,
    },
    {
      keys: ['proof_file_name', 'file_name', 'original_filename', 'proof_filename'],
      populateAllMatched: true,
      value: safeOriginalName,
    },
    {
      keys: ['proof_file_size', 'file_size', 'file_size_bytes'],
      value: file.buffer.length,
    },
    {
      keys: ['full_name', 'participant_name', 'name'],
      value: pickString(registrationRow, ['full_name', 'participant_name', 'name']),
    },
    {
      keys: ['team_or_individual_name', 'team_name'],
      value: pickString(registrationRow, ['team_or_individual_name', 'team_name']),
    },
    { keys: ['email'], value: pickString(registrationRow, ['email']) },
    {
      keys: ['mobile_number', 'phone', 'mobile'],
      value: pickString(registrationRow, ['mobile_number', 'phone', 'mobile']),
    },
    {
      keys: ['college_name', 'college'],
      value: pickString(registrationRow, ['college_name', 'college']),
    },
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
    { keys: ['idempotency_key'], value: idempotencyKey },
  ]);

  if (savedRegistrationType === 'AUDIENCE' && !Object.prototype.hasOwnProperty.call(submissionPayload, 'registration_type')) {
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
      'Unable to map a non-empty storage path column on payment_submissions.',
      'SCHEMA_MISMATCH'
    );
  }

  try {
    await insertRowAdaptively(
      supabase,
      'payment_submissions',
      submissionPayload,
      ['status', 'verification_status', 'payment_status'],
      pendingStatusCandidates,
      {
        requiredColumns: savedRegistrationType === 'AUDIENCE' ? ['registration_type'] : [],
      }
    );
  } catch (insertErr) {
    // Clean up orphaned proof file if database insert failed
    await supabase.storage.from(PAYMENT_PROOFS_BUCKET).remove([uploadedStoragePath]);
    throw insertErr;
  }

  // Best-effort sync of UTR / proof reference on registration row while keeping status Pending
  const regIdCol = Object.prototype.hasOwnProperty.call(registrationRow, 'id')
    ? 'id'
    : 'registration_id';
  const regSyncPayload = buildSchemaAwarePayload(regSchema, [
    { keys: ['utr', 'transaction_id', 'utr_number', 'upi_ref'], value: utr },
    {
      keys: ['proof_storage_path', 'proof_path', 'storage_path', 'file_path'],
      populateAllMatched: true,
      value: uploadedStoragePath,
    },
    { keys: ['proof_mime_type', 'mime_type'], populateAllMatched: true, value: verifiedFile.mimeType },
    { keys: ['proof_file_name', 'file_name'], populateAllMatched: true, value: safeOriginalName },
  ]);

  if (Object.keys(regSyncPayload).length > 0) {
    await supabase
      .from('registrations')
      .update(regSyncPayload)
      .eq(regIdCol, regRowPrimaryId);
  }

  return {
    registrationId: regRowPrimaryId,
    referenceId: regCode,
    registrationType: savedRegistrationType,
    status: 'pending_verification',
    utr,
    proofStatus: `Uploaded (${safeOriginalName}) · Pending Verification`,
    message:
      'Your registration, UTR, and payment proof have been saved with Pending Verification status. An ALFAAZ organizer will verify your payment from the admin dashboard.',
  };
}

export async function getRegistrationPaymentStatus(
  registrationId: string
): Promise<PaymentVerificationStatusResult> {
  const trimmedId = registrationId.trim();
  if (!trimmedId || trimmedId.length > 120) {
    throw new ApiHttpError(400, 'A valid registrationId query parameter is required.', 'VALIDATION_ERROR');
  }

  const supabase = getSupabaseAdminClient();
  const regSchema = await getTableSchemaProperties('registrations');
  const registrationRow = await findRegistrationByKeyOrId(supabase, trimmedId, regSchema);

  if (!registrationRow) {
    throw new ApiHttpError(404, 'Registration record not found.', 'REGISTRATION_NOT_FOUND');
  }

  const regRowPrimaryId = pickString(registrationRow, ['id', 'registration_id'], trimmedId);
  const regCode = pickString(
    registrationRow,
    ['registration_code', 'reference_id', 'code'],
    regRowPrimaryId
  );

  // Fetch latest payment submission linked to this registration
  let subRes = await supabase
    .from('payment_submissions')
    .select('*')
    .eq('registration_id', regRowPrimaryId)
    .order('created_at', { ascending: false })
    .limit(1);

  if (subRes.error && isUndefinedColumnError(subRes.error)) {
    subRes = await supabase
      .from('payment_submissions')
      .select('*')
      .eq('registration_id', regRowPrimaryId)
      .limit(1);
  }

  const latestSub =
    !subRes.error && Array.isArray(subRes.data) && subRes.data.length > 0
      ? (subRes.data[0] as Record<string, unknown>)
      : null;

  const registrationType = resolveRegistrationType(registrationRow);

  const entryType = normalizeEntryType(
    pickString(
      registrationRow,
      ['entry_type', 'participation_type', 'pass_type'],
      latestSub ? pickString(latestSub, ['entry_type', 'participation_type', 'pass_type']) : 'individual'
    )
  );

  const amountPaid =
    pickNumber(latestSub ?? {}, ['amount', 'amount_inr', 'expected_fee_inr', 'fee_inr', 'amount_paid']) ??
    pickNumber(registrationRow, ['amount_inr', 'amount', 'expected_fee_inr', 'fee_inr', 'amount_paid']) ??
    (registrationType === 'AUDIENCE' ? AUDIENCE_PASS_FEE_INR : AUTHORITATIVE_PASS_FEES_INR[entryType]);

  const subRawStatus = latestSub
    ? pickString(latestSub, ['verification_status', 'status', 'payment_status'], 'pending')
    : '';
  const regRawStatus = pickString(
    registrationRow,
    ['payment_status', 'status', 'verification_status'],
    'pending'
  );

  const subCanonical = subRawStatus ? normalizeCanonicalStatus(subRawStatus) : null;
  const regCanonical = normalizeCanonicalStatus(regRawStatus);

  // Reflect explicit admin decision from either payment_submissions or registrations
  const effectiveStatus =
    subCanonical && subCanonical !== 'pending'
      ? subCanonical
      : regCanonical !== 'pending'
        ? regCanonical
        : 'pending';

  const utr = pickString(
    latestSub ?? {},
    ['utr', 'transaction_id', 'utr_number', 'upi_ref'],
    pickString(registrationRow, ['utr', 'transaction_id', 'utr_number', 'upi_ref'])
  );

  const adminRemarks = pickString(
    latestSub ?? {},
    ['admin_remarks', 'remarks', 'reviewer_notes', 'notes'],
    pickString(registrationRow, ['admin_remarks', 'remarks', 'notes'])
  );

  const participantOrTeamName =
    registrationType === 'AUDIENCE'
      ? pickString(registrationRow, ['full_name', 'participant_name', 'name'], 'ALFAAZ Audience')
      : pickString(
          registrationRow,
          ['team_or_individual_name', 'team_name', 'full_name', 'participant_name', 'name'],
          'ALFAAZ Participant'
        );

  if (effectiveStatus === 'verified') {
    return {
      status: 'verified',
      registrationId: regRowPrimaryId,
      referenceId: regCode,
      registrationType,
      participantOrTeamName,
      entryType,
      amountPaid,
      utr: utr || undefined,
      proofStatus: 'Verified by Admin',
      verifiedStatusLabel: 'Verified & Paid',
      message: 'Your payment has been verified by the ALFAAZ organizing team.',
    };
  }

  if (effectiveStatus === 'rejected') {
    return {
      status: 'failed',
      registrationId: regRowPrimaryId,
      referenceId: regCode,
      registrationType,
      participantOrTeamName,
      entryType,
      amountPaid,
      utr: utr || undefined,
      proofStatus: 'Verification Rejected',
      verifiedStatusLabel: 'Verification Rejected',
      message:
        adminRemarks ||
        'Your submitted payment proof could not be verified. Please double-check your UTR and upload a clear payment screenshot.',
    };
  }

  return {
    status: 'pending_verification',
    registrationId: regRowPrimaryId,
    referenceId: regCode,
    registrationType,
    participantOrTeamName,
    entryType,
    amountPaid,
    utr: utr || undefined,
    proofStatus: latestSub ? 'Submitted · Pending Verification' : 'Awaiting Payment Proof',
    verifiedStatusLabel: 'Pending Verification',
    message:
      'Your payment is currently Pending Verification. An ALFAAZ organizer will review your UTR and screenshot shortly.',
  };
}
