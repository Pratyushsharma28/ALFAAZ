import type { EntryPassTierId, RegistrationType } from './registration';

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

export interface ParticipantPortalPayload {
  email: string;
  registrations: ParticipantRegistrationItem[];
  fetchedAt: string;
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
