import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  UserPlus,
  UserX,
  X,
} from 'lucide-react';
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

  const [searchQuery, setSearchQuery] = useState('');
  const [registrationTypeFilter, setRegistrationTypeFilter] = useState<'all' | RegistrationType>(
    'all'
  );

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
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const [reportData, staffData] = await Promise.all([
        fetchAdminCheckinReport(registrationTypeFilter),
        fetchAdminStaffList(),
      ]);
      setReport(reportData);
      setStaffUsers(staffData);
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Unable to load check-in analytics and staff list.'
      );
    } finally {
      setIsLoading(false);
    }
  }, [registrationTypeFilter]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const filteredCheckins = useMemo(() => {
    const items = report?.checkedInTickets ?? [];
    const q = searchQuery.trim().toLowerCase();
    return items.filter((item) => {
      if (registrationTypeFilter !== 'all' && item.registrationType !== registrationTypeFilter) {
        return false;
      }
      if (!q) return true;
      return (
        item.ticketId.toLowerCase().includes(q) ||
        item.registrationCode.toLowerCase().includes(q) ||
        item.participantOrTeamName.toLowerCase().includes(q) ||
        item.fullName.toLowerCase().includes(q) ||
        item.checkedInByEmail.toLowerCase().includes(q)
      );
    });
  }, [report?.checkedInTickets, searchQuery, registrationTypeFilter]);

  const filteredAuditLogs = useMemo(() => {
    const items = report?.auditLogs ?? [];
    if (registrationTypeFilter === 'all') return items;
    return items.filter((log) => log.registrationType === registrationTypeFilter);
  }, [report?.auditLogs, registrationTypeFilter]);

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

  const stats = report?.stats ?? {
    totalValidTickets: 0,
    checkedInCount: 0,
    remainingCount: 0,
    checkInRatePercent: 0,
    participantValidTickets: 0,
    participantCheckedInCount: 0,
    audienceValidTickets: 0,
    audienceCheckedInCount: 0,
  };

  return (
    <div className="space-y-8">
      {/* Header / Refresh */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-mono-num text-[11px] tracking-wider text-[#00E5FF] uppercase">
            Live Gate Attendance & Staff Access Control
          </p>
          <p className="mt-1 text-xs text-[#EAE7E0]/65">
            Authorize gate staff for <span className="font-mono-num text-[#EAE7E0]">/staff-checkin</span>, track live ticket check-ins, and reverse accidental scans with full audit logging.
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

      {/* Attendance KPI Cards */}
      <section aria-label="Check-In Attendance Summary" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="border border-[#EAE7E0]/12 bg-[#0B0B0D] p-5">
          <p className="font-mono-num text-[11px] tracking-wider text-[#EAE7E0]/55 uppercase">
            Total Valid Tickets
          </p>
          <p className="mt-2 font-display text-3xl font-black text-[#EAE7E0]">
            {stats.totalValidTickets}
          </p>
          <p className="mt-1 font-mono-num text-[11px] text-[#EAE7E0]/55">
            {stats.remainingCount} remaining to check in
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
            {stats.checkInRatePercent}% overall attendance
          </p>
        </div>

        <div className="border border-[#FF1744]/35 bg-[#0B0B0D] p-5">
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
            Performers checked in
          </p>
        </div>

        <div className="border border-[#00E5FF]/35 bg-[#0B0B0D] p-5">
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
            Watch-only attendees in
          </p>
        </div>

        <div className="border border-[#EAE7E0]/12 bg-[#0B0B0D] p-5">
          <p className="font-mono-num text-[11px] tracking-wider text-[#EAE7E0]/55 uppercase">
            Gate Progress
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
      </section>

      {/* Staff Authorization & Revocation Panel */}
      <section className="grid gap-6 lg:grid-cols-12">
        <form
          onSubmit={(e) => void handleAuthorizeStaff(e)}
          className="border border-[#EAE7E0]/12 bg-[#0B0B0D] p-5 lg:col-span-5"
        >
          <div className="flex items-center gap-2 border-b border-[#EAE7E0]/10 pb-3">
            <UserPlus className="h-4 w-4 text-[#00E5FF]" aria-hidden="true" />
            <h2 className="font-display text-base font-bold tracking-tight text-[#EAE7E0] uppercase">
              Authorize Event Staff
            </h2>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-[#EAE7E0]/60">
            Only authorized staff accounts can access <span className="font-mono-num text-[#EAE7E0]">/staff-checkin</span>. Provide an initial password if creating a new staff login.
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
              <h2 className="font-display text-base font-bold tracking-tight text-[#EAE7E0] uppercase">
                Authorized Gate Staff ({staffUsers.length})
              </h2>
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
                        <p className="font-mono-num text-[11px] text-[#EAE7E0]/60">{staff.email}</p>
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
      </section>

      {/* Active Checked-In Tickets Table + Reversal */}
      <section className="border border-[#EAE7E0]/12 bg-[#0B0B0D]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#EAE7E0]/10 px-5 py-4">
          <div>
            <h2 className="font-display text-base font-bold tracking-tight text-[#EAE7E0] uppercase">
              Checked-In Tickets ({filteredCheckins.length})
            </h2>
            <p className="text-xs text-[#EAE7E0]/55">
              Reverse an accidental check-in only if needed; every reversal writes an immutable audit entry.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-1" role="tablist" aria-label="Check-in registration type filter">
              {(
                [
                  { id: 'all', label: 'All' },
                  { id: 'PARTICIPANT', label: 'Participants' },
                  { id: 'AUDIENCE', label: 'Audience' },
                ] as const
              ).map((tab) => {
                const active = registrationTypeFilter === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setRegistrationTypeFilter(tab.id)}
                    className={`min-h-[34px] cursor-pointer border px-3 py-1 font-mono-num text-[11px] font-semibold uppercase transition-colors ${
                      active
                        ? tab.id === 'AUDIENCE'
                          ? 'border-[#00E5FF] bg-[#00E5FF] text-[#050505]'
                          : 'border-[#FF1744] bg-[#FF1744] text-[#EAE7E0]'
                        : 'border-[#EAE7E0]/15 bg-[#050505] text-[#EAE7E0]/75 hover:border-[#EAE7E0]/40'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            <div className="relative w-full sm:w-64">
              <Search
                className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-[#EAE7E0]/45"
                aria-hidden="true"
              />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search ticket ID, reg code, guest..."
                aria-label="Search checked-in tickets"
                className="min-h-[38px] w-full border border-[#EAE7E0]/20 bg-[#050505] pr-3 pl-8 text-xs text-[#EAE7E0] outline-none placeholder:text-[#EAE7E0]/35 focus:border-[#00E5FF]"
              />
            </div>
          </div>
        </div>

        {filteredCheckins.length === 0 ? (
          <p className="px-5 py-10 text-center text-xs text-[#EAE7E0]/50">
            No matching checked-in tickets found.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[780px] border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-[#EAE7E0]/10 font-mono-num text-[10px] tracking-wider text-[#EAE7E0]/50 uppercase">
                  <th className="px-4 py-3">Ticket ID</th>
                  <th className="px-4 py-3">Guest / Team</th>
                  <th className="px-4 py-3">Pass Type</th>
                  <th className="px-4 py-3">Scanned By</th>
                  <th className="px-4 py-3">Checked-In At</th>
                  <th className="px-4 py-3 text-right">Admin Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EAE7E0]/8">
                {filteredCheckins.map((item) => (
                  <tr key={item.id} className="hover:bg-[#EAE7E0]/[0.02]">
                    <td className="px-4 py-3">
                      <p className="font-mono-num font-semibold text-[#C8F36B]">{item.ticketId}</p>
                      <p className="font-mono-num text-[11px] text-[#EAE7E0]/55">
                        {item.registrationCode}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-[#EAE7E0]">{item.participantOrTeamName}</p>
                      {item.registrationType !== 'AUDIENCE' && (
                        <p className="text-[11px] text-[#EAE7E0]/60">Lead: {item.fullName}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono-num text-[#EAE7E0]/80">
                      <span
                        className={`mr-1.5 inline-block border px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                          item.registrationType === 'AUDIENCE'
                            ? 'border-[#00E5FF]/50 bg-[#06161C] text-[#00E5FF]'
                            : 'border-[#FF1744]/45 bg-[#19060C] text-[#FF1744]'
                        }`}
                      >
                        {item.registrationType === 'AUDIENCE' ? 'AUDIENCE' : 'PARTICIPANT'}
                      </span>
                      <span>
                        {item.registrationType === 'AUDIENCE'
                          ? 'Watch Only (1)'
                          : `${item.passCategoryLabel} · ${item.participantCount}`}
                      </span>
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
      </section>

      {/* Immutable Audit Log */}
      <section className="border border-[#EAE7E0]/12 bg-[#0B0B0D]">
        <div className="flex items-center gap-2 border-b border-[#EAE7E0]/10 px-5 py-3.5">
          <ClipboardList className="h-4 w-4 text-[#00E5FF]" aria-hidden="true" />
          <h2 className="font-display text-base font-bold tracking-tight text-[#EAE7E0] uppercase">
            Check-In & Reversal Audit Log
          </h2>
        </div>

        {filteredAuditLogs.length === 0 ? (
          <p className="px-5 py-8 text-center text-xs text-[#EAE7E0]/50">
            No matching check-in audit events recorded yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[740px] border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-[#EAE7E0]/10 font-mono-num text-[10px] tracking-wider text-[#EAE7E0]/50 uppercase">
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Pass Type</th>
                  <th className="px-4 py-3">Ticket ID</th>
                  <th className="px-4 py-3">Performed By</th>
                  <th className="px-4 py-3">Reason / Note</th>
                  <th className="px-4 py-3">Logged At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EAE7E0]/8">
                {filteredAuditLogs.map((log) => (
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
                      <span
                        className={`inline-block border px-1.5 py-0.5 font-mono-num text-[10px] font-bold uppercase ${
                          log.registrationType === 'AUDIENCE'
                            ? 'border-[#00E5FF]/50 bg-[#06161C] text-[#00E5FF]'
                            : 'border-[#FF1744]/45 bg-[#19060C] text-[#FF1744]'
                        }`}
                      >
                        {log.registrationType}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono-num text-[#EAE7E0]">{log.ticketId}</td>
                    <td className="px-4 py-3">
                      <span className="font-mono-num text-[#EAE7E0]/80">{log.performedByEmail}</span>
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

            <h3 id="reverse-checkin-title" className="mt-3 font-display text-xl font-bold text-[#EAE7E0] uppercase">
              Reverse {reversingItem.ticketId}?
            </h3>
            <p className="mt-2 text-xs leading-relaxed text-[#EAE7E0]/70">
              This removes the active check-in for <strong>{reversingItem.participantOrTeamName}</strong> ({reversingItem.registrationCode}) so it can be scanned again at the gate. This reversal is permanently recorded in the audit log.
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
