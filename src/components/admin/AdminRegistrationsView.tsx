import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  RotateCcw,
  Search,
  XCircle,
} from 'lucide-react';
import {
  AdminPaymentSubmissionRecord,
  AdminRegistrationRecord,
  CanonicalPaymentStatus,
} from '../../types/admin';
import { EntryPassTierId, ParticipationCategory, RegistrationType } from '../../types/registration';
import {
  ENTRY_TYPE_META,
  formatInr,
  formatShortDate,
  PAYMENT_STATUS_META,
  REGISTRATION_TYPE_META,
} from './AdminFormatters';

interface AdminRegistrationsViewProps {
  registrations: AdminRegistrationRecord[];
  submissionsByRegId: Map<string, AdminPaymentSubmissionRecord>;
  isLoading: boolean;
  errorMessage: string | null;
  registrationTypeFilter?: 'all' | RegistrationType;
  onRegistrationTypeFilterChange?: (next: 'all' | RegistrationType) => void;
  entryTypeFilter?: 'all' | EntryPassTierId;
  onEntryTypeFilterChange?: (next: 'all' | EntryPassTierId) => void;
  onRetry: () => void;
  onSelectRegistration: (reg: AdminRegistrationRecord) => void;
  onInspectSubmission: (sub: AdminPaymentSubmissionRecord) => void;
  onExportCsv: (records: AdminRegistrationRecord[]) => void;
}

type SortOrder = 'newest' | 'oldest' | 'amount_desc';

export function AdminRegistrationsView({
  registrations,
  submissionsByRegId,
  isLoading,
  errorMessage,
  registrationTypeFilter: controlledRegType,
  onRegistrationTypeFilterChange,
  entryTypeFilter: controlledEntryType,
  onEntryTypeFilterChange,
  onRetry,
  onSelectRegistration,
  onInspectSubmission,
  onExportCsv,
}: AdminRegistrationsViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [uncontrolledRegType, setUncontrolledRegType] = useState<'all' | RegistrationType>('all');
  const registrationTypeFilter = controlledRegType ?? uncontrolledRegType;
  const setRegistrationTypeFilter = (next: 'all' | RegistrationType) => {
    setUncontrolledRegType(next);
    onRegistrationTypeFilterChange?.(next);
  };
  const [uncontrolledEntryType, setUncontrolledEntryType] = useState<'all' | EntryPassTierId>('all');
  const entryTypeFilter = controlledEntryType ?? uncontrolledEntryType;
  const setEntryTypeFilter = (next: 'all' | EntryPassTierId) => {
    setUncontrolledEntryType(next);
    onEntryTypeFilterChange?.(next);
  };
  const [categoryFilter, setCategoryFilter] = useState<'all' | ParticipationCategory>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | CanonicalPaymentStatus>('all');
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest');
  const [pageSize, setPageSize] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);

  const typeCounts = useMemo(
    () => ({
      all: registrations.length,
      PARTICIPANT: registrations.filter((r) => r.registrationType === 'PARTICIPANT').length,
      AUDIENCE: registrations.filter((r) => r.registrationType === 'AUDIENCE').length,
    }),
    [registrations]
  );

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    const matched = registrations.filter((reg) => {
      if (registrationTypeFilter !== 'all' && reg.registrationType !== registrationTypeFilter) {
        return false;
      }
      if (
        entryTypeFilter !== 'all' &&
        (reg.registrationType !== 'PARTICIPANT' || reg.entryType !== entryTypeFilter)
      ) {
        return false;
      }
      if (categoryFilter !== 'all' && !reg.categories.includes(categoryFilter)) return false;
      if (statusFilter !== 'all' && reg.paymentStatus !== statusFilter) return false;

      if (!q) return true;

      const haystack = [
        reg.id,
        reg.registrationCode,
        reg.registrationType,
        reg.fullName,
        reg.email,
        reg.mobileNumber,
        reg.collegeName,
        reg.city,
        reg.teamOrIndividualName,
        reg.participantNames,
        reg.teamLeaderName,
        reg.utr,
        reg.categoriesDisplay,
      ]
        .join(' ')
        .toLowerCase();

      return haystack.includes(q);
    });

    const sorted = [...matched];
    sorted.sort((a, b) => {
      if (sortOrder === 'amount_desc') {
        return b.amountInr - a.amountInr;
      }
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return sortOrder === 'oldest' ? timeA - timeB : timeB - timeA;
    });

    return sorted;
  }, [
    registrations,
    searchQuery,
    registrationTypeFilter,
    entryTypeFilter,
    categoryFilter,
    statusFilter,
    sortOrder,
  ]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const paginated = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, safePage, pageSize]);

  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    registrationTypeFilter !== 'all' ||
    entryTypeFilter !== 'all' ||
    categoryFilter !== 'all' ||
    statusFilter !== 'all' ||
    sortOrder !== 'newest';

  const resetFilters = () => {
    setSearchQuery('');
    setRegistrationTypeFilter('all');
    setEntryTypeFilter('all');
    setCategoryFilter('all');
    setStatusFilter('all');
    setSortOrder('newest');
    setCurrentPage(1);
  };

  if (errorMessage) {
    return (
      <div className="border border-[#FF1744]/40 bg-[#0B0B0D] p-6">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[#FF1744]" aria-hidden="true" />
          <div>
            <h2 className="font-display text-2xl font-bold text-[#EAE7E0] uppercase">
              Unable to Load Registrations
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
    <section aria-labelledby="registrations-heading" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2
            id="registrations-heading"
            className="font-display text-3xl font-black tracking-tight text-[#EAE7E0] uppercase"
          >
            Registration Management
          </h2>
          <p className="mt-1 text-xs text-[#EAE7E0]/60">
            Showing <span className="font-mono-num text-[#EAE7E0]">{filtered.length}</span> of{' '}
            <span className="font-mono-num text-[#EAE7E0]">{registrations.length}</span>{' '}
            database records
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex min-h-[38px] cursor-pointer items-center gap-1.5 border border-[#EAE7E0]/20 bg-[#0B0B0D] px-3 py-1.5 text-xs font-medium text-[#EAE7E0]/80 transition-colors hover:border-[#EAE7E0]/45"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Reset Filters</span>
            </button>
          )}
          <button
            type="button"
            disabled={filtered.length === 0}
            onClick={() => onExportCsv(filtered)}
            className="inline-flex min-h-[38px] cursor-pointer items-center gap-2 border border-[#C8F36B]/50 bg-[#C8F36B]/10 px-3.5 py-1.5 text-xs font-semibold tracking-wider text-[#C8F36B] uppercase transition-colors hover:bg-[#C8F36B] hover:text-[#050505] disabled:cursor-not-allowed disabled:opacity-45"
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Export CSV ({filtered.length})</span>
          </button>
        </div>
      </div>

      {/* Registration Type Segmentation Bar (All / Participants / Audience) */}
      <div
        className="flex flex-wrap items-center gap-2 border border-[#EAE7E0]/12 bg-[#0B0B0D] px-4 py-3"
        role="tablist"
        aria-label="Filter by registration type"
      >
        {(
          [
            { id: 'all', label: `All (${typeCounts.all})` },
            { id: 'PARTICIPANT', label: `Participants (${typeCounts.PARTICIPANT})` },
            { id: 'AUDIENCE', label: `Audience · ₹59 (${typeCounts.AUDIENCE})` },
          ] as const
        ).map((tab) => {
          const active = registrationTypeFilter === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => {
                setRegistrationTypeFilter(tab.id);
                if (tab.id === 'AUDIENCE') {
                  setEntryTypeFilter('all');
                  setCategoryFilter('all');
                }
                setCurrentPage(1);
              }}
              className={`min-h-[36px] cursor-pointer border px-3.5 py-1.5 font-mono-num text-xs font-semibold whitespace-nowrap transition-colors ${
                active
                  ? tab.id === 'AUDIENCE'
                    ? 'border-[#00E5FF] bg-[#00E5FF] text-[#050505]'
                    : 'border-[#FF1744] bg-[#FF1744] text-[#EAE7E0]'
                  : 'border-[#EAE7E0]/15 bg-[#050505] text-[#EAE7E0]/75 hover:border-[#EAE7E0]/40 hover:text-[#EAE7E0]'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Search & Filters Bar */}
      <div className="grid grid-cols-1 gap-3 border border-[#EAE7E0]/12 bg-[#0B0B0D] p-4 md:grid-cols-2 xl:grid-cols-[1.6fr_1fr_1fr_1fr_1fr]">
        <div className="relative md:col-span-2 xl:col-span-1">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[#EAE7E0]/45"
            aria-hidden="true"
          />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Search name, code, email, mobile, college, UTR..."
            aria-label="Search registrations"
            className="min-h-[40px] w-full border border-[#EAE7E0]/18 bg-[#050505] pr-3 pl-9 text-xs text-[#EAE7E0] placeholder-[#EAE7E0]/40 focus:border-[#FF1744] focus:outline-none"
          />
        </div>

        <select
          aria-label="Filter by participant pass tier"
          value={entryTypeFilter}
          disabled={registrationTypeFilter === 'AUDIENCE'}
          onChange={(e) => {
            setEntryTypeFilter(e.target.value as 'all' | EntryPassTierId);
            setCurrentPage(1);
          }}
          className="min-h-[40px] border border-[#EAE7E0]/18 bg-[#050505] px-3 text-xs text-[#EAE7E0] focus:border-[#FF1744] focus:outline-none disabled:opacity-45"
        >
          <option value="all">All Performer Tiers</option>
          <option value="individual">Individual (₹99)</option>
          <option value="couple">Couple (₹149)</option>
          <option value="group">Group (₹199)</option>
        </select>

        <select
          aria-label="Filter by category"
          value={categoryFilter}
          onChange={(e) => {
            setCategoryFilter(e.target.value as 'all' | ParticipationCategory);
            setCurrentPage(1);
          }}
          className="min-h-[40px] border border-[#EAE7E0]/18 bg-[#050505] px-3 text-xs text-[#EAE7E0] focus:border-[#FF1744] focus:outline-none"
        >
          <option value="all">All Categories</option>
          <option value="Dance">Dance</option>
          <option value="Singing">Singing</option>
          <option value="Poetry">Poetry</option>
        </select>

        <select
          aria-label="Filter by payment status"
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value as 'all' | CanonicalPaymentStatus);
            setCurrentPage(1);
          }}
          className="min-h-[40px] border border-[#EAE7E0]/18 bg-[#050505] px-3 text-xs text-[#EAE7E0] focus:border-[#FF1744] focus:outline-none"
        >
          <option value="all">All Payment Statuses</option>
          <option value="pending">Pending Verification</option>
          <option value="verified">Verified / Paid</option>
          <option value="rejected">Rejected</option>
        </select>

        <select
          aria-label="Sort registrations"
          value={sortOrder}
          onChange={(e) => setSortOrder(e.target.value as SortOrder)}
          className="min-h-[40px] border border-[#EAE7E0]/18 bg-[#050505] px-3 text-xs text-[#EAE7E0] focus:border-[#FF1744] focus:outline-none"
        >
          <option value="newest">Sort: Newest First</option>
          <option value="oldest">Sort: Oldest First</option>
          <option value="amount_desc">Sort: Highest Amount</option>
        </select>
      </div>

      {/* Loading Skeleton */}
      {isLoading ? (
        <div className="space-y-2 border border-[#EAE7E0]/12 bg-[#0B0B0D] p-4">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div
              key={idx}
              className="h-12 w-full animate-pulse border border-[#EAE7E0]/8 bg-[#121216]"
            />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="border border-[#EAE7E0]/12 bg-[#0B0B0D] px-6 py-12 text-center">
          <p className="font-display text-2xl font-bold text-[#EAE7E0] uppercase">
            {registrations.length === 0
              ? 'No Registrations Found'
              : 'No Matching Registrations'}
          </p>
          <p className="mx-auto mt-2 max-w-md text-xs text-[#EAE7E0]/60">
            {registrations.length === 0
              ? 'Submitted registrations in your Supabase registrations table will appear here automatically.'
              : 'Try clearing your search query or adjusting the active category, type, or status filters.'}
          </p>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="mt-4 inline-flex min-h-[38px] cursor-pointer items-center border border-[#FF1744] px-4 py-1.5 text-xs font-semibold text-[#FF1744] uppercase hover:bg-[#FF1744] hover:text-[#EAE7E0]"
            >
              Clear All Filters
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Desktop Data Table */}
          <div className="hidden overflow-x-auto border border-[#EAE7E0]/12 bg-[#0B0B0D] lg:block">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-[#EAE7E0]/12 bg-[#050505] font-mono-num text-[11px] tracking-wider text-[#EAE7E0]/60 uppercase">
                  <th className="px-4 py-3 font-medium">Reg Code / Date</th>
                  <th className="px-4 py-3 font-medium">Participant & Team</th>
                  <th className="px-4 py-3 font-medium">Contact & College</th>
                  <th className="px-4 py-3 font-medium">Type & Categories</th>
                  <th className="px-4 py-3 text-right font-medium">Amount</th>
                  <th className="px-4 py-3 font-medium">UTR / Status</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EAE7E0]/8">
                {paginated.map((reg) => {
                  const linkedSub =
                    submissionsByRegId.get(reg.id) ??
                    submissionsByRegId.get(reg.registrationCode);
                  const statusMeta = PAYMENT_STATUS_META[reg.paymentStatus];
                  const entryMeta = ENTRY_TYPE_META[reg.entryType];

                  return (
                    <tr
                      key={reg.id}
                      className="transition-colors hover:bg-[#EAE7E0]/[0.03]"
                    >
                      <td className="px-4 py-3.5 align-top whitespace-nowrap">
                        <div className="font-mono-num font-semibold text-[#00E5FF]">
                          {reg.registrationCode || reg.id.slice(0, 8)}
                        </div>
                        <div className="mt-0.5 font-mono-num text-[11px] text-[#EAE7E0]/55">
                          {formatShortDate(reg.createdAt)}
                        </div>
                      </td>

                      <td className="px-4 py-3.5 align-top">
                        <div className="font-semibold text-[#EAE7E0]">{reg.fullName}</div>
                        {reg.registrationType === 'AUDIENCE' ? (
                          <div className="mt-0.5 text-[11px] text-[#00E5FF]">
                            Audience Attendee · 1 Person
                          </div>
                        ) : (
                          <>
                            <div className="mt-0.5 text-[11px] text-[#EAE7E0]/65">
                              {reg.teamOrIndividualName !== '—'
                                ? `${reg.teamOrIndividualName} · `
                                : ''}
                              <span className="font-mono-num">{reg.participantCount}</span>{' '}
                              {reg.participantCount === 1 ? 'member' : 'members'}
                            </div>
                            {reg.teamLeaderName !== '—' && (
                              <div className="mt-0.5 text-[11px] text-[#EAE7E0]/50">
                                Lead: {reg.teamLeaderName}
                              </div>
                            )}
                          </>
                        )}
                      </td>

                      <td className="px-4 py-3.5 align-top">
                        <div className="text-[#EAE7E0]/90">{reg.email}</div>
                        <div className="mt-0.5 font-mono-num text-[11px] text-[#EAE7E0]/65">
                          {reg.mobileNumber}
                          {reg.emergencyContactNumber !== '—'
                            ? ` · Emg: ${reg.emergencyContactNumber}`
                            : ''}
                        </div>
                        <div className="mt-0.5 text-[11px] text-[#EAE7E0]/55">
                          {reg.collegeName} · {reg.city}
                        </div>
                      </td>

                      <td className="px-4 py-3.5 align-top">
                        <span
                          className={`inline-block border px-1.5 py-0.5 font-mono-num text-[10px] font-bold uppercase ${
                            REGISTRATION_TYPE_META[reg.registrationType].borderClass
                          }`}
                        >
                          {REGISTRATION_TYPE_META[reg.registrationType].label}
                        </span>
                        <div
                          className={`mt-1 font-semibold ${
                            reg.registrationType === 'AUDIENCE'
                              ? 'text-[#00E5FF]'
                              : entryMeta.accentClass
                          }`}
                        >
                          {reg.registrationType === 'AUDIENCE'
                            ? 'Audience (₹59)'
                            : entryMeta.label}
                        </div>
                        <div className="mt-0.5 text-[11px] text-[#EAE7E0]/75">
                          {reg.categoriesDisplay}
                        </div>
                      </td>

                      <td className="px-4 py-3.5 text-right align-top whitespace-nowrap">
                        <span className="font-mono-num font-bold text-[#EAE7E0]">
                          {formatInr(reg.amountInr)}
                        </span>
                      </td>

                      <td className="px-4 py-3.5 align-top whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 border px-2 py-0.5 text-[11px] font-semibold ${statusMeta.borderClass} ${statusMeta.textClass}`}
                        >
                          {reg.paymentStatus === 'verified' ? (
                            <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                          ) : reg.paymentStatus === 'rejected' ? (
                            <XCircle className="h-3 w-3" aria-hidden="true" />
                          ) : (
                            <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                          )}
                          {statusMeta.label}
                        </span>
                        <div className="mt-1 font-mono-num text-[11px] text-[#EAE7E0]/65">
                          UTR: {reg.utr}
                        </div>
                      </td>

                      <td className="px-4 py-3.5 text-right align-top whitespace-nowrap">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => onSelectRegistration(reg)}
                            className="inline-flex min-h-[32px] cursor-pointer items-center gap-1 border border-[#EAE7E0]/20 bg-[#050505] px-2.5 py-1 text-[11px] font-medium text-[#EAE7E0] transition-colors hover:border-[#00E5FF] hover:text-[#00E5FF]"
                          >
                            <Eye className="h-3 w-3" aria-hidden="true" />
                            <span>Details</span>
                          </button>

                          {linkedSub && (
                            <button
                              type="button"
                              onClick={() => onInspectSubmission(linkedSub)}
                              className="inline-flex min-h-[32px] cursor-pointer items-center border border-[#FF1744]/50 bg-[#FF1744]/10 px-2.5 py-1 text-[11px] font-semibold text-[#FF1744] transition-colors hover:bg-[#FF1744] hover:text-[#EAE7E0]"
                            >
                              Verify
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile & Tablet Cards */}
          <div className="space-y-3 lg:hidden">
            {paginated.map((reg) => {
              const linkedSub =
                submissionsByRegId.get(reg.id) ??
                submissionsByRegId.get(reg.registrationCode);
              const statusMeta = PAYMENT_STATUS_META[reg.paymentStatus];
              const entryMeta = ENTRY_TYPE_META[reg.entryType];

              return (
                <article
                  key={reg.id}
                  className="border border-[#EAE7E0]/12 bg-[#0B0B0D] p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-mono-num text-[11px] text-[#00E5FF]">
                        {reg.registrationCode || reg.id.slice(0, 8)} ·{' '}
                        {formatShortDate(reg.createdAt)}
                      </p>
                      <h3 className="mt-0.5 text-base font-bold text-[#EAE7E0]">
                        {reg.fullName}
                      </h3>
                    </div>

                    <span className="font-mono-num text-base font-bold text-[#EAE7E0]">
                      {formatInr(reg.amountInr)}
                    </span>
                  </div>

                  <div className="mt-2.5 flex flex-wrap items-center gap-2 text-xs">
                    <span
                      className={`border px-1.5 py-0.5 font-mono-num text-[10px] font-bold uppercase ${
                        REGISTRATION_TYPE_META[reg.registrationType].borderClass
                      }`}
                    >
                      {REGISTRATION_TYPE_META[reg.registrationType].shortLabel}
                    </span>
                    <span
                      className={`font-semibold ${
                        reg.registrationType === 'AUDIENCE'
                          ? 'text-[#00E5FF]'
                          : entryMeta.accentClass
                      }`}
                    >
                      {reg.registrationType === 'AUDIENCE' ? 'Watch Only' : entryMeta.label}
                    </span>
                    <span className="text-[#EAE7E0]/35">·</span>
                    <span className="text-[#EAE7E0]/75">{reg.categoriesDisplay}</span>
                    <span className="text-[#EAE7E0]/35">·</span>
                    <span className="font-mono-num text-[#EAE7E0]/75">
                      {reg.participantCount} pax
                    </span>
                  </div>

                  <div className="mt-2 text-xs text-[#EAE7E0]/65">
                    <p>{reg.collegeName} · {reg.city}</p>
                    <p className="mt-0.5 font-mono-num">
                      {reg.mobileNumber} · UTR: {reg.utr}
                    </p>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[#EAE7E0]/10 pt-3">
                    <span
                      className={`inline-flex items-center gap-1.5 border px-2 py-0.5 text-[11px] font-semibold ${statusMeta.borderClass} ${statusMeta.textClass}`}
                    >
                      {statusMeta.label}
                    </span>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onSelectRegistration(reg)}
                        className="inline-flex min-h-[36px] cursor-pointer items-center gap-1 border border-[#EAE7E0]/20 bg-[#050505] px-3 py-1 text-xs font-medium text-[#EAE7E0]"
                      >
                        <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Details</span>
                      </button>

                      {linkedSub && (
                        <button
                          type="button"
                          onClick={() => onInspectSubmission(linkedSub)}
                          className="inline-flex min-h-[36px] cursor-pointer items-center border border-[#FF1744]/50 bg-[#FF1744]/10 px-3 py-1 text-xs font-semibold text-[#FF1744]"
                        >
                          Verify
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          {/* Pagination Footer */}
          <div className="flex flex-wrap items-center justify-between gap-4 border border-[#EAE7E0]/12 bg-[#0B0B0D] px-4 py-3 text-xs">
            <div className="flex items-center gap-3 text-[#EAE7E0]/65">
              <span>
                Page <span className="font-mono-num text-[#EAE7E0]">{safePage}</span> of{' '}
                <span className="font-mono-num text-[#EAE7E0]">{totalPages}</span>
              </span>
              <select
                aria-label="Rows per page"
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="border border-[#EAE7E0]/18 bg-[#050505] px-2 py-1 text-xs text-[#EAE7E0]"
              >
                <option value={10}>10 / page</option>
                <option value={25}>25 / page</option>
                <option value={50}>50 / page</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={safePage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="inline-flex min-h-[34px] cursor-pointer items-center gap-1 border border-[#EAE7E0]/20 bg-[#050505] px-3 py-1 text-xs text-[#EAE7E0] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Prev</span>
              </button>

              <button
                type="button"
                disabled={safePage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="inline-flex min-h-[34px] cursor-pointer items-center gap-1 border border-[#EAE7E0]/20 bg-[#050505] px-3 py-1 text-xs text-[#EAE7E0] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <span>Next</span>
                <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
