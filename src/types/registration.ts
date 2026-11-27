export type EntryPassTierId = 'individual' | 'couple' | 'group';

export type ParticipationCategory = 'Dance' | 'Singing' | 'Poetry';

export interface EntryPassOption {
  id: EntryPassTierId;
  label: string;
  heading: string;
  price: number;
  priceDisplay: string;
  participantSummary: string;
  participationNote: string;
  fixedParticipantCount: number | null;
}

export const ENTRY_PASS_OPTIONS: Record<EntryPassTierId, EntryPassOption> = {
  individual: {
    id: 'individual',
    label: 'INDIVIDUAL',
    heading: 'INDIVIDUAL REGISTRATION',
    price: 99,
    priceDisplay: '₹99',
    participantSummary: '1 participant',
    participationNote: 'One participant',
    fixedParticipantCount: 1,
  },
  couple: {
    id: 'couple',
    label: 'COUPLE',
    heading: 'COUPLE REGISTRATION',
    price: 149,
    priceDisplay: '₹149',
    participantSummary: '2 participants',
    participationNote: 'Two participants',
    fixedParticipantCount: 2,
  },
  group: {
    id: 'group',
    label: 'GROUP',
    heading: 'GROUP REGISTRATION',
    price: 199,
    priceDisplay: '₹199',
    participantSummary: 'Team registration',
    participationNote: 'Enter the details of all team members',
    fixedParticipantCount: null,
  },
};

export const ENTRY_PASS_LIST: EntryPassOption[] = [
  ENTRY_PASS_OPTIONS.individual,
  ENTRY_PASS_OPTIONS.couple,
  ENTRY_PASS_OPTIONS.group,
];

export const PARTICIPATION_CATEGORIES: {
  id: ParticipationCategory;
  label: string;
  accentHex: string;
  subtitle: string;
}[] = [
  {
    id: 'Dance',
    label: 'Dance',
    accentHex: '#00E5FF',
    subtitle: 'Movement · Choreography · Freestyle',
  },
  {
    id: 'Singing',
    label: 'Singing',
    accentHex: '#FF1744',
    subtitle: 'Vocals · Originals · Acoustic',
  },
  {
    id: 'Poetry',
    label: 'Poetry',
    accentHex: '#D500F9',
    subtitle: 'Spoken Word · Slam · Shayari',
  },
];

export interface RegistrationFormData {
  entryType: EntryPassTierId;
  fullName: string;
  email: string;
  mobileNumber: string;
  collegeName: string;
  city: string;
  categories: ParticipationCategory[];
  teamOrIndividualName: string;
  participantCount: string;
  participantNames: string;
  teamLeaderName: string;
  emergencyContactNumber: string;
}

export type RegistrationFieldErrors = Partial<Record<keyof RegistrationFormData, string>>;

export type PaymentFlowStatus =
  | 'idle'
  | 'upi_payment'
  | 'preparing_registration'
  | 'uploading_proof'
  | 'submitted_pending'
  | 'creating_order'
  | 'opening_checkout'
  | 'processing'
  | 'success'
  | 'failed'
  | 'pending'
  | 'cancelled'
  | 'error';

export interface BackendRegistrationResult {
  registrationId: string;
  referenceId?: string;
}

export interface BackendRazorpayOrderResult {
  orderId: string;
  amount: number;
  currency: string;
  razorpayKeyId: string;
  registrationId: string;
}

export interface RazorpaySuccessPayload {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

export interface BackendPaymentProofSubmissionResult {
  registrationId: string;
  referenceId?: string;
  status: 'pending_verification' | 'confirmed' | 'verified';
  utr: string;
  proofStatus?: string;
  message?: string;
}

export interface BackendPaymentVerificationResult {
  status: 'confirmed' | 'verified' | 'pending' | 'pending_verification' | 'failed';
  registrationId: string;
  referenceId: string;
  participantOrTeamName: string;
  entryType: EntryPassTierId;
  amountPaid: number;
  utr?: string;
  proofStatus?: string;
  paymentId?: string;
  orderId?: string;
  verifiedStatusLabel: string;
  message?: string;
}

/**
 * Normalizes an Indian mobile number input (strips spaces/dashes and leading +91 or 0)
 * and checks whether it is a valid 10-digit Indian mobile number starting with 6–9.
 */
export function normalizeIndianMobile(raw: string): string {
  const digitsOnly = raw.replace(/[\s()-]/g, '');
  if (digitsOnly.startsWith('+91')) {
    return digitsOnly.slice(3);
  }
  if (digitsOnly.startsWith('91') && digitsOnly.length === 12) {
    return digitsOnly.slice(2);
  }
  if (digitsOnly.startsWith('0') && digitsOnly.length === 11) {
    return digitsOnly.slice(1);
  }
  return digitsOnly;
}

export function isValidIndianMobile(raw: string): boolean {
  const normalized = normalizeIndianMobile(raw.trim());
  return /^[6-9]\d{9}$/.test(normalized);
}

export function isValidEmail(raw: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(raw.trim());
}

export function validatePersonalDetailsStep(data: RegistrationFormData): RegistrationFieldErrors {
  const errors: RegistrationFieldErrors = {};

  if (!data.fullName.trim()) {
    errors.fullName = 'Full name is required.';
  }

  if (!data.email.trim()) {
    errors.email = 'Email address is required.';
  } else if (!isValidEmail(data.email)) {
    errors.email = 'Please enter a valid email address.';
  }

  if (!data.mobileNumber.trim()) {
    errors.mobileNumber = 'Mobile number is required.';
  } else if (!isValidIndianMobile(data.mobileNumber)) {
    errors.mobileNumber = 'Enter a valid 10-digit Indian mobile number (starting with 6–9).';
  }

  if (!data.collegeName.trim()) {
    errors.collegeName = 'College name is required.';
  }

  if (!data.city.trim()) {
    errors.city = 'City is required.';
  }

  return errors;
}

export function validatePerformanceDetailsStep(
  data: RegistrationFormData
): RegistrationFieldErrors {
  const errors: RegistrationFieldErrors = {};

  if (data.categories.length === 0) {
    errors.categories = 'Select at least one participation category.';
  }

  if (!data.teamOrIndividualName.trim()) {
    errors.teamOrIndividualName =
      data.entryType === 'individual'
        ? 'Individual / stage name is required.'
        : 'Team name is required.';
  }

  const parsedCount = Number(data.participantCount);
  if (!data.participantCount.trim() || !Number.isInteger(parsedCount)) {
    errors.participantCount = 'Enter a valid whole number of participants.';
  } else if (data.entryType === 'individual' && parsedCount !== 1) {
    errors.participantCount = 'Individual registration must have 1 participant.';
  } else if (data.entryType === 'couple' && parsedCount !== 2) {
    errors.participantCount = 'Couple registration must have 2 participants.';
  } else if (data.entryType === 'group' && parsedCount < 2) {
    errors.participantCount = 'Group registration requires at least 2 participants.';
  }

  if (!data.participantNames.trim()) {
    errors.participantNames =
      data.entryType === 'couple'
        ? 'Please enter the names of both participants.'
        : 'Names of all participants are required.';
  } else if (data.entryType === 'couple') {
    const entries = data.participantNames
      .split(/[\n,&/]+/)
      .map((item) => item.trim())
      .filter(Boolean);
    if (entries.length < 2) {
      errors.participantNames =
        'Please list both participant names (separated by a new line or comma).';
    }
  } else if (data.entryType === 'group') {
    const entries = data.participantNames
      .split(/[\n,]+/)
      .map((item) => item.trim())
      .filter(Boolean);
    if (entries.length < 2) {
      errors.participantNames =
        'Please list all team member names (separated by new lines or commas).';
    }
  }

  if (!data.teamLeaderName.trim()) {
    errors.teamLeaderName =
      data.entryType === 'group'
        ? 'Team leader name is required.'
        : 'Primary participant / contact name is required.';
  }

  if (!data.emergencyContactNumber.trim()) {
    errors.emergencyContactNumber = 'Emergency contact number is required.';
  } else if (!isValidIndianMobile(data.emergencyContactNumber)) {
    errors.emergencyContactNumber =
      'Enter a valid 10-digit Indian mobile number (starting with 6–9).';
  }

  return errors;
}

export const MAX_PROOF_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export const ALLOWED_PROOF_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'application/pdf',
] as const;

export const ALLOWED_PROOF_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.pdf'] as const;

export function validateUtr(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return 'UPI Transaction ID / UTR is required.';
  }
  if (!/^[A-Za-z0-9]{6,36}$/.test(trimmed)) {
    return 'Enter a valid UPI Transaction ID / UTR (6–36 letters or numbers, no spaces).';
  }
  return null;
}

export function validatePaymentProofFile(file: File | null): string | null {
  if (!file) {
    return 'Payment screenshot or PDF receipt is required.';
  }

  const lowerName = file.name.toLowerCase();
  const hasAllowedExtension = ALLOWED_PROOF_EXTENSIONS.some((ext) => lowerName.endsWith(ext));
  const hasAllowedMime =
    file.type === '' ||
    ALLOWED_PROOF_MIME_TYPES.includes(file.type as (typeof ALLOWED_PROOF_MIME_TYPES)[number]);

  if (!hasAllowedExtension || !hasAllowedMime) {
    return 'Only JPG, JPEG, PNG, or PDF files are allowed.';
  }

  if (file.size <= 0) {
    return 'Selected file appears to be empty.';
  }

  if (file.size > MAX_PROOF_FILE_SIZE_BYTES) {
    return 'File size must be 10 MB or smaller.';
  }

  return null;
}
