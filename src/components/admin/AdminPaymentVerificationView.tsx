import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  FileSearch,
  Search,
  ShieldAlert,
  XCircle,
} from 'lucide-react';
import {
  AdminPaymentSubmissionRecord,
  CanonicalPaymentStatus,
} from '../../types/admin';
import {
  ENTRY_TYPE_META,
  formatDateTime,
  formatInr,
  PAYMENT_STATUS_META,
} from './AdminFormatters';

interface AdminPaymentVerificationViewProps {
  submissions: AdminPaymentSubmissionRecord[];
  isLoading: boolean;
  errorMessage: string | null;
  onRetry: () => void;
  onInspectSubmission: (submission: AdminPaymentSubmissionRecord) => void;
}

export function AdminPaymentVerificationView({
  submissions,
  isLoading,
  errorMessage,
  onRetry,
  onInspectSubmission,
}: AdminPaymentVerificationViewProps) {
  const [statusFilter, setStatusFilter] = useState<'all' | CanonicalPaymentStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const counts = useMemo(() => {
    return {
      all: submissions.length,
      pending: submissions.filter((s) => s.status === 'pending').length,
      verified: submissions.filter((s) => s.status === 'verified').length,
      rejected: submissions.filter((s) => s.status === 'rejected').length,
    };
  }, [submissions]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return submissions.filter((sub) => {
      if (statusFilter !== 'all' && sub.status !== statusFilter) return false;
      if (!q) return true;
      const haystack = [
        sub.registrationCode,
        sub.registrationId,
        sub.participantName,
        sub.teamOrIndividualName,
        sub.email,
        sub.mobileNumber,
        sub.collegeName,
        sub.utr,
        sub.adminRemarks,
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [submissions, statusFilter, searchQuery]);

  if (errorMessage) {
    return (
      <div className="border border-[#FF1744]/40 bg-[#0B0B0D] p-6">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[#FF1744]" aria-hidden="true" />
          <div>
            <h2 className="font-display text-2xl font-bold text-[#EAE7E0] uppercase">
              Unable to Load Payment Submissions
            </h2>
            <p className="mt-1.5 text-sm text-[#EAE7E0]/75">{errorMessage}</p>
            <button
              type="button"
              onClick={onRetry}
              className="mt-4 inline-flex min-h-[38px] cursor-pointer items-center border border-[#FF1744] bg-[#FF1744] px-4 py-1.5 text-xs font-semibold tracking-wider text-[#EAE7E0] uppercase"
            >
              Retry Query
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <section aria-labelledby="payment-verification-heading" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2
            id="payment-verification-heading"
            className="font-display text-3xl font-black tracking-tight text-[#EAE7E0] uppercase"
          >
            Payment Verification
          </h2>
          <p className="mt-1 text-xs text-[#EAE7E0]/60">
            Verify UTR references and inspect private storage proofs before marking any
            registration paid.
          </p>
        </div>

        <div className="inline-flex items-center gap-2 border border-[#F59E0B]/35 bg-[#F59E0B]/10 px-3 py-1.5 text-xs text-[#F59E0B]">
          <ShieldAlert className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>Uploaded proofs are never auto-verified</span>
        </div>
      </div>

      {/* Filter Tabs + Search */}
      <div className="flex flex-col gap-3 border border-[#EAE7E0]/12 bg-[#0B0B0D] p-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Payment status filter">
          {(
            [
              { id: 'all', label: `All (${counts.all})` },
              { id: 'pending', label: `Pending (${counts.pending})` },
              { id: 'verified', label: `Verified (${counts.verified})` },
              { id: 'rejected', label: `Rejected (${counts.rejected})` },
            ] as const
          ).map((tab) => {
            const active = statusFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setStatusFilter(tab.id)}
                className={`min-h-[36px] cursor-pointer border px-3 py-1.5 font-mono-num text-xs font-semibold transition-colors whitespace-nowrap ${
                  active
                    ? 'border-[#FF1744] bg-[#FF1744] text-[#EAE7E0]'
                    : 'border-[#EAE7E0]/15 bg-[#050505] text-[#EAE7E0]/75 hover:border-[#EAE7E0]/40 hover:text-[#EAE7E0]'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="relative w-full md:w-80">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[#EAE7E0]/45"
            aria-hidden="true"
          />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search UTR, name, code, college..."
            aria-label="Search payment submissions"
            className="min-h-[38px] w-full border border-[#EAE7E0]/18 bg-[#050505] pr-3 pl-9 text-xs text-[#EAE7E0] placeholder-[#EAE7E0]/40 focus:border-[#00E5FF] focus:outline-none"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, idx) => (
            <div
              key={idx}
              className="h-28 w-full animate-pulse border border-[#EAE7E0]/12 bg-[#0B0B0D]"
            />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="border border-[#EAE7E0]/12 bg-[#0B0B0D] px-6 py-12 text-center">
          <p className="font-display text-2xl font-bold text-[#EAE7E0] uppercase">
            {submissions.length === 0
              ? 'No Payment Submissions Yet'
              : 'No Submissions Match This Filter'}
          </p>
          <p className="mx-auto mt-2 max-w-md text-xs text-[#EAE7E0]/60">
            {submissions.length === 0
              ? 'Records from your Supabase payment_submissions table will appear here for manual organizer review.'
              : 'Try switching status tabs or clearing your UTR/participant search.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((sub) => {
            const statusMeta = PAYMENT_STATUS_META[sub.status];
            const entryMeta = ENTRY_TYPE_META[sub.entryType];

            return (
              <article
                key={sub.id}
                className="flex flex-col justify-between gap-4 border border-[#EAE7E0]/12 bg-[#0B0B0D] p-5 transition-colors hover:border-[#EAE7E0]/25 lg:flex-row lg:items-center"
              >
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span
                      className={`inline-flex items-center gap-1.5 border px-2 py-0.5 text-[11px] font-semibold ${statusMeta.borderClass} ${statusMeta.textClass}`}
                    >
                      {sub.status === 'verified' ? (
                        <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                      ) : sub.status === 'rejected' ? (
                        <XCircle className="h-3 w-3" aria-hidden="true" />
                      ) : (
                        <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                      )}
                      {statusMeta.label}
                    </span>

                    <span className="font-mono-num text-xs text-[#00E5FF]">
                      {sub.registrationCode || sub.registrationId || sub.id}
                    </span>

                    <span className={`text-xs font-semibold ${entryMeta.accentClass}`}>
                      {entryMeta.label} ·{' '}
                      <span className="font-mono-num">{formatInr(sub.amountInr)}</span>
                    </span>
                  </div>

                  <div>
                    <h3 className="text-base font-bold text-[#EAE7E0]">
                      {sub.participantName}
                      {sub.teamOrIndividualName && sub.teamOrIndividualName !== '—'
                        ? ` (${sub.teamOrIndividualName})`
                        : ''}
                    </h3>
                    <p className="mt-0.5 text-xs text-[#EAE7E0]/65">
                      {sub.email} · <span className="font-mono-num">{sub.mobileNumber}</span> ·{' '}
                      {sub.collegeName}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs">
                    <span>
                      <span className="text-[#EAE7E0]/55">UTR: </span>
                      <span className="font-mono-num font-semibold text-[#C8F36B]">
                        {sub.utr}
                      </span>
                    </span>
                    <span>
                      <span className="text-[#EAE7E0]/55">Submitted: </span>
                      <span className="font-mono-num text-[#EAE7E0]/85">
                        {formatDateTime(sub.submittedAt)}
                      </span>
                    </span>
                    {sub.verifiedAt && (
                      <span>
                        <span className="text-[#EAE7E0]/55">Reviewed: </span>
                        <span className="font-mono-num text-[#EAE7E0]/85">
                          {formatDateTime(sub.verifiedAt)}
                        </span>
                      </span>
                    )}
                  </div>

                  {sub.adminRemarks && (
                    <p className="border-t border-[#EAE7E0]/8 pt-2 text-xs text-[#EAE7E0]/75">
                      <span className="font-semibold text-[#EAE7E0]/55">Remarks: </span>
                      {sub.adminRemarks}
                    </p>
                  )}
                </div>

                <div className="flex shrink-0 flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => onInspectSubmission(sub)}
                    className="inline-flex min-h-[40px] cursor-pointer items-center gap-2 border border-[#FF1744] bg-[#FF1744] px-4 py-2 text-xs font-semibold tracking-wider text-[#EAE7E0] uppercase transition-colors hover:bg-[#ff2b54]"
                  >
                    <FileSearch className="h-4 w-4" aria-hidden="true" />
                    <span>
                      {sub.status === 'pending' ? 'View Proof & Review' : 'View Proof / Update'}
                    </span>
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
