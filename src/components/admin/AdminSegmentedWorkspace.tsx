import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  Eye,
  FileSearch,
  IndianRupee,
  Mic2,
  QrCode,
  RotateCcw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Ticket,
  Users,
  XCircle,
} from 'lucide-react';
import {
  AdminPaymentSubmissionRecord,
  AdminRegistrationRecord,
  AdminScopedSectionData,
  CanonicalPaymentStatus,
} from '../../types/admin';
import {
  AUDIENCE_PASS_FEE_INR,
  ENTRY_PASS_OPTIONS,
  EntryPassTierId,
  ParticipationCategory,
  RegistrationType,
} from '../../types/registration';
import type {
  AdminRegistrationTicketStatus,
  AdminTicketStatusCode,
  CheckInSummaryStats,
} from '../../types/staff';
import {
  ENTRY_TYPE_META,
  formatDateTime,
  formatInr,
  formatShortDate,
  PAYMENT_STATUS_META,
} from './AdminFormatters';

interface AdminSegmentedWorkspaceProps {
  sectionType: RegistrationType;
  sectionData: AdminScopedSectionData;
  ticketStatusByRegId: Map<string, AdminRegistrationTicketStatus>;
  checkinStats: CheckInSummaryStats | null;
  isLoading: boolean;
  errorMessage: string | null;
  onRetry: () => void;
  onSelectRegistration: (reg: AdminRegistrationRecord) => void;
  onInspectSubmission: (sub: AdminPaymentSubmissionRecord) => void;
  onExportCsv: (records: AdminRegistrationRecord[], filenamePrefix: string) => void;
}

type SectionSubTab = 'registrations' | 'payments';
type SortOrder = 'newest' | 'oldest' | 'amount_desc';

const TICKET_STATUS_META: Record<
  AdminTicketStatusCode,
  { label: string; badgeClass: string }
> = {
  checked_in: {
    label: 'Checked In',
    badgeClass: 'border-[#C8F36B]/50 bg-[#C8F36B]/15 text-[#C8F36B]',
  },
  issued: {
    label: 'Ticket Issued',
    badgeClass: 'border-[#00E5FF]/50 bg-[#00E5FF]/10 text-[#00E5FF]',
  },
  pending: {
    label: 'Awaiting Verification',
    badgeClass: 'border-[#F59E0B]/40 bg-[#F59E0B]/10 text-[#F59E0B]',
  },
  rejected: {
    label: 'Payment Rejected',
    badgeClass: 'border-[#FF1744]/40 bg-[#FF1744]/10 text-[#FF1744]',
  },
  revoked: {
    label: 'Pass Revoked',
    badgeClass: 'border-[#FF1744]/60 bg-[#FF1744]/15 text-[#FF1744]',
  },
};

export function AdminSegmentedWorkspace({
  sectionType,
  sectionData,
  ticketStatusByRegId,
  checkinStats,
  isLoading,
  errorMessage,
  onRetry,
  onSelectRegistration,
  onInspectSubmission,
  onExportCsv,
}: AdminSegmentedWorkspaceProps) {
  const isAudience = sectionType === 'AUDIENCE';
  const [subTab, setSubTab] = useState<SectionSubTab>('registrations');

  // Registration list controls
  const [regSearch, setRegSearch] = useState('');
  const [regStatusFilter, setRegStatusFilter] = useState<'all' | CanonicalPaymentStatus>('all');
  const [tierFilter, setTierFilter] = useState<'all' | EntryPassTierId>('all');
  const [categoryFilter, setCategoryFilter] = useState<'all' | ParticipationCategory>('all');
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest');
  const [pageSize, setPageSize] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Payment verification queue controls
  const [payStatusFilter, setPayStatusFilter] = useState<'all' | CanonicalPaymentStatus>('all');
  const [paySearch, setPaySearch] = useState('');

  // Defensive strict filter guarantee — only ever process matching registrationType
  const registrations = useMemo(
    () => sectionData.registrations.filter((r) => r.registrationType === sectionType),
    [sectionData.registrations, sectionType]
  );
  const submissions = useMemo(
    () => sectionData.submissions.filter((s) => s.registrationType === sectionType),
    [sectionData.submissions, sectionType]
  );
  const { stats, submissionsByRegId } = sectionData;

  const validTicketsForSection = checkinStats
    ? isAudience
      ? checkinStats.audienceValidTickets
      : checkinStats.participantValidTickets
    : stats.verifiedCount;

  const checkedInForSection = checkinStats
    ? isAudience
      ? checkinStats.audienceCheckedInCount
      : checkinStats.participantCheckedInCount
    : 0;

  const filteredRegistrations = useMemo(() => {
    const q = regSearch.trim().toLowerCase();
    const matched = registrations.filter((reg) => {
      if (regStatusFilter !== 'all' && reg.paymentStatus !== regStatusFilter) return false;
      if (!isAudience && tierFilter !== 'all' && reg.entryType !== tierFilter) return false;
      if (!isAudience && categoryFilter !== 'all' && !reg.categories.includes(categoryFilter)) {
        return false;
      }

      if (!q) return true;

      const ticketInfo =
        ticketStatusByRegId.get(reg.id) ?? ticketStatusByRegId.get(reg.registrationCode);
      const haystack = [
        reg.id,
        reg.registrationCode,
        ticketInfo?.ticketId ?? '',
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
      if (sortOrder === 'amount_desc') return b.amountInr - a.amountInr;
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return sortOrder === 'oldest' ? timeA - timeB : timeB - timeA;
    });
    return sorted;
  }, [
    registrations,
    regSearch,
    regStatusFilter,
    isAudience,
    tierFilter,
    categoryFilter,
    sortOrder,
    ticketStatusByRegId,
  ]);

  const totalPages = Math.max(1, Math.ceil(filteredRegistrations.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedRegistrations = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filteredRegistrations.slice(start, start + pageSize);
  }, [filteredRegistrations, safePage, pageSize]);

  const hasActiveRegFilters =
    regSearch.trim() !== '' ||
    regStatusFilter !== 'all' ||
    (!isAudience && (tierFilter !== 'all' || categoryFilter !== 'all')) ||
    sortOrder !== 'newest';

  const resetRegFilters = () => {
    setRegSearch('');
    setRegStatusFilter('all');
    setTierFilter('all');
    setCategoryFilter('all');
    setSortOrder('newest');
    setCurrentPage(1);
  };

  const filteredSubmissions = useMemo(() => {
    const q = paySearch.trim().toLowerCase();
    return submissions.filter((sub) => {
      if (payStatusFilter !== 'all' && sub.status !== payStatusFilter) return false;
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
  }, [submissions, payStatusFilter, paySearch]);

  if (errorMessage && registrations.length === 0) {
    return (
      <div className="border border-[#FF1744]/40 bg-[#0B0B0D] p-6">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[#FF1744]" aria-hidden="true" />
          <div>
            <h2 className="font-display text-2xl font-bold text-[#EAE7E0] uppercase">
              Unable to Load {isAudience ? 'Audience' : 'Participant'} Section
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

  const accentText = isAudience ? 'text-[#00E5FF]' : 'text-[#FF1744]';
  const accentBorder = isAudience ? 'border-[#00E5FF]/40' : 'border-[#FF1744]/40';
  const csvPrefix = isAudience ? 'alfaaz-audience' : 'alfaaz-participants';

  return (
    <div className="space-y-6">
      {/* Section Header Banner */}
      <div className={`border ${accentBorder} bg-[#0B0B0D] p-5`}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              {isAudience ? (
                <Ticket className="h-4 w-4 text-[#00E5FF]" aria-hidden="true" />
              ) : (
                <Mic2 className="h-4 w-4 text-[#FF1744]" aria-hidden="true" />
              )}
              <span className={`font-mono-num text-[11px] font-bold tracking-[0.18em] uppercase ${accentText}`}>
                {isAudience
                  ? `Audience Section · registration_type = 'AUDIENCE'`
                  : `Participants Section · registration_type = 'PARTICIPANT'`}
              </span>
            </div>
            <h2 className="mt-1.5 font-display text-3xl font-black tracking-tight text-[#EAE7E0] uppercase">
              {isAudience ? 'Audience Passes & Verification' : 'Participant Passes & Verification'}
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-[#EAE7E0]/65">
              {isAudience
                ? `Dedicated management for ₹${AUDIENCE_PASS_FEE_INR} Watch-Only Audience registrations (1 person, non-performing admission), UPI payment approvals, and audience ticket status.`
                : 'Dedicated management for performing Participant registrations across Individual (₹99), Couple (₹149), and Group (₹199) tiers, payment approvals, and stage ticket status.'}
            </p>
          </div>

          <button
            type="button"
            disabled={filteredRegistrations.length === 0}
            onClick={() => onExportCsv(filteredRegistrations, csvPrefix)}
            className="inline-flex min-h-[38px] cursor-pointer items-center gap-2 border border-[#C8F36B]/50 bg-[#C8F36B]/10 px-3.5 py-1.5 text-xs font-semibold tracking-wider text-[#C8F36B] uppercase transition-colors hover:bg-[#C8F36B] hover:text-[#050505] disabled:cursor-not-allowed disabled:opacity-45"
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            <span>
              Export {isAudience ? 'Audience' : 'Participants'} ({filteredRegistrations.length})
            </span>
          </button>
        </div>

        {/* Section-Specific KPI Cards */}
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="border border-[#EAE7E0]/12 bg-[#050505] p-4">
            <div className="flex items-center justify-between text-xs text-[#EAE7E0]/60">
              <span>{isAudience ? 'Total Audience' : 'Total Participants'}</span>
              <Users className="h-3.5 w-3.5 text-[#EAE7E0]/45" aria-hidden="true" />
            </div>
            <p className="mt-2 font-mono-num text-2xl font-bold text-[#EAE7E0]">
              {stats.totalCount}
            </p>
            <p className="mt-1 font-mono-num text-[11px] text-[#EAE7E0]/50">
              {isAudience
                ? `₹${AUDIENCE_PASS_FEE_INR} fixed watch-only pass`
                : `Ind: ${stats.individualCount} · Cpl: ${stats.coupleCount} · Grp: ${stats.groupCount}`}
            </p>
          </div>

          <div className="border border-[#C8F36B]/30 bg-[#050505] p-4">
            <div className="flex items-center justify-between text-xs text-[#C8F36B]">
              <span>{isAudience ? 'Verified Audience' : 'Verified Participants'}</span>
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
            </div>
            <p className="mt-2 font-mono-num text-2xl font-bold text-[#C8F36B]">
              {stats.verifiedCount}
            </p>
            <p className="mt-1 font-mono-num text-[11px] text-[#EAE7E0]/50">
              {stats.rejectedCount} rejected
            </p>
          </div>

          <div className="border border-[#F59E0B]/30 bg-[#050505] p-4">
            <div className="flex items-center justify-between text-xs text-[#F59E0B]">
              <span>{isAudience ? 'Pending Audience Payments' : 'Pending Participant Payments'}</span>
              <Clock className="h-3.5 w-3.5" aria-hidden="true" />
            </div>
            <p className="mt-2 font-mono-num text-2xl font-bold text-[#F59E0B]">
              {stats.pendingCount}
            </p>
            <p className="mt-1 font-mono-num text-[11px] text-[#EAE7E0]/50">
              {stats.pendingSubmissionCount} proof{stats.pendingSubmissionCount === 1 ? '' : 's'} in queue
            </p>
          </div>

          <div className="border border-[#EAE7E0]/12 bg-[#050505] p-4">
            <div className="flex items-center justify-between text-xs text-[#EAE7E0]/65">
              <span>{isAudience ? 'Audience Revenue' : 'Participant Revenue'}</span>
              <IndianRupee className="h-3.5 w-3.5 text-[#C8F36B]" aria-hidden="true" />
            </div>
            <p className="mt-2 font-mono-num text-2xl font-bold text-[#C8F36B]">
              {formatInr(stats.verifiedRevenueInr)}
            </p>
            <p className="mt-1 text-[11px] text-[#EAE7E0]/50">Deduplicated verified total</p>
          </div>

          <div className={`border ${accentBorder} bg-[#050505] p-4`}>
            <div className={`flex items-center justify-between text-xs ${accentText}`}>
              <span>{isAudience ? 'Audience Check-Ins' : 'Participant Check-Ins'}</span>
              <QrCode className="h-3.5 w-3.5" aria-hidden="true" />
            </div>
            <p className="mt-2 font-mono-num text-2xl font-bold text-[#EAE7E0]">
              {checkedInForSection}{' '}
              <span className="text-sm font-normal text-[#EAE7E0]/50">
                / {validTicketsForSection}
              </span>
            </p>
            <p className="mt-1 text-[11px] text-[#EAE7E0]/50">
              {validTicketsForSection > 0
                ? `${Math.round((checkedInForSection / validTicketsForSection) * 100)}% checked in at gate`
                : 'No active passes issued yet'}
            </p>
          </div>
        </div>

        {/* Participant Tier Quick Breakdown */}
        {!isAudience && (
          <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            {(['individual', 'couple', 'group'] as const).map((tier) => {
              const option = ENTRY_PASS_OPTIONS[tier];
              const meta = ENTRY_TYPE_META[tier];
              const count =
                tier === 'individual'
                  ? stats.individualCount
                  : tier === 'couple'
                    ? stats.coupleCount
                    : stats.groupCount;
              const isSelected = tierFilter === tier;

              return (
                <button
                  key={tier}
                  type="button"
                  onClick={() => {
                    setSubTab('registrations');
                    setTierFilter((prev) => (prev === tier ? 'all' : tier));
                    setCurrentPage(1);
                  }}
                  className={`flex cursor-pointer items-center justify-between border px-4 py-2.5 text-left transition-colors ${
                    isSelected
                      ? 'border-[#FF1744] bg-[#FF1744]/15'
                      : 'border-[#EAE7E0]/12 bg-[#050505] hover:border-[#EAE7E0]/35'
                  }`}
                >
                  <div>
                    <p className={`text-xs font-bold ${meta.accentClass}`}>
                      {option.label} · {formatInr(option.price)}
                    </p>
                    <p className="text-[11px] text-[#EAE7E0]/55">{option.participantSummary}</p>
                  </div>
                  <span className="font-mono-num text-xl font-bold text-[#EAE7E0]">
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Section Sub-Navigation: Registrations & Tickets vs Payment Verification */}
      <div className="flex flex-wrap items-center justify-between gap-3 border border-[#EAE7E0]/12 bg-[#0B0B0D] px-4 py-3">
        <div
          className="flex flex-wrap items-center gap-2"
          role="tablist"
          aria-label={`${isAudience ? 'Audience' : 'Participant'} workspace tabs`}
        >
          <button
            type="button"
            role="tab"
            aria-selected={subTab === 'registrations'}
            onClick={() => setSubTab('registrations')}
            className={`inline-flex min-h-[38px] cursor-pointer items-center gap-2 border px-4 py-1.5 font-mono-num text-xs font-semibold uppercase transition-colors ${
              subTab === 'registrations'
                ? isAudience
                  ? 'border-[#00E5FF] bg-[#00E5FF] text-[#050505]'
                  : 'border-[#FF1744] bg-[#FF1744] text-[#EAE7E0]'
                : 'border-[#EAE7E0]/15 bg-[#050505] text-[#EAE7E0]/75 hover:border-[#EAE7E0]/40'
            }`}
          >
            <Users className="h-3.5 w-3.5" aria-hidden="true" />
            <span>
              {isAudience ? 'Audience Registrations & Tickets' : 'Participant Registrations & Tickets'} (
              {registrations.length})
            </span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={subTab === 'payments'}
            onClick={() => setSubTab('payments')}
            className={`inline-flex min-h-[38px] cursor-pointer items-center gap-2 border px-4 py-1.5 font-mono-num text-xs font-semibold uppercase transition-colors ${
              subTab === 'payments'
                ? isAudience
                  ? 'border-[#00E5FF] bg-[#00E5FF] text-[#050505]'
                  : 'border-[#FF1744] bg-[#FF1744] text-[#EAE7E0]'
                : 'border-[#EAE7E0]/15 bg-[#050505] text-[#EAE7E0]/75 hover:border-[#EAE7E0]/40'
            }`}
          >
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            <span>
              {isAudience ? 'Audience Payment Verification' : 'Participant Payment Verification'} (
              {stats.pendingSubmissionCount} pending / {submissions.length})
            </span>
          </button>
        </div>

        <span className="font-mono-num text-[11px] text-[#EAE7E0]/55">
          {isAudience ? 'Audience records only' : 'Participant records only'}
        </span>
      </div>

      {/* SUB-TAB 1: Registrations & Ticket Info */}
      {subTab === 'registrations' && (
        <section aria-label="Section registrations and tickets" className="space-y-4">
          {/* Search & Filters */}
          <div className="flex flex-wrap items-center justify-between gap-3 border border-[#EAE7E0]/12 bg-[#0B0B0D] p-4">
            <div className="grid w-full flex-1 grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
              <div className="relative xl:col-span-2">
                <Search
                  className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[#EAE7E0]/45"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  value={regSearch}
                  onChange={(e) => {
                    setRegSearch(e.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder={`Search ${isAudience ? 'audience' : 'participant'} name, ticket ID, reg code, UTR...`}
                  aria-label={`Search ${isAudience ? 'audience' : 'participant'} registrations`}
                  className="min-h-[40px] w-full border border-[#EAE7E0]/18 bg-[#050505] pr-3 pl-9 text-xs text-[#EAE7E0] placeholder-[#EAE7E0]/40 focus:border-[#00E5FF] focus:outline-none"
                />
              </div>

              {!isAudience && (
                <select
                  aria-label="Filter by participant tier"
                  value={tierFilter}
                  onChange={(e) => {
                    setTierFilter(e.target.value as 'all' | EntryPassTierId);
                    setCurrentPage(1);
                  }}
                  className="min-h-[40px] border border-[#EAE7E0]/18 bg-[#050505] px-3 text-xs text-[#EAE7E0] focus:border-[#FF1744] focus:outline-none"
                >
                  <option value="all">All Tiers (₹99 / ₹149 / ₹199)</option>
                  <option value="individual">Individual (₹99)</option>
                  <option value="couple">Couple (₹149)</option>
                  <option value="group">Group (₹199)</option>
                </select>
              )}

              {!isAudience && (
                <select
                  aria-label="Filter by performance category"
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
              )}

              <select
                aria-label="Filter by payment status"
                value={regStatusFilter}
                onChange={(e) => {
                  setRegStatusFilter(e.target.value as 'all' | CanonicalPaymentStatus);
                  setCurrentPage(1);
                }}
                className="min-h-[40px] border border-[#EAE7E0]/18 bg-[#050505] px-3 text-xs text-[#EAE7E0] focus:border-[#00E5FF] focus:outline-none"
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending Verification</option>
                <option value="verified">Verified / Paid</option>
                <option value="rejected">Rejected</option>
              </select>

              <select
                aria-label="Sort registrations"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as SortOrder)}
                className="min-h-[40px] border border-[#EAE7E0]/18 bg-[#050505] px-3 text-xs text-[#EAE7E0] focus:border-[#00E5FF] focus:outline-none"
              >
                <option value="newest">Sort: Newest First</option>
                <option value="oldest">Sort: Oldest First</option>
                <option value="amount_desc">Sort: Highest Amount</option>
              </select>
            </div>

            {hasActiveRegFilters && (
              <button
                type="button"
                onClick={resetRegFilters}
                className="inline-flex min-h-[38px] cursor-pointer items-center gap-1.5 border border-[#EAE7E0]/20 bg-[#050505] px-3 py-1.5 text-xs font-medium text-[#EAE7E0]/80 transition-colors hover:border-[#EAE7E0]/45"
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Reset</span>
              </button>
            )}
          </div>

          {isLoading && registrations.length === 0 ? (
            <div className="space-y-2 border border-[#EAE7E0]/12 bg-[#0B0B0D] p-4">
              {Array.from({ length: 5 }).map((_, idx) => (
                <div
                  key={idx}
                  className="h-12 w-full animate-pulse border border-[#EAE7E0]/8 bg-[#121216]"
                />
              ))}
            </div>
          ) : filteredRegistrations.length === 0 ? (
            <div className="border border-[#EAE7E0]/12 bg-[#0B0B0D] px-6 py-12 text-center">
              <p className="font-display text-2xl font-bold text-[#EAE7E0] uppercase">
                {registrations.length === 0
                  ? `No ${isAudience ? 'Audience' : 'Participant'} Registrations Yet`
                  : 'No Matching Records'}
              </p>
              <p className="mx-auto mt-2 max-w-md text-xs text-[#EAE7E0]/60">
                {registrations.length === 0
                  ? `${isAudience ? 'Audience watch-only (₹59)' : 'Performer'} registrations will appear here automatically once submitted.`
                  : 'Try clearing your search or status/tier filters.'}
              </p>
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden overflow-x-auto border border-[#EAE7E0]/12 bg-[#0B0B0D] lg:block">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#EAE7E0]/12 bg-[#050505] font-mono-num text-[11px] tracking-wider text-[#EAE7E0]/60 uppercase">
                      <th className="px-4 py-3 font-medium">Reg Code / Date</th>
                      <th className="px-4 py-3 font-medium">
                        {isAudience ? 'Audience Attendee' : 'Participant & Team'}
                      </th>
                      <th className="px-4 py-3 font-medium">Contact & College</th>
                      <th className="px-4 py-3 font-medium">
                        {isAudience ? 'Pass & Fee' : 'Tier & Categories'}
                      </th>
                      <th className="px-4 py-3 font-medium">Ticket Info</th>
                      <th className="px-4 py-3 font-medium">Payment Status & UTR</th>
                      <th className="px-4 py-3 text-right font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EAE7E0]/8">
                    {paginatedRegistrations.map((reg) => {
                      const linkedSub =
                        submissionsByRegId.get(reg.id) ??
                        submissionsByRegId.get(reg.registrationCode);
                      const statusMeta = PAYMENT_STATUS_META[reg.paymentStatus];
                      const entryMeta = ENTRY_TYPE_META[reg.entryType];
                      const ticketInfo =
                        ticketStatusByRegId.get(reg.id) ??
                        ticketStatusByRegId.get(reg.registrationCode);
                      const derivedTicketStatus: AdminTicketStatusCode =
                        ticketInfo?.ticketStatus ??
                        (reg.paymentStatus === 'verified'
                          ? 'issued'
                          : reg.paymentStatus === 'rejected'
                            ? 'rejected'
                            : 'pending');
                      const ticketMeta = TICKET_STATUS_META[derivedTicketStatus];

                      return (
                        <tr key={reg.id} className="transition-colors hover:bg-[#EAE7E0]/[0.03]">
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
                            {isAudience ? (
                              <div className="mt-0.5 text-[11px] text-[#00E5FF]">
                                Watch Only · 1 Person
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
                            </div>
                            <div className="mt-0.5 text-[11px] text-[#EAE7E0]/55">
                              {reg.collegeName} · {reg.city}
                            </div>
                          </td>

                          <td className="px-4 py-3.5 align-top">
                            {isAudience ? (
                              <>
                                <span className="inline-block border border-[#00E5FF]/50 bg-[#00E5FF]/10 px-1.5 py-0.5 font-mono-num text-[10px] font-bold text-[#00E5FF] uppercase">
                                  AUDIENCE PASS · ₹{AUDIENCE_PASS_FEE_INR}
                                </span>
                                <div className="mt-1 font-mono-num font-bold text-[#EAE7E0]">
                                  {formatInr(reg.amountInr)}
                                </div>
                                <div className="mt-0.5 text-[11px] text-[#EAE7E0]/60">
                                  No stage performance rights
                                </div>
                              </>
                            ) : (
                              <>
                                <span className={`font-semibold ${entryMeta.accentClass}`}>
                                  {entryMeta.label}
                                </span>
                                <span className="ml-1.5 font-mono-num font-bold text-[#EAE7E0]">
                                  ({formatInr(reg.amountInr)})
                                </span>
                                <div className="mt-0.5 text-[11px] text-[#EAE7E0]/75">
                                  {reg.categoriesDisplay}
                                </div>
                              </>
                            )}
                          </td>

                          <td className="px-4 py-3.5 align-top whitespace-nowrap">
                            <span
                              className={`inline-flex items-center border px-2 py-0.5 font-mono-num text-[10px] font-bold uppercase ${ticketMeta.badgeClass}`}
                            >
                              {ticketMeta.label}
                            </span>
                            <div className="mt-1 font-mono-num text-[11px] text-[#EAE7E0]/85">
                              {ticketInfo?.ticketId
                                ? ticketInfo.ticketId
                                : reg.paymentStatus === 'verified'
                                  ? 'Issued'
                                  : 'Locked until verified'}
                            </div>
                            {ticketInfo?.checkedInAt && (
                              <div className="mt-0.5 font-mono-num text-[10px] text-[#C8F36B]">
                                In: {formatDateTime(ticketInfo.checkedInAt)}
                              </div>
                            )}
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
                {paginatedRegistrations.map((reg) => {
                  const linkedSub =
                    submissionsByRegId.get(reg.id) ??
                    submissionsByRegId.get(reg.registrationCode);
                  const statusMeta = PAYMENT_STATUS_META[reg.paymentStatus];
                  const entryMeta = ENTRY_TYPE_META[reg.entryType];
                  const ticketInfo =
                    ticketStatusByRegId.get(reg.id) ??
                    ticketStatusByRegId.get(reg.registrationCode);
                  const derivedTicketStatus: AdminTicketStatusCode =
                    ticketInfo?.ticketStatus ??
                    (reg.paymentStatus === 'verified'
                      ? 'issued'
                      : reg.paymentStatus === 'rejected'
                        ? 'rejected'
                        : 'pending');
                  const ticketMeta = TICKET_STATUS_META[derivedTicketStatus];

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

                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                        {isAudience ? (
                          <span className="border border-[#00E5FF]/50 bg-[#00E5FF]/10 px-1.5 py-0.5 font-mono-num text-[10px] font-bold text-[#00E5FF] uppercase">
                            AUDIENCE · ₹59 · Watch Only
                          </span>
                        ) : (
                          <>
                            <span className={`font-semibold ${entryMeta.accentClass}`}>
                              {entryMeta.label}
                            </span>
                            <span className="text-[#EAE7E0]/35">·</span>
                            <span className="text-[#EAE7E0]/75">{reg.categoriesDisplay}</span>
                            <span className="text-[#EAE7E0]/35">·</span>
                            <span className="font-mono-num text-[#EAE7E0]/75">
                              {reg.participantCount} pax
                            </span>
                          </>
                        )}
                      </div>

                      <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[11px]">
                        <span
                          className={`border px-2 py-0.5 font-mono-num font-bold uppercase ${ticketMeta.badgeClass}`}
                        >
                          {ticketMeta.label}
                        </span>
                        {ticketInfo?.ticketId && (
                          <span className="font-mono-num text-[#EAE7E0]/80">
                            {ticketInfo.ticketId}
                          </span>
                        )}
                      </div>

                      <div className="mt-2 text-xs text-[#EAE7E0]/65">
                        <p>
                          {reg.collegeName} · {reg.city}
                        </p>
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

              {/* Pagination */}
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
      )}

      {/* SUB-TAB 2: Scoped Payment Verification Queue */}
      {subTab === 'payments' && (
        <section aria-label="Section payment verification" className="space-y-4">
          <div className="flex flex-col gap-3 border border-[#EAE7E0]/12 bg-[#0B0B0D] p-4 md:flex-row md:items-center md:justify-between">
            <div
              className="flex flex-wrap items-center gap-1.5"
              role="tablist"
              aria-label="Section payment status filter"
            >
              {(
                [
                  { id: 'all', label: `All (${submissions.length})` },
                  { id: 'pending', label: `Pending (${stats.pendingSubmissionCount})` },
                  { id: 'verified', label: `Verified (${stats.verifiedSubmissionCount})` },
                  { id: 'rejected', label: `Rejected (${stats.rejectedSubmissionCount})` },
                ] as const
              ).map((tab) => {
                const active = payStatusFilter === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setPayStatusFilter(tab.id)}
                    className={`min-h-[36px] cursor-pointer border px-3 py-1.5 font-mono-num text-xs font-semibold whitespace-nowrap transition-colors ${
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

            <div className="flex items-center gap-3">
              <div className="hidden items-center gap-1.5 border border-[#F59E0B]/35 bg-[#F59E0B]/10 px-2.5 py-1.5 text-[11px] text-[#F59E0B] xl:inline-flex">
                <ShieldAlert className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>Manual verification required</span>
              </div>

              <div className="relative w-full md:w-72">
                <Search
                  className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[#EAE7E0]/45"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  value={paySearch}
                  onChange={(e) => setPaySearch(e.target.value)}
                  placeholder="Search UTR, name, code, college..."
                  aria-label={`Search ${isAudience ? 'audience' : 'participant'} payment submissions`}
                  className="min-h-[38px] w-full border border-[#EAE7E0]/18 bg-[#050505] pr-3 pl-9 text-xs text-[#EAE7E0] placeholder-[#EAE7E0]/40 focus:border-[#00E5FF] focus:outline-none"
                />
              </div>
            </div>
          </div>

          {isLoading && submissions.length === 0 ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, idx) => (
                <div
                  key={idx}
                  className="h-24 w-full animate-pulse border border-[#EAE7E0]/12 bg-[#0B0B0D]"
                />
              ))}
            </div>
          ) : filteredSubmissions.length === 0 ? (
            <div className="border border-[#EAE7E0]/12 bg-[#0B0B0D] px-6 py-12 text-center">
              <p className="font-display text-2xl font-bold text-[#EAE7E0] uppercase">
                {submissions.length === 0
                  ? `No ${isAudience ? 'Audience' : 'Participant'} Payment Proofs Yet`
                  : 'No Matching Submissions'}
              </p>
              <p className="mx-auto mt-2 max-w-md text-xs text-[#EAE7E0]/60">
                {submissions.length === 0
                  ? `Uploaded UPI screenshots for ${isAudience ? 'Audience (₹59)' : 'Participant'} registrations will appear here.`
                  : 'Try switching status tabs or clearing your search query.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredSubmissions.map((sub) => {
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

                        <span
                          className={`text-xs font-semibold ${
                            isAudience ? 'text-[#00E5FF]' : entryMeta.accentClass
                          }`}
                        >
                          {isAudience ? 'Audience Pass' : entryMeta.label} ·{' '}
                          <span className="font-mono-num">{formatInr(sub.amountInr)}</span>
                        </span>
                      </div>

                      <div>
                        <h3 className="text-base font-bold text-[#EAE7E0]">
                          {sub.participantName}
                          {!isAudience &&
                          sub.teamOrIndividualName &&
                          sub.teamOrIndividualName !== '—'
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
      )}
    </div>
  );
}
