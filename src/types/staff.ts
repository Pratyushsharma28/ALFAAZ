export type CheckInOutcome = 'ENTRY_APPROVED' | 'ALREADY_CHECKED_IN' | 'ENTRY_DENIED';

export interface StaffProfile {
  userId: string;
  email: string;
  fullName: string;
  role: string;
}

export interface CheckInSummaryStats {
  totalValidTickets: number;
  checkedInCount: number;
  remainingCount: number;
  checkInRatePercent: number;
}

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

export interface StaffGateSessionPayload {
  staff: StaffProfile;
  stats: CheckInSummaryStats;
  recentCheckins: SafeRecentCheckInItem[];
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

export interface AdminCheckInReportPayload {
  stats: CheckInSummaryStats;
  checkedInTickets: AdminCheckInRecordItem[];
  auditLogs: AdminCheckInAuditLogItem[];
}
