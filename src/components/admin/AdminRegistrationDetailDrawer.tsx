import { useEffect } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { AlertTriangle, CheckCircle2, FileCheck2, X, XCircle } from 'lucide-react';
import {
  AdminPaymentSubmissionRecord,
  AdminRegistrationRecord,
} from '../../types/admin';
import { EDITORIAL_EASE } from '../MotionPrimitives';
import {
  ENTRY_TYPE_META,
  formatDateTime,
  formatInr,
  PAYMENT_STATUS_META,
  REGISTRATION_TYPE_META,
} from './AdminFormatters';

interface AdminRegistrationDetailDrawerProps {
  registration: AdminRegistrationRecord | null;
  linkedSubmission?: AdminPaymentSubmissionRecord | null;
  onClose: () => void;
  onInspectSubmission: (submission: AdminPaymentSubmissionRecord) => void;
}

export function AdminRegistrationDetailDrawer({
  registration,
  linkedSubmission,
  onClose,
  onInspectSubmission,
}: AdminRegistrationDetailDrawerProps) {
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    if (!registration) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [registration, onClose]);

  return (
    <AnimatePresence>
      {registration && (
        <div
          className="fixed inset-0 z-40 flex justify-end"
          role="dialog"
          aria-modal="true"
          aria-labelledby="reg-drawer-title"
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/75 backdrop-blur-xs"
          />

          <motion.aside
            initial={shouldReduceMotion ? { opacity: 1 } : { x: '100%' }}
            animate={{ x: 0 }}
            exit={shouldReduceMotion ? { opacity: 0 } : { x: '100%' }}
            transition={
              shouldReduceMotion ? { duration: 0.01 } : { duration: 0.28, ease: EDITORIAL_EASE }
            }
            className="relative z-10 flex h-full w-full max-w-xl flex-col border-l border-[#EAE7E0]/15 bg-[#0B0B0D] text-[#EAE7E0] shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-4 border-b border-[#EAE7E0]/12 px-6 py-5">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`border px-2 py-0.5 font-mono-num text-[10px] font-bold uppercase ${
                      REGISTRATION_TYPE_META[registration.registrationType].borderClass
                    }`}
                  >
                    {REGISTRATION_TYPE_META[registration.registrationType].label}
                  </span>
                  <p className="font-mono-num text-xs tracking-wider text-[#00E5FF] uppercase">
                    {registration.registrationCode || registration.id}
                  </p>
                </div>
                <h2
                  id="reg-drawer-title"
                  className="mt-1.5 truncate font-display text-3xl font-black tracking-tight text-[#EAE7E0] uppercase"
                >
                  {registration.fullName}
                </h2>
                <p className="mt-1 text-xs text-[#EAE7E0]/60">
                  Registered {formatDateTime(registration.createdAt)}
                </p>
              </div>

              <button
                type="button"
                onClick={onClose}
                aria-label="Close registration details"
                className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center border border-[#EAE7E0]/20 text-[#EAE7E0]/75 transition-colors hover:border-[#FF1744] hover:text-[#FF1744]"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
              {/* Payment & Fee Summary Strip */}
              <div className="flex flex-wrap items-center justify-between gap-4 border border-[#EAE7E0]/12 bg-[#050505] p-4">
                <div>
                  <p className="text-xs text-[#EAE7E0]/55">Payment Status</p>
                  <span
                    className={`mt-1.5 inline-flex items-center gap-1.5 border px-2.5 py-1 text-xs font-semibold ${PAYMENT_STATUS_META[registration.paymentStatus].borderClass} ${PAYMENT_STATUS_META[registration.paymentStatus].textClass}`}
                  >
                    {registration.paymentStatus === 'verified' ? (
                      <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                    ) : registration.paymentStatus === 'rejected' ? (
                      <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
                    ) : (
                      <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                    )}
                    {PAYMENT_STATUS_META[registration.paymentStatus].label}
                  </span>
                </div>

                <div className="text-right">
                  <p className="text-xs text-[#EAE7E0]/55">
                    {registration.registrationType === 'AUDIENCE'
                      ? 'Audience Pass (Watch Only)'
                      : `${ENTRY_TYPE_META[registration.entryType].label} Pass`}
                  </p>
                  <p className="mt-0.5 font-mono-num text-2xl font-bold text-[#EAE7E0]">
                    {formatInr(registration.amountInr)}
                  </p>
                </div>
              </div>

              {/* Attendee / Participant & Contact Details */}
              <section>
                <h3 className="border-b border-[#EAE7E0]/10 pb-2 text-xs font-semibold tracking-wider text-[#EAE7E0]/65 uppercase">
                  {registration.registrationType === 'AUDIENCE'
                    ? 'Audience Attendee & Contact Details'
                    : 'Participant & Contact Details'}
                </h3>
                <dl className="mt-3 grid grid-cols-1 gap-x-4 gap-y-3 text-xs sm:grid-cols-2">
                  <div>
                    <dt className="text-[#EAE7E0]/55">Registration ID</dt>
                    <dd className="mt-0.5 font-mono-num text-[#EAE7E0] break-all">
                      {registration.id}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[#EAE7E0]/55">Registration Code</dt>
                    <dd className="mt-0.5 font-mono-num text-[#EAE7E0]">
                      {registration.registrationCode}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[#EAE7E0]/55">Email</dt>
                    <dd className="mt-0.5 text-[#EAE7E0] break-all">{registration.email}</dd>
                  </div>
                  <div>
                    <dt className="text-[#EAE7E0]/55">Mobile Number</dt>
                    <dd className="mt-0.5 font-mono-num text-[#EAE7E0]">
                      {registration.mobileNumber}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[#EAE7E0]/55">College</dt>
                    <dd className="mt-0.5 text-[#EAE7E0]">{registration.collegeName}</dd>
                  </div>
                  <div>
                    <dt className="text-[#EAE7E0]/55">City</dt>
                    <dd className="mt-0.5 text-[#EAE7E0]">{registration.city}</dd>
                  </div>
                </dl>
              </section>

              {/* Pass & Rights / Performance Details */}
              <section>
                <h3 className="border-b border-[#EAE7E0]/10 pb-2 text-xs font-semibold tracking-wider text-[#EAE7E0]/65 uppercase">
                  {registration.registrationType === 'AUDIENCE'
                    ? 'Audience Pass & Admission Scope'
                    : 'Performance & Team Details'}
                </h3>
                {registration.registrationType === 'AUDIENCE' ? (
                  <dl className="mt-3 grid grid-cols-1 gap-x-4 gap-y-3 text-xs sm:grid-cols-2">
                    <div>
                      <dt className="text-[#EAE7E0]/55">Registration Type</dt>
                      <dd className="mt-0.5 font-semibold text-[#00E5FF]">
                        AUDIENCE PASS (₹59)
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[#EAE7E0]/55">Admission</dt>
                      <dd className="mt-0.5 font-mono-num text-[#EAE7E0]">1 Person</dd>
                    </div>
                    <div className="sm:col-span-2">
                      <dt className="text-[#EAE7E0]/55">Rights Scope</dt>
                      <dd className="mt-0.5 text-[#EAE7E0]">
                        {registration.categoriesDisplay}
                      </dd>
                    </div>
                  </dl>
                ) : (
                  <dl className="mt-3 grid grid-cols-1 gap-x-4 gap-y-3 text-xs sm:grid-cols-2">
                    <div>
                      <dt className="text-[#EAE7E0]/55">Participation Type</dt>
                      <dd
                        className={`mt-0.5 font-semibold ${ENTRY_TYPE_META[registration.entryType].accentClass}`}
                      >
                        {ENTRY_TYPE_META[registration.entryType].label}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[#EAE7E0]/55">Categories</dt>
                      <dd className="mt-0.5 text-[#EAE7E0]">{registration.categoriesDisplay}</dd>
                    </div>
                    <div>
                      <dt className="text-[#EAE7E0]/55">Team / Stage Name</dt>
                      <dd className="mt-0.5 text-[#EAE7E0]">
                        {registration.teamOrIndividualName}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[#EAE7E0]/55">Participant Count</dt>
                      <dd className="mt-0.5 font-mono-num text-[#EAE7E0]">
                        {registration.participantCount}
                      </dd>
                    </div>
                    <div className="sm:col-span-2">
                      <dt className="text-[#EAE7E0]/55">Participant Names</dt>
                      <dd className="mt-0.5 whitespace-pre-wrap text-[#EAE7E0]">
                        {registration.participantNames || '—'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[#EAE7E0]/55">Team Leader</dt>
                      <dd className="mt-0.5 text-[#EAE7E0]">{registration.teamLeaderName}</dd>
                    </div>
                    <div>
                      <dt className="text-[#EAE7E0]/55">Emergency Contact</dt>
                      <dd className="mt-0.5 font-mono-num text-[#EAE7E0]">
                        {registration.emergencyContactNumber}
                      </dd>
                    </div>
                  </dl>
                )}
              </section>

              {/* Payment & Verification Metadata */}
              <section>
                <h3 className="border-b border-[#EAE7E0]/10 pb-2 text-xs font-semibold tracking-wider text-[#EAE7E0]/65 uppercase">
                  Payment & Verification Record
                </h3>
                <dl className="mt-3 grid grid-cols-1 gap-x-4 gap-y-3 text-xs sm:grid-cols-2">
                  <div>
                    <dt className="text-[#EAE7E0]/55">UTR / Transaction ID</dt>
                    <dd className="mt-0.5 font-mono-num font-semibold text-[#C8F36B] break-all">
                      {registration.utr}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[#EAE7E0]/55">Registration Date</dt>
                    <dd className="mt-0.5 font-mono-num text-[#EAE7E0]">
                      {formatDateTime(registration.createdAt)}
                    </dd>
                  </div>
                  {registration.verifiedAt && (
                    <div className="sm:col-span-2">
                      <dt className="text-[#EAE7E0]/55">Verified / Reviewed At</dt>
                      <dd className="mt-0.5 font-mono-num text-[#EAE7E0]">
                        {formatDateTime(registration.verifiedAt)}
                        {registration.verifiedBy ? ` · Reviewer ${registration.verifiedBy}` : ''}
                      </dd>
                    </div>
                  )}
                  <div className="sm:col-span-2">
                    <dt className="text-[#EAE7E0]/55">Admin Remarks</dt>
                    <dd className="mt-0.5 text-[#EAE7E0]/85">
                      {registration.adminRemarks || 'No remarks recorded yet.'}
                    </dd>
                  </div>
                </dl>
              </section>
            </div>

            {/* Footer Action */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#EAE7E0]/12 bg-[#050505] px-6 py-4">
              {linkedSubmission ? (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onInspectSubmission(linkedSubmission);
                  }}
                  className="inline-flex min-h-[42px] cursor-pointer items-center gap-2 border border-[#FF1744] bg-[#FF1744] px-4 py-2 text-xs font-semibold tracking-wider text-[#EAE7E0] uppercase transition-colors hover:bg-[#ff2b54]"
                >
                  <FileCheck2 className="h-4 w-4" aria-hidden="true" />
                  <span>Inspect Proof & Verify Payment</span>
                </button>
              ) : (
                <span className="text-xs text-[#EAE7E0]/55">
                  No linked entry in <code className="font-mono-num">payment_submissions</code> yet.
                </span>
              )}

              <button
                type="button"
                onClick={onClose}
                className="inline-flex min-h-[42px] cursor-pointer items-center border border-[#EAE7E0]/20 px-4 py-2 text-xs font-medium text-[#EAE7E0]/80 transition-colors hover:border-[#EAE7E0]/45"
              >
                Close
              </button>
            </div>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
}
