import {
  AdminDashboardPayload,
  AdminPaymentSubmissionRecord,
  AdminScopedSectionData,
} from '../types/admin';
import { RegistrationType } from '../types/registration';

/**
 * Strictly partitions registrations and payment submissions by persistent
 * database `registration_type` ('PARTICIPANT' vs 'AUDIENCE').
 */
export function selectScopedSectionData(
  payload: AdminDashboardPayload | null,
  registrationType: RegistrationType
): AdminScopedSectionData {
  const registrations = (payload?.registrations ?? []).filter(
    (r) => r.registrationType === registrationType
  );
  const submissions = (payload?.submissions ?? []).filter(
    (s) => s.registrationType === registrationType
  );

  const submissionsByRegId = new Map<string, AdminPaymentSubmissionRecord>();
  for (const sub of submissions) {
    if (sub.registrationId && !submissionsByRegId.has(sub.registrationId)) {
      submissionsByRegId.set(sub.registrationId, sub);
    }
    if (sub.registrationCode && !submissionsByRegId.has(sub.registrationCode)) {
      submissionsByRegId.set(sub.registrationCode, sub);
    }
  }

  const verifiedByKey = new Map<string, number>();
  for (const sub of submissions) {
    if (sub.status !== 'verified') continue;
    const key = sub.registrationId || sub.registrationCode || `sub:${sub.id}`;
    if (!verifiedByKey.has(key)) {
      verifiedByKey.set(key, Number.isFinite(sub.amountInr) ? sub.amountInr : 0);
    }
  }
  for (const reg of registrations) {
    if (reg.paymentStatus !== 'verified') continue;
    const already =
      (reg.id && verifiedByKey.has(reg.id)) ||
      (reg.registrationCode && verifiedByKey.has(reg.registrationCode));
    if (!already) {
      verifiedByKey.set(
        reg.id || reg.registrationCode,
        Number.isFinite(reg.amountInr) ? reg.amountInr : 0
      );
    }
  }

  let verifiedRevenueInr = 0;
  for (const amt of verifiedByKey.values()) {
    verifiedRevenueInr += amt;
  }

  return {
    registrationType,
    registrations,
    submissions,
    submissionsByRegId,
    stats: {
      totalCount: registrations.length,
      verifiedCount: registrations.filter((r) => r.paymentStatus === 'verified').length,
      pendingCount: registrations.filter((r) => r.paymentStatus === 'pending').length,
      rejectedCount: registrations.filter((r) => r.paymentStatus === 'rejected').length,
      verifiedRevenueInr,
      submissionCount: submissions.length,
      pendingSubmissionCount: submissions.filter((s) => s.status === 'pending').length,
      verifiedSubmissionCount: submissions.filter((s) => s.status === 'verified').length,
      rejectedSubmissionCount: submissions.filter((s) => s.status === 'rejected').length,
      individualCount:
        registrationType === 'PARTICIPANT'
          ? registrations.filter((r) => r.entryType === 'individual').length
          : 0,
      coupleCount:
        registrationType === 'PARTICIPANT'
          ? registrations.filter((r) => r.entryType === 'couple').length
          : 0,
      groupCount:
        registrationType === 'PARTICIPANT'
          ? registrations.filter((r) => r.entryType === 'group').length
          : 0,
    },
  };
}
