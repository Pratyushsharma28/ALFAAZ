import { CanonicalPaymentStatus } from '../../types/admin';
import { EntryPassTierId, RegistrationType } from '../../types/registration';

export function formatInr(amount: number): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(safe);
}

export function formatDateTime(iso: string | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(date);
}

export function formatShortDate(iso: string | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

export const REGISTRATION_TYPE_META: Record<
  RegistrationType,
  { label: string; shortLabel: string; accentClass: string; borderClass: string }
> = {
  PARTICIPANT: {
    label: 'PARTICIPANT PASS',
    shortLabel: 'Participant',
    accentClass: 'text-[#FF1744]',
    borderClass: 'border-[#FF1744]/45 bg-[#FF1744]/10 text-[#FF1744]',
  },
  AUDIENCE: {
    label: 'AUDIENCE · WATCH ONLY',
    shortLabel: 'Audience (₹59)',
    accentClass: 'text-[#00E5FF]',
    borderClass: 'border-[#00E5FF]/50 bg-[#00E5FF]/10 text-[#00E5FF]',
  },
};

export const ENTRY_TYPE_META: Record<
  EntryPassTierId,
  { label: string; accentClass: string; borderClass: string }
> = {
  individual: {
    label: 'Individual',
    accentClass: 'text-[#00E5FF]',
    borderClass: 'border-[#00E5FF]/35 bg-[#00E5FF]/5',
  },
  couple: {
    label: 'Couple',
    accentClass: 'text-[#D500F9]',
    borderClass: 'border-[#D500F9]/35 bg-[#D500F9]/5',
  },
  group: {
    label: 'Group',
    accentClass: 'text-[#FF1744]',
    borderClass: 'border-[#FF1744]/35 bg-[#FF1744]/5',
  },
};

export const PAYMENT_STATUS_META: Record<
  CanonicalPaymentStatus,
  {
    label: string;
    textClass: string;
    borderClass: string;
  }
> = {
  pending: {
    label: 'Pending Verification',
    textClass: 'text-[#F59E0B]',
    borderClass: 'border-[#F59E0B]/40 bg-[#F59E0B]/10',
  },
  verified: {
    label: 'Verified / Paid',
    textClass: 'text-[#C8F36B]',
    borderClass: 'border-[#C8F36B]/40 bg-[#C8F36B]/10',
  },
  rejected: {
    label: 'Rejected',
    textClass: 'text-[#FF1744]',
    borderClass: 'border-[#FF1744]/40 bg-[#FF1744]/10',
  },
};
