import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Eye,
  Mic2,
  QrCode,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  UserPlus,
  UserX,
  Users,
  X,
} from 'lucide-react';
import { selectScopedCheckinReportData } from '../../services/adminSelectors';
import {
  authorizeAdminStaffMember,
  fetchAdminCheckinReport,
  fetchAdminStaffList,
  reverseAdminCheckin,
  updateAdminStaffAccess,
} from '../../services/staffApi';
import type {
  AdminCheckInRecordItem,
  AdminCheckInReportPayload,
  CheckInSummaryStats,
  StaffUserListItem,
} from '../../types/staff';
import type { RegistrationType } from '../../types/registration';

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const EMPTY_CHECKIN_STATS: CheckInSummaryStats = {
  totalValidTickets: 0,
  checkedInCount: 0,
  remainingCount: 0,
  checkInRatePercent: 0,
  participantValidTickets: 0,
  participantCheckedInCount: 0,
  participantRemainingCount: 0,
  participantCheckInRatePercent: 0,
  audienceValidTickets: 0,
  audienceCheckedInCount: 0,
  audienceRemainingCount: 0,
  audienceCheckInRatePercent: 0,
};

interface AdminCheckinsAndStaffViewProps {
  onCheckinChanged?: () => void;
}

export function AdminCheckinsAndStaffView({
  onCheckinChanged,
}: AdminCheckinsAndStaffViewProps = {}) {
  const [report, setReport] = useState<AdminCheckInReportPayload | null>(null);
  const [staffUsers, setStaffUsers] = useState<StaffUserListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  // Strictly separated workspaces: 'PARTICIPANT' vs 'AUDIENCE' (no combined mixed table)
  const [activeWorkspace, setActiveWorkspace] = useState<RegistrationType>('PARTICIPANT');
  const [searchByWorkspace, setSearchByWorkspace] = useState<Record<RegistrationType, string>>({
    PARTICIPANT: '',
    AUDIENCE: '',
  });
  const loadSeqRef = useRef(0);

  // Authorize new staff form state
  const [staffName, setStaffName] = useState('');
  const [staffEmail, setStaffEmail] = useState('');
  const [staffPassword, setStaffPassword] = useState('');
  const [isAuthorizing, setIsAuthorizing] = useState(false);
  const [togglingUserId, setTogglingUserId] = useState<string | null>(null);

  // Reversal modal state
  const [reversingItem, setReversingItem] = useState<AdminCheckInRecordItem | null>(null);
  const [reversalReason, setReversalReason] = useState('');
  const [isReversing, setIsReversing] = useState(false);

  const loadAll = useCallback(async () => {
    const seq = ++loadSeqRef.current;
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const [reportData, staffData] = await Promise.all([
        fetchAdminCheckinReport(activeWorkspace),
        fetchAdminStaffList(),
      ]);
      if (seq !== loadSeqRef.current) return;
      setReport(reportData);
      setStaffUsers(staffData);
    } catch (err) {
      if (seq !== loadSeqRef.current) return;
      setErrorMessage(
        err instanceof Error ? err.message : 'Unable to load check-in analytics and staff list.'
      );
    } finally {
      if (seq === loadSeqRef.current) {
        setIsLoading(false);
      }
    }
  }, [activeWorkspace]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  // Strictly partition records by server-side registration_type
  const scopedWorkspace = useMemo(
    () => selectScopedCheckinReportData(report, activeWorkspace),
    [report, activeWorkspace]
  );

  const currentSearchQuery = searchByWorkspace[activeWorkspace];
  const isAudienceWorkspace = activeWorkspace === 'AUDIENCE';

  const searchedCheckins = useMemo(() => {
    const q = currentSearchQuery.trim().toLowerCase();
    if (!q) return scopedWorkspace.checkedInTickets;
    return scopedWorkspace.checkedInTickets.filter((item) =>
      [
        item.ticketId,
        item.registrationCode,
        item.participantOrTeamName,
        item.fullName,
        item.passCategoryLabel,
        item.categoriesDisplay,
        item.checkedInByName,
        item.checkedInByEmail,
      ]
        .join(' ')
        .toLowerCase()
        .includes(q)
    );
  }, [scopedWorkspace.checkedInTickets, currentSearchQuery]);

  const handleAuthorizeStaff = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setStatusNotice(null);
    setIsAuthorizing(true);
    try {
      const res = await authorizeAdminStaffMember({
        fullName: staffName,
        email: staffEmail,
        initialPassword: staffPassword.trim() ? staffPassword : undefined,
      });
      setStatusNotice(res.message);
      setStaffName('');
      setStaffEmail('');
      setStaffPassword('');
      await loadAll();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Unable to authorize staff member.');
    } finally {
      setIsAuthorizing(false);
    }
  };

  const handleToggleStaffAccess = async (staff: StaffUserListItem) => {
    setErrorMessage(null);
    setStatusNotice(null);
    setTogglingUserId(staff.userId);
    try {
      const res = await updateAdminStaffAccess({
        userId: staff.userId,
        action: staff.isActive ? 'revoke' : 'reactivate',
      });
      setStatusNotice(res.message);
      await loadAll();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Unable to update staff access.');
    } finally {
      setTogglingUserId(null);
    }
  };

  const handleConfirmReversal = async (e: FormEvent) => {
    e.preventDefault();
    if (!reversingItem) return;
    setErrorMessage(null);
    setStatusNotice(null);
    setIsReversing(true);
    try {
      const res = await reverseAdminCheckin({
        ticketId: reversingItem.ticketId,
        reason: reversalReason,
      });
      setStatusNotice(res.message);
      setReversingItem(null);
      setReversalReason('');
      await loadAll();
      onCheckinChanged?.();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Unable to reverse check-in.');
    } finally {
      setIsReversing(false);
    }
  };

  const stats = report?.stats ?? EMPTY_CHECKIN_STATS;
  const activeStaffCount = staffUsers.filter((s) => s.isActive).length;

  return (
    <div className="space-y-8">
      {/* Header / Refresh */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-mono-num text-[11px] tracking-wider text-[#00E5FF] uppercase">
            Live Gate Attendance & Staff Access Control
          </p>
          <p className="mt-1 text-xs text-[#EAE7E0]/65">
            Monitor overall attendance, switch between isolated{' '}
            <span className="text-[#FF1744]">Participant</span> and{' '}
            <span className="text-[#00E5FF]">Audience</span> check-in workspaces, and manage{' '}
            <span className="font-mono-num text-[#EAE7E0]">/staff-checkin</span> operators.
          </p>
        </div>

        <button
          type="button"
          disabled={isLoading}
          onClick={() => void loadAll()}
          className="inline-flex min-h-[38px] cursor-pointer items-center gap-2 border border-[#EAE7E0]/20 bg-[#0B0B0D] px-3.5 py-1.5 font-mono-num text-xs text-[#EAE7E0] transition-colors hover:border-[#00E5FF] hover:text-[#00E5FF] disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} aria-hidden="true" />
          <span>Refresh Report</span>
        </button>
      </div>

      {errorMessage && (
        <div
          role="alert"
          className="flex items-start gap-2.5 border border-[#FF1744]/50 bg-[#FF1744]/10 p-4 text-xs text-[#EAE7E0]"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#FF1744]" aria-hidden="true" />
          <span>{errorMessage}</span>
        </div>
      )}

      {statusNotice && (
        <div
          role="status"
          className="flex items-start justify-between gap-2.5 border border-[#C8F36B]/50 bg-[#C8F36B]/10 p-4 text-xs text-[#EAE7E0]"
        >
          <div className="flex items-start gap-2.5">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#C8F36B]" aria-hidden="true" />
            <span>{statusNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusNotice(null)}
            aria-label="Dismiss notification"
            className="cursor-pointer text-[#EAE7E0]/60 hover:text-[#EAE7E0]"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}

      {/* 3. COMBINED ATTENDANCE OVERVIEW */}
      <section aria-labelledby="combined-attendance-heading" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-[#C8F36B]" aria-hidden="true" />
            <h2
              id="combined-attendance-heading"
              className="font-display text-lg font-black tracking-tight text-[#EAE7E0] uppercase"
            >
              Combined Attendance
            </h2>
          </div>
          <p className="font-mono-num text-[11px] text-[#EAE7E0]/55">
            Combined Total: {stats.checkedInCount} / {stats.totalValidTickets} valid passes checked in
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="border border-[#EAE7E0]/12 bg-[#0B0B0D] p-5">
            <p className="font-mono-num text-[11px] tracking-wider text-[#EAE7E0]/55 uppercase">
              Total Valid Tickets
            </p>
            <p className="mt-2 font-display text-3xl font-black text-[#EAE7E0]">
              {stats.totalValidTickets}
            </p>
            <p className="mt-1 font-mono-num text-[11px] text-[#EAE7E0]/55">
              {stats.participantValidTickets} participant · {stats.audienceValidTickets} audience
            </p>
          </div>

          <div className="border border-[#C8F36B]/35 bg-[#0B0B0D] p-5">
            <p className="font-mono-num text-[11px] tracking-wider text-[#C8F36B] uppercase">
              Combined Check-Ins
            </p>
            <p className="mt-2 font-display text-3xl font-black text-[#C8F36B]">
              {stats.checkedInCount}
            </p>
            <p className="mt-1 font-mono-num text-[11px] text-[#EAE7E0]/60">
              {stats.remainingCount} remaining across both tiers
            </p>
          </div>

          <button
            type="button"
            onClick={() => setActiveWorkspace('PARTICIPANT')}
            className={`cursor-pointer border bg-[#0B0B0D] p-5 text-left transition-colors ${
              activeWorkspace === 'PARTICIPANT'
                ? 'border-[#FF1744] bg-[#FF1744]/8'
                : 'border-[#FF1744]/35 hover:border-[#FF1744]'
            }`}
          >
            <p className="font-mono-num text-[11px] tracking-wider text-[#FF1744] uppercase">
              Participant Check-Ins
            </p>
            <p className="mt-2 font-display text-3xl font-black text-[#EAE7E0]">
              {stats.participantCheckedInCount}{' '}
              <span className="font-mono-num text-sm font-normal text-[#EAE7E0]/50">
                / {stats.participantValidTickets}
              </span>
            </p>
            <p className="mt-1 font-mono-num text-[11px] text-[#EAE7E0]/55">
              {stats.participantCheckInRatePercent}% attendance · {stats.participantRemainingCount} pending
            </p>
          </button>

          <button
            type="button"
            onClick={() => setActiveWorkspace('AUDIENCE')}
            className={`cursor-pointer border bg-[#0B0B0D] p-5 text-left transition-colors ${
              activeWorkspace === 'AUDIENCE'
                ? 'border-[#00E5FF] bg-[#00E5FF]/8'
                : 'border-[#00E5FF]/35 hover:border-[#00E5FF]'
            }`}
          >
            <p className="font-mono-num text-[11px] tracking-wider text-[#00E5FF] uppercase">
              Audience Check-Ins
            </p>
            <p className="mt-2 font-display text-3xl font-black text-[#EAE7E0]">
              {stats.audienceCheckedInCount}{' '}
              <span className="font-mono-num text-sm font-normal text-[#EAE7E0]/50">
                / {stats.audienceValidTickets}
              </span>
            </p>
            <p className="mt-1 font-mono-num text-[11px] text-[#EAE7E0]/55">
              {stats.audienceCheckInRatePercent}% attendance · {stats.audienceRemainingCount} pending
            </p>
          </button>

          <div className="border border-[#EAE7E0]/12 bg-[#0B0B0D] p-5">
            <p className="font-mono-num text-[11px] tracking-wider text-[#EAE7E0]/55 uppercase">
              Combined Attendance Rate
            </p>
            <p className="mt-2 font-display text-3xl font-black text-[#EAE7E0]">
              {stats.checkInRatePercent}%
            </p>
            <div className="mt-2 h-1.5 w-full bg-[#EAE7E0]/10">
              <div
                className="h-full bg-[#C8F36B] transition-all"
                style={{ width: `${Math.min(100, stats.checkInRatePercent)}%` }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* 1 & 2. TWO COMPLETELY SEPARATE CHECK-IN WORKSPACES */}
      <section aria-label="Check-In Workspaces" className="space-y-5">
        {/* Strict Two-Workspace Selector Tabs */}
        <div
          role="tablist"
          aria-label="Isolated check-in workspaces"
          className="grid grid-cols-1 gap-3 sm:grid-cols-2"
        >
          <button
            id="checkin-tab-PARTICIPANT"
            type="button"
            role="tab"
            aria-selected={activeWorkspace === 'PARTICIPANT'}
            aria-controls="checkin-panel-PARTICIPANT"
            onClick={() => setActiveWorkspace('PARTICIPANT')}
            className={`flex cursor-pointer items-center justify-between gap-3 border px-5 py-4 text-left transition-colors ${
              activeWorkspace === 'PARTICIPANT'
                ? 'border-[#FF1744] bg-[#FF1744]/12 text-[#EAE7E0]'
                : 'border-[#EAE7E0]/15 bg-[#0B0B0D] text-[#EAE7E0]/70 hover:border-[#FF1744]/50 hover:text-[#EAE7E0]'
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center border ${
                  activeWorkspace === 'PARTICIPANT'
                    ? 'border-[#FF1744] bg-[#FF1744] text-[#EAE7E0]'
                    : 'border-[#EAE7E0]/15 bg-[#050505] text-[#FF1744]'
                }`}
              >
                <Mic2 className="h-4 w-4" aria-hidden="true" />
              </div>
              <div>
                <p className="font-display text-base font-black tracking-tight uppercase">
                  Participant Check-Ins
                </p>
                <p className="font-mono-num text-[10px] tracking-wider text-[#EAE7E0]/60 uppercase">
                  Strictly registration_type = &apos;PARTICIPANT&apos;
                </p>
              </div>
            </div>

            <div className="text-right">
              <p className="font-mono-num text-lg font-bold text-[#EAE7E0]">
                {stats.participantCheckedInCount}
                <span className="text-xs font-normal text-[#EAE7E0]/50">
                  {' '}
                  / {stats.participantValidTickets}
                </span>
              </p>
              <p className="font-mono-num text-[10px] text-[#FF1744]">
                {stats.participantCheckInRatePercent}% in
              </p>
            </div>
          </button>

          <button
            id="checkin-tab-AUDIENCE"
            type="button"
            role="tab"
            aria-selected={activeWorkspace === 'AUDIENCE'}
            aria-controls="checkin-panel-AUDIENCE"
            onClick={() => setActiveWorkspace('AUDIENCE')}
            className={`flex cursor-pointer items-center justify-between gap-3 border px-5 py-4 text-left transition-colors ${
              activeWorkspace === 'AUDIENCE'
                ? 'border-[#00E5FF] bg-[#00E5FF]/12 text-[#EAE7E0]'
                : 'border-[#EAE7E0]/15 bg-[#0B0B0D] text-[#EAE7E0]/70 hover:border-[#00E5FF]/50 hover:text-[#EAE7E0]'
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center border ${
                  activeWorkspace === 'AUDIENCE'
                    ? 'border-[#00E5FF] bg-[#00E5FF] text-[#050505]'
                    : 'border-[#EAE7E0]/15 bg-[#050505] text-[#00E5FF]'
                }`}
              >
                <Eye className="h-4 w-4" aria-hidden="true" />
              </div>
              <div>
                <p className="font-display text-base font-black tracking-tight uppercase">
                  Audience Check-Ins
                </p>
                <p className="font-mono-num text-[10px] tracking-wider text-[#EAE7E0]/60 uppercase">
                  Strictly registration_type = &apos;AUDIENCE&apos;
                </p>
              </div>
            </div>

            <div className="text-right">
              <p className="font-mono-num text-lg font-bold text-[#EAE7E0]">
                {stats.audienceCheckedInCount}
                <span className="text-xs font-normal text-[#EAE7E0]/50">
                  {' '}
                  / {stats.audienceValidTickets}
                </span>
              </p>
              <p className="font-mono-num text-[10px] text-[#00E5FF]">
                {stats.audienceCheckInRatePercent}% in
              </p>
            </div>
          </button>
        </div>

        {/* Isolated Active Workspace Panel */}
        <div
          id={`checkin-panel-${activeWorkspace}`}
          role="tabpanel"
          aria-labelledby={`checkin-tab-${activeWorkspace}`}
          className={`space-y-6 border bg-[#0B0B0D] p-5 sm:p-6 ${
            isAudienceWorkspace ? 'border-[#00E5FF]/40' : 'border-[#FF1744]/40'
          }`}
        >
          {/* Workspace Header Banner */}
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#EAE7E0]/10 pb-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`border px-2 py-0.5 font-mono-num text-[10px] font-bold tracking-wider uppercase ${
                    isAudienceWorkspace
                      ? 'border-[#00E5FF]/50 bg-[#00E5FF]/15 text-[#00E5FF]'
                      : 'border-[#FF1744]/50 bg-[#FF1744]/15 text-[#FF1744]'
                  }`}
                >
                  {isAudienceWorkspace
                    ? "registration_type = 'AUDIENCE'"
                    : "registration_type = 'PARTICIPANT'"}
                </span>
                <span className="font-mono-num text-[11px] text-[#EAE7E0]/55">
                  Server-enforced workspace isolation
                </span>
              </div>
              <h3 className="mt-2 font-display text-2xl font-black tracking-tight text-[#EAE7E0] uppercase">
                {isAudienceWorkspace
                  ? 'Audience Check-Ins Workspace'
                  : 'Participant Check-Ins Workspace'}
              </h3>
              <p className="mt-1 text-xs text-[#EAE7E0]/60">
                {isAudienceWorkspace
                  ? 'Watch-only ₹59 Audience Passes. Displays audience check-in history, ticket IDs, registration codes, scan timestamps, staff operators, and audience attendance stats.'
                  : 'Stage Performer Passes (Individual / Couple / Group). Displays participant check-in history, ticket IDs, registration codes, scan timestamps, staff operators, and performer attendance stats.'}
              </p>
            </div>

            <div className="relative w-full sm:w-72">
              <Search
                className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-[#EAE7E0]/45"
                aria-hidden="true"
              />
              <input
                type="search"
                value={currentSearchQuery}
                onChange={(e) =>
                  setSearchByWorkspace((prev) => ({
                    ...prev,
                    [activeWorkspace]: e.target.value,
                  }))
                }
                placeholder={
                  isAudienceWorkspace
                    ? 'Search audience ticket ID, code, guest...'
                    : 'Search participant ticket ID, code, team...'
                }
                aria-label={
                  isAudienceWorkspace
                    ? 'Search audience checked-in tickets'
                    : 'Search participant checked-in tickets'
                }
                className="min-h-[38px] w-full border border-[#EAE7E0]/20 bg-[#050505] pr-3 pl-8 text-xs text-[#EAE7E0] outline-none placeholder:text-[#EAE7E0]/35 focus:border-[#00E5FF]"
              />
            </div>
          </div>

          {/* Scoped Workspace Attendance Stats */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="border border-[#EAE7E0]/12 bg-[#050505] p-4">
              <p className="font-mono-num text-[10px] tracking-wider text-[#EAE7E0]/55 uppercase">
                {isAudienceWorkspace ? 'Valid Audience Passes' : 'Valid Participant Passes'}
              </p>
              <p className="mt-1.5 font-display text-2xl font-black text-[#EAE7E0]">
                {scopedWorkspace.stats.validTickets}
              </p>
              <p className="mt-1 font-mono-num text-[11px] text-[#EAE7E0]/50">
                Verified &amp; active for entry
              </p>
            </div>

            <div
              className={`border bg-[#050505] p-4 ${
                isAudienceWorkspace ? 'border-[#00E5FF]/35' : 'border-[#FF1744]/35'
              }`}
            >
              <p
                className={`font-mono-num text-[10px] tracking-wider uppercase ${
                  isAudienceWorkspace ? 'text-[#00E5FF]' : 'text-[#FF1744]'
                }`}
              >
                {isAudienceWorkspace ? 'Audience Checked In' : 'Participants Checked In'}
              </p>
              <p className="mt-1.5 font-display text-2xl font-black text-[#C8F36B]">
                {scopedWorkspace.stats.checkedInCount}
              </p>
              <p className="mt-1 font-mono-num text-[11px] text-[#EAE7E0]/55">
                {scopedWorkspace.stats.qrScanCount} QR · {scopedWorkspace.stats.manualScanCount} manual
              </p>
            </div>

            <div className="border border-[#EAE7E0]/12 bg-[#050505] p-4">
              <p className="font-mono-num text-[10px] tracking-wider text-[#EAE7E0]/55 uppercase">
                Remaining at Gate
              </p>
              <p className="mt-1.5 font-display text-2xl font-black text-[#EAE7E0]">
                {scopedWorkspace.stats.remainingCount}
              </p>
              <p className="mt-1 font-mono-num text-[11px] text-[#EAE7E0]/50">
                {scopedWorkspace.stats.reversalCount} reversal log
                {scopedWorkspace.stats.reversalCount === 1 ? '' : 's'}
              </p>
            </div>

            <div className="border border-[#EAE7E0]/12 bg-[#050505] p-4">
              <p className="font-mono-num text-[10px] tracking-wider text-[#EAE7E0]/55 uppercase">
                {isAudienceWorkspace ? 'Audience Attendance Rate' : 'Participant Attendance Rate'}
              </p>
              <p className="mt-1.5 font-display text-2xl font-black text-[#EAE7E0]">
                {scopedWorkspace.stats.checkInRatePercent}%
              </p>
              <div className="mt-2 h-1.5 w-full bg-[#EAE7E0]/10">
                <div
                  className={`h-full transition-all ${
                    isAudienceWorkspace ? 'bg-[#00E5FF]' : 'bg-[#FF1744]'
                  }`}
                  style={{
                    width: `${Math.min(100, scopedWorkspace.stats.checkInRatePercent)}%`,
                  }}
                />
              </div>
            </div>
          </div>

          {/* Scoped Check-In History Table */}
          <div className="border border-[#EAE7E0]/12 bg-[#050505]">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#EAE7E0]/10 px-4 py-3">
              <div className="flex items-center gap-2">
                <QrCode
                  className={`h-4 w-4 ${isAudienceWorkspace ? 'text-[#00E5FF]' : 'text-[#FF1744]'}`}
                  aria-hidden="true"
                />
                <h4 className="font-display text-sm font-bold tracking-tight text-[#EAE7E0] uppercase">
                  {isAudienceWorkspace
                    ? `Audience Check-In History (${searchedCheckins.length})`
                    : `Participant Check-In History (${searchedCheckins.length})`}
                </h4>
              </div>
              <p className="font-mono-num text-[10px] text-[#EAE7E0]/50">
                Reversals require a reason and write an immutable audit entry
              </p>
            </div>

            {isLoading && !report ? (
              <div className="p-8 text-center font-mono-num text-xs text-[#EAE7E0]/55">
                Loading {isAudienceWorkspace ? 'audience' : 'participant'} check-in history...
              </div>
            ) : searchedCheckins.length === 0 ? (
              <p className="px-5 py-10 text-center text-xs text-[#EAE7E0]/50">
                {currentSearchQuery.trim()
                  ? `No ${isAudienceWorkspace ? 'audience' : 'participant'} check-in records match "${currentSearchQuery.trim()}".`
                  : `No ${isAudienceWorkspace ? 'audience' : 'participant'} passes have been checked in yet.`}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[780px] border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#EAE7E0]/10 font-mono-num text-[10px] tracking-wider text-[#EAE7E0]/50 uppercase">
                      <th className="px-4 py-3">Ticket ID &amp; Reg Code</th>
                      <th className="px-4 py-3">
                        {isAudienceWorkspace ? 'Audience Guest' : 'Performer / Team'}
                      </th>
                      <th className="px-4 py-3">
                        {isAudienceWorkspace ? 'Pass Details' : 'Tier & Categories'}
                      </th>
                      <th className="px-4 py-3">Staff Operator</th>
                      <th className="px-4 py-3">Scan Timestamp</th>
                      <th className="px-4 py-3 text-right">Admin Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EAE7E0]/8">
                    {searchedCheckins.map((item) => (
                      <tr key={item.id} className="hover:bg-[#EAE7E0]/[0.02]">
                        <td className="px-4 py-3">
                          <p className="font-mono-num font-semibold text-[#C8F36B]">
                            {item.ticketId}
                          </p>
                          <p className="font-mono-num text-[11px] text-[#EAE7E0]/55">
                            {item.registrationCode}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-semibold text-[#EAE7E0]">
                            {item.participantOrTeamName}
                          </p>
                          {!isAudienceWorkspace && (
                            <p className="text-[11px] text-[#EAE7E0]/60">Lead: {item.fullName}</p>
                          )}
                        </td>
                        <td className="px-4 py-3 font-mono-num text-[#EAE7E0]/80">
                          <span
                            className={`mr-1.5 inline-block border px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                              isAudienceWorkspace
                                ? 'border-[#00E5FF]/50 bg-[#06161C] text-[#00E5FF]'
                                : 'border-[#FF1744]/45 bg-[#19060C] text-[#FF1744]'
                            }`}
                          >
                            {isAudienceWorkspace ? 'AUDIENCE' : 'PARTICIPANT'}
                          </span>
                          <span>
                            {isAudienceWorkspace
                              ? 'Watch Only (1)'
                              : `${item.passCategoryLabel} · ${item.participantCount}`}
                          </span>
                          {!isAudienceWorkspace && item.categoriesDisplay && (
                            <p className="mt-1 font-sans text-[11px] text-[#EAE7E0]/55">
                              {item.categoriesDisplay}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-[#EAE7E0]">{item.checkedInByName}</p>
                          <p className="font-mono-num text-[10px] text-[#00E5FF] uppercase">
                            {item.scanMethod} · {item.checkedInByEmail}
                          </p>
                        </td>
                        <td className="px-4 py-3 font-mono-num text-[11px] text-[#EAE7E0]/70">
                          {formatDateTime(item.checkedInAt)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              setReversingItem(item);
                              setReversalReason('');
                            }}
                            className="inline-flex min-h-[32px] cursor-pointer items-center gap-1.5 border border-[#FF6D00]/45 bg-[#FF6D00]/10 px-3 py-1 font-mono-num text-[10px] font-semibold text-[#FF6D00] uppercase transition-colors hover:bg-[#FF6D00] hover:text-[#050505]"
                          >
                            <RotateCcw className="h-3 w-3" aria-hidden="true" />
                            <span>Reverse</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Scoped Check-In & Reversal Audit Log */}
          <div className="border border-[#EAE7E0]/12 bg-[#050505]">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#EAE7E0]/10 px-4 py-3">
              <div className="flex items-center gap-2">
                <ClipboardList
                  className={`h-4 w-4 ${isAudienceWorkspace ? 'text-[#00E5FF]' : 'text-[#FF1744]'}`}
                  aria-hidden="true"
                />
                <h4 className="font-display text-sm font-bold tracking-tight text-[#EAE7E0] uppercase">
                  {isAudienceWorkspace
                    ? `Audience Check-In & Reversal Audit Log (${scopedWorkspace.auditLogs.length})`
                    : `Participant Check-In & Reversal Audit Log (${scopedWorkspace.auditLogs.length})`}
                </h4>
              </div>
            </div>

            {scopedWorkspace.auditLogs.length === 0 ? (
              <p className="px-5 py-8 text-center text-xs text-[#EAE7E0]/50">
                No {isAudienceWorkspace ? 'audience' : 'participant'} check-in audit events recorded yet.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[740px] border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#EAE7E0]/10 font-mono-num text-[10px] tracking-wider text-[#EAE7E0]/50 uppercase">
                      <th className="px-4 py-3">Action</th>
                      <th className="px-4 py-3">Ticket ID &amp; Code</th>
                      <th className="px-4 py-3">Performed By</th>
                      <th className="px-4 py-3">Reason / Note</th>
                      <th className="px-4 py-3">Logged At</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EAE7E0]/8">
                    {scopedWorkspace.auditLogs.map((log) => (
                      <tr key={log.id}>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-block border px-2 py-0.5 font-mono-num text-[10px] font-semibold uppercase ${
                              log.action === 'REVERSED'
                                ? 'border-[#FF6D00]/45 bg-[#FF6D00]/10 text-[#FF6D00]'
                                : 'border-[#C8F36B]/40 bg-[#C8F36B]/10 text-[#C8F36B]'
                            }`}
                          >
                            {log.action}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-mono-num text-[#EAE7E0]">{log.ticketId}</p>
                          <p className="font-mono-num text-[11px] text-[#EAE7E0]/55">
                            {log.registrationCode || '—'}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-mono-num text-[#EAE7E0]/80">
                            {log.performedByEmail}
                          </span>
                          <span className="ml-2 font-mono-num text-[10px] text-[#EAE7E0]/45 uppercase">
                            ({log.performedByRole})
                          </span>
                        </td>
                        <td className="px-4 py-3 text-[#EAE7E0]/75">{log.reason || '—'}</td>
                        <td className="px-4 py-3 font-mono-num text-[11px] text-[#EAE7E0]/60">
                          {formatDateTime(log.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Staff Authorization & Revocation Panel */}
      <section aria-labelledby="staff-access-heading" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2
              id="staff-access-heading"
              className="font-display text-lg font-black tracking-tight text-[#EAE7E0] uppercase"
            >
              Gate Staff Accounts &amp; Access Control
            </h2>
            <p className="text-xs text-[#EAE7E0]/55">
              {activeStaffCount} active of {staffUsers.length} authorized gate operator
              {staffUsers.length === 1 ? '' : 's'}
            </p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-12">
          <form
            onSubmit={(e) => void handleAuthorizeStaff(e)}
            className="border border-[#EAE7E0]/12 bg-[#0B0B0D] p-5 lg:col-span-5"
          >
            <div className="flex items-center gap-2 border-b border-[#EAE7E0]/10 pb-3">
              <UserPlus className="h-4 w-4 text-[#00E5FF]" aria-hidden="true" />
              <h3 className="font-display text-base font-bold tracking-tight text-[#EAE7E0] uppercase">
                Authorize Event Staff
              </h3>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-[#EAE7E0]/60">
              Only authorized staff accounts can access{' '}
              <span className="font-mono-num text-[#EAE7E0]">/staff-checkin</span>. Provide an
              initial password if creating a new staff login.
            </p>

            <div className="mt-4 space-y-3.5">
              <div>
                <label
                  htmlFor="admin-staff-name"
                  className="block font-mono-num text-[10px] tracking-wider text-[#EAE7E0]/65 uppercase"
                >
                  Staff Full Name
                </label>
                <input
                  id="admin-staff-name"
                  type="text"
                  required
                  value={staffName}
                  onChange={(e) => setStaffName(e.target.value)}
                  placeholder="e.g. Rohan Sharma"
                  className="mt-1 min-h-[40px] w-full border border-[#EAE7E0]/20 bg-[#050505] px-3 py-2 text-xs text-[#EAE7E0] outline-none placeholder:text-[#EAE7E0]/30 focus:border-[#00E5FF]"
                />
              </div>

              <div>
                <label
                  htmlFor="admin-staff-email"
                  className="block font-mono-num text-[10px] tracking-wider text-[#EAE7E0]/65 uppercase"
                >
                  Staff Email
                </label>
                <input
                  id="admin-staff-email"
                  type="email"
                  required
                  value={staffEmail}
                  onChange={(e) => setStaffEmail(e.target.value)}
                  placeholder="gate.staff@quadai.edu"
                  className="mt-1 min-h-[40px] w-full border border-[#EAE7E0]/20 bg-[#050505] px-3 py-2 text-xs text-[#EAE7E0] outline-none placeholder:text-[#EAE7E0]/30 focus:border-[#00E5FF]"
                />
              </div>

              <div>
                <label
                  htmlFor="admin-staff-password"
                  className="block font-mono-num text-[10px] tracking-wider text-[#EAE7E0]/65 uppercase"
                >
                  Initial Password (if new account)
                </label>
                <input
                  id="admin-staff-password"
                  type="password"
                  value={staffPassword}
                  onChange={(e) => setStaffPassword(e.target.value)}
                  placeholder="Min 8 chars (leave blank if user exists)"
                  className="mt-1 min-h-[40px] w-full border border-[#EAE7E0]/20 bg-[#050505] px-3 py-2 text-xs text-[#EAE7E0] outline-none placeholder:text-[#EAE7E0]/30 focus:border-[#00E5FF]"
                />
              </div>

              <button
                type="submit"
                disabled={isAuthorizing}
                className="flex min-h-[42px] w-full cursor-pointer items-center justify-center gap-2 border border-[#00E5FF] bg-[#00E5FF]/15 px-4 py-2 font-mono-num text-xs font-bold tracking-wider text-[#00E5FF] uppercase transition-colors hover:bg-[#00E5FF] hover:text-[#050505] disabled:opacity-50"
              >
                <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                <span>{isAuthorizing ? 'Authorizing...' : 'Grant Check-In Access'}</span>
              </button>
            </div>
          </form>

          <div className="border border-[#EAE7E0]/12 bg-[#0B0B0D] lg:col-span-7">
            <div className="flex items-center justify-between border-b border-[#EAE7E0]/10 px-5 py-3.5">
              <div className="flex items-center gap-2">
                <UserCheck className="h-4 w-4 text-[#C8F36B]" aria-hidden="true" />
                <h3 className="font-display text-base font-bold tracking-tight text-[#EAE7E0] uppercase">
                  Authorized Gate Staff ({staffUsers.length})
                </h3>
              </div>
            </div>

            {staffUsers.length === 0 ? (
              <p className="px-5 py-10 text-center text-xs text-[#EAE7E0]/50">
                No gate staff authorized yet. Use the form on the left to add staff accounts.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[540px] border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#EAE7E0]/10 font-mono-num text-[10px] tracking-wider text-[#EAE7E0]/50 uppercase">
                      <th className="px-4 py-3">Staff Member</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Authorized</th>
                      <th className="px-4 py-3 text-right">Access Control</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EAE7E0]/8">
                    {staffUsers.map((staff) => (
                      <tr key={staff.userId}>
                        <td className="px-4 py-3">
                          <p className="font-semibold text-[#EAE7E0]">{staff.fullName}</p>
                          <p className="font-mono-num text-[11px] text-[#EAE7E0]/60">
                            {staff.email}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-block border px-2 py-0.5 font-mono-num text-[10px] font-semibold uppercase ${
                              staff.isActive
                                ? 'border-[#C8F36B]/45 bg-[#C8F36B]/10 text-[#C8F36B]'
                                : 'border-[#FF1744]/45 bg-[#FF1744]/10 text-[#FF1744]'
                            }`}
                          >
                            {staff.isActive ? 'Active' : 'Revoked'}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono-num text-[11px] text-[#EAE7E0]/60">
                          {formatDateTime(staff.authorizedAt)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            disabled={togglingUserId === staff.userId}
                            onClick={() => void handleToggleStaffAccess(staff)}
                            className={`inline-flex min-h-[32px] cursor-pointer items-center gap-1.5 border px-3 py-1 font-mono-num text-[10px] font-semibold uppercase transition-colors disabled:opacity-50 ${
                              staff.isActive
                                ? 'border-[#FF1744]/45 bg-[#FF1744]/10 text-[#FF1744] hover:bg-[#FF1744] hover:text-[#EAE7E0]'
                                : 'border-[#C8F36B]/45 bg-[#C8F36B]/10 text-[#C8F36B] hover:bg-[#C8F36B] hover:text-[#050505]'
                            }`}
                          >
                            {staff.isActive ? (
                              <>
                                <UserX className="h-3 w-3" aria-hidden="true" />
                                <span>Revoke Access</span>
                              </>
                            ) : (
                              <>
                                <UserCheck className="h-3 w-3" aria-hidden="true" />
                                <span>Restore</span>
                              </>
                            )}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Reversal Confirmation Modal */}
      {reversingItem && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="reverse-checkin-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#050505]/85 p-4 backdrop-blur-sm"
        >
          <form
            onSubmit={(e) => void handleConfirmReversal(e)}
            className="w-full max-w-md border border-[#FF6D00]/50 bg-[#0B0B0D] p-6"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2 text-[#FF6D00]">
                <ShieldAlert className="h-5 w-5" aria-hidden="true" />
                <span className="font-mono-num text-xs font-bold tracking-wider uppercase">
                  Confirm Check-In Reversal
                </span>
              </div>
              <button
                type="button"
                onClick={() => setReversingItem(null)}
                aria-label="Close modal"
                className="cursor-pointer text-[#EAE7E0]/60 hover:text-[#EAE7E0]"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <h3
              id="reverse-checkin-title"
              className="mt-3 font-display text-xl font-bold text-[#EAE7E0] uppercase"
            >
              Reverse {reversingItem.ticketId}?
            </h3>
            <p className="mt-2 text-xs leading-relaxed text-[#EAE7E0]/70">
              This removes the active{' '}
              <span className="font-mono-num text-[#EAE7E0]">
                {reversingItem.registrationType}
              </span>{' '}
              check-in for <strong>{reversingItem.participantOrTeamName}</strong> (
              {reversingItem.registrationCode}) so it can be scanned again at the gate. This reversal
              is permanently recorded in the audit log.
            </p>

            <div className="mt-4">
              <label
                htmlFor="reversal-reason-input"
                className="block font-mono-num text-[10px] tracking-wider text-[#EAE7E0]/65 uppercase"
              >
                Reason for Reversal (Required)
              </label>
              <textarea
                id="reversal-reason-input"
                required
                minLength={3}
                rows={3}
                value={reversalReason}
                onChange={(e) => setReversalReason(e.target.value)}
                placeholder="e.g. Accidental double-scan / wrong attendee checked in"
                className="mt-1.5 w-full border border-[#EAE7E0]/20 bg-[#050505] p-3 text-xs text-[#EAE7E0] outline-none placeholder:text-[#EAE7E0]/30 focus:border-[#FF6D00]"
              />
            </div>

            <div className="mt-5 flex flex-wrap justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setReversingItem(null)}
                className="min-h-[38px] cursor-pointer border border-[#EAE7E0]/20 px-4 py-1.5 font-mono-num text-xs text-[#EAE7E0]/75 uppercase hover:text-[#EAE7E0]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isReversing}
                className="min-h-[38px] cursor-pointer border border-[#FF6D00] bg-[#FF6D00] px-4 py-1.5 font-mono-num text-xs font-bold text-[#050505] uppercase transition-colors hover:bg-[#EAE7E0] disabled:opacity-50"
              >
                {isReversing ? 'Reversing...' : 'Confirm & Log Reversal'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
