import { EntryPassTierId, ParticipationCategory } from './registration';

export type CanonicalPaymentStatus = 'pending' | 'verified' | 'rejected';

export type RealtimeConnectionStatus = 'connecting' | 'subscribed' | 'error' | 'closed';

export interface AdminUserRecord {
  uuid: string;
  email: string;
  fullName: string;
  role: string;
  isActive: boolean;
  raw: Record<string, unknown>;
}

export interface AdminRegistrationRecord {
  id: string;
  registrationCode: string;
  fullName: string;
  email: string;
  mobileNumber: string;
  collegeName: string;
  city: string;
  categories: ParticipationCategory[];
  categoriesDisplay: string;
  entryType: EntryPassTierId;
  teamOrIndividualName: string;
  participantCount: number;
  participantNames: string;
  teamLeaderName: string;
  emergencyContactNumber: string;
  amountInr: number;
  createdAt: string;
  paymentStatus: CanonicalPaymentStatus;
  rawPaymentStatus: string;
  utr: string;
  adminRemarks: string;
  verifiedAt?: string;
  verifiedBy?: string;
  latestSubmissionId?: string;
  proofPath?: string;
  proofMimeType?: string;
  proofFileName?: string;
  raw: Record<string, unknown>;
}

export interface AdminPaymentSubmissionRecord {
  id: string;
  registrationId: string;
  registrationCode: string;
  participantName: string;
  teamOrIndividualName: string;
  email: string;
  mobileNumber: string;
  collegeName: string;
  entryType: EntryPassTierId;
  amountInr: number;
  utr: string;
  proofPath: string;
  proofMimeType: string;
  proofFileName: string;
  submittedAt: string;
  status: CanonicalPaymentStatus;
  rawStatus: string;
  adminRemarks: string;
  verifiedAt?: string;
  verifiedBy?: string;
  raw: Record<string, unknown>;
}

export interface AdminDashboardStats {
  totalRegistrations: number;
  individualCount: number;
  coupleCount: number;
  groupCount: number;
  pendingCount: number;
  verifiedCount: number;
  rejectedCount: number;
  totalVerifiedAmountInr: number;
  pendingSubmissionCount: number;
  verifiedSubmissionCount: number;
  rejectedSubmissionCount: number;
  totalSubmissionCount: number;
  verifiedUniqueRegistrationCount: number;
  verificationRatePercent: number | null;
}

export interface RegistrationTimeBucket {
  key: string;
  label: string;
  count: number;
  cumulativeCount: number;
  verifiedRevenueInr: number;
}

export interface RegistrationGrowthMetrics {
  todayCount: number;
  last7DaysCount: number;
  previous7DaysCount: number;
  growthDeltaCount: number;
  growthDeltaPercent: number | null;
}

export interface TierBreakdownItem {
  entryType: EntryPassTierId;
  label: string;
  totalCount: number;
  verifiedCount: number;
  verifiedRevenueInr: number;
}

export interface AdminAnalyticsSummary {
  dailySeries: RegistrationTimeBucket[];
  monthlySeries: RegistrationTimeBucket[];
  growth: RegistrationGrowthMetrics;
  tierBreakdown: TierBreakdownItem[];
}

export interface AdminDashboardPayload {
  registrations: AdminRegistrationRecord[];
  submissions: AdminPaymentSubmissionRecord[];
  stats: AdminDashboardStats;
  analytics: AdminAnalyticsSummary;
  warnings: string[];
  fetchedAt: string;
}
