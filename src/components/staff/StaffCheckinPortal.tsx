import { FormEvent, useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  KeyRound,
  LogOut,
  QrCode,
  RefreshCw,
  RotateCcw,
  ScanLine,
  ShieldAlert,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { getStaffSupabaseClient } from '../../lib/staffSupabaseClient';
import { getSupabaseConfigStatus } from '../../lib/supabaseClient';
import {
  fetchStaffGateSession,
  signInStaffWithPassword,
  signOutStaffSession,
  StaffApiError,
  submitStaffCheckIn,
} from '../../services/staffApi';
import type { StaffCheckInResponse, StaffGateSessionPayload } from '../../types/staff';
import { QrCameraScanner } from './QrCameraScanner';

type StaffGateAuthState =
  | { status: 'checking' }
  | { status: 'not_configured'; message: string }
  | { status: 'unauthenticated'; errorMessage: string | null }
  | { status: 'access_denied'; reason: string }
  | { status: 'authorized'; payload: StaffGateSessionPayload };

function formatTimestamp(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export default function StaffCheckinPortal() {
  const [authState, setAuthState] = useState<StaffGateAuthState>({ status: 'checking' });
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [isSigningIn, setIsSigningIn] = useState(false);

  const [manualInput, setManualInput] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [scanPaused, setScanPaused] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<StaffCheckInResponse | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const navigateToHome = () => {
    window.history.pushState({}, '', '/');
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  const loadAuthorizedSession = useCallback(async (options?: { silent?: boolean }) => {
    const config = getSupabaseConfigStatus();
    if (!config.isConfigured) {
      setAuthState({
        status: 'not_configured',
        message: config.configError || 'Supabase configuration is missing.',
      });
      return;
    }

    if (!options?.silent) {
      setAuthState({ status: 'checking' });
    } else {
      setIsRefreshing(true);
    }

    try {
      const staffClient = getStaffSupabaseClient();
      const { data } = await staffClient.auth.getSession();
      if (!data.session?.access_token) {
        setAuthState({ status: 'unauthenticated', errorMessage: null });
        return;
      }

      const payload = await fetchStaffGateSession();
      setAuthState({ status: 'authorized', payload });
    } catch (err) {
      if (
        err instanceof StaffApiError &&
        (err.code === 'ACCESS_DENIED' || err.code === 'ACCESS_REVOKED')
      ) {
        await signOutStaffSession().catch(() => undefined);
        setAuthState({ status: 'access_denied', reason: err.message });
      } else {
        setAuthState({
          status: 'unauthenticated',
          errorMessage:
            err instanceof StaffApiError && err.code === 'UNAUTHENTICATED'
              ? null
              : err instanceof Error
                ? err.message
                : 'Please sign in with your authorized staff credentials.',
        });
      }
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadAuthorizedSession();
  }, [loadAuthorizedSession]);

  const handleStaffLogin = async (e: FormEvent) => {
    e.preventDefault();
    setIsSigningIn(true);
    try {
      const payload = await signInStaffWithPassword(emailInput, passwordInput);
      setPasswordInput('');
      setAuthState({ status: 'authorized', payload });
    } catch (err) {
      if (
        err instanceof StaffApiError &&
        (err.code === 'ACCESS_DENIED' || err.code === 'ACCESS_REVOKED')
      ) {
        setAuthState({ status: 'access_denied', reason: err.message });
      } else {
        setAuthState({
          status: 'unauthenticated',
          errorMessage: err instanceof Error ? err.message : 'Unable to sign in.',
        });
      }
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    await signOutStaffSession().catch(() => undefined);
    setLastResult(null);
    setScanError(null);
    setManualInput('');
    setAuthState({ status: 'unauthenticated', errorMessage: null });
  };

  const processCheckIn = useCallback(
    async (params: { qrPayload?: string; manualCode?: string; scanMethod: 'qr' | 'manual' }) => {
      if (isScanning) return;
      setIsScanning(true);
      setScanError(null);
      setScanPaused(true);

      try {
        const result = await submitStaffCheckIn(params);
        setLastResult(result);
        if (params.scanMethod === 'manual') {
          setManualInput('');
        }
        // Refresh gate counters immediately after every scan
        const refreshed = await fetchStaffGateSession();
        setAuthState({ status: 'authorized', payload: refreshed });
      } catch (err) {
        if (
          err instanceof StaffApiError &&
          (err.code === 'UNAUTHENTICATED' ||
            err.code === 'ACCESS_DENIED' ||
            err.code === 'ACCESS_REVOKED')
        ) {
          await signOutStaffSession().catch(() => undefined);
          setAuthState({
            status: 'access_denied',
            reason: err.message,
          });
          return;
        }
        setScanError(err instanceof Error ? err.message : 'Unable to verify ticket at this moment.');
        setScanPaused(false);
      } finally {
        setIsScanning(false);
      }
    },
    [isScanning]
  );

  const handleQrDetected = useCallback(
    (qrText: string) => {
      void processCheckIn({ qrPayload: qrText, scanMethod: 'qr' });
    },
    [processCheckIn]
  );

  const handleManualSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = manualInput.trim();
    if (!trimmed) {
      setScanError('Enter a Ticket ID (ALF-TKT-...), Registration Code (ALF-...), or verification URL.');
      return;
    }
    void processCheckIn({ manualCode: trimmed, scanMethod: 'manual' });
  };

  if (authState.status === 'checking') {
    return (
      <div className="underground-surface flex min-h-screen items-center justify-center bg-[#050505] px-6 text-[#EAE7E0]">
        <div className="flex flex-col items-center gap-3 text-center">
          <RefreshCw className="h-6 w-6 animate-spin text-[#00E5FF]" aria-hidden="true" />
          <p className="font-mono-num text-xs tracking-widest text-[#EAE7E0]/75 uppercase">
            Verifying Staff Authorization...
          </p>
        </div>
      </div>
    );
  }

  if (authState.status === 'not_configured') {
    return (
      <div className="underground-surface flex min-h-screen items-center justify-center bg-[#050505] px-6 text-[#EAE7E0]">
        <div className="w-full max-w-md border border-[#FF1744]/40 bg-[#0B0B0D] p-6">
          <p className="font-mono-num text-xs font-semibold tracking-wider text-[#FF1744] uppercase">
            Configuration Required
          </p>
          <p className="mt-2 text-sm text-[#EAE7E0]/80">{authState.message}</p>
        </div>
      </div>
    );
  }

  if (authState.status === 'access_denied') {
    return (
      <div className="underground-surface flex min-h-screen items-center justify-center bg-[#050505] px-4 py-12 text-[#EAE7E0]">
        <div className="w-full max-w-md border border-[#FF1744]/45 bg-[#0B0B0D] p-7">
          <div className="flex items-center gap-2.5 text-[#FF1744]">
            <ShieldAlert className="h-5 w-5" aria-hidden="true" />
            <span className="font-mono-num text-xs font-semibold tracking-widest uppercase">
              Access Denied
            </span>
          </div>
          <h1 className="mt-3 font-display text-2xl font-black tracking-tight uppercase">
            Unauthorized Staff Account
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-[#EAE7E0]/75">{authState.reason}</p>
          <p className="mt-3 border-l-2 border-[#EAE7E0]/20 pl-3 text-xs text-[#EAE7E0]/55">
            Self-registration is disabled. Contact an ALFAAZ organizer admin to authorize or restore your account from the Admin Dashboard.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setAuthState({ status: 'unauthenticated', errorMessage: null })}
              className="min-h-[40px] flex-1 cursor-pointer border border-[#EAE7E0]/25 bg-[#050505] px-4 py-2 font-mono-num text-xs font-semibold tracking-wider text-[#EAE7E0] uppercase hover:border-[#00E5FF] hover:text-[#00E5FF]"
            >
              Try Another Account
            </button>
            <button
              type="button"
              onClick={navigateToHome}
              className="min-h-[40px] cursor-pointer border border-[#EAE7E0]/15 px-4 py-2 font-mono-num text-xs text-[#EAE7E0]/70 uppercase hover:text-[#EAE7E0]"
            >
              Public Site
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (authState.status === 'unauthenticated') {
    return (
      <div className="underground-surface flex min-h-screen items-center justify-center bg-[#050505] px-4 py-12 text-[#EAE7E0]">
        <div className="w-full max-w-md border border-[#EAE7E0]/15 bg-[#0B0B0D] p-7 sm:p-8">
          <div className="flex items-center justify-between border-b border-[#EAE7E0]/12 pb-4">
            <div>
              <p className="font-mono-num text-[11px] font-semibold tracking-widest text-[#00E5FF] uppercase">
                Private Gate Console
              </p>
              <h1 className="mt-1 font-display text-2xl font-black tracking-tight text-[#EAE7E0] uppercase">
                ALFAAZ Staff Check-In
              </h1>
            </div>
            <QrCode className="h-7 w-7 text-[#FF1744]" aria-hidden="true" />
          </div>

          <p className="mt-4 text-xs leading-relaxed text-[#EAE7E0]/65">
            Sign in with an admin-authorized event staff account to scan QR entry passes and check in verified participants.
          </p>

          {authState.errorMessage && (
            <div
              role="alert"
              className="mt-4 flex items-start gap-2.5 border border-[#FF1744]/45 bg-[#FF1744]/10 p-3 text-xs text-[#EAE7E0]"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#FF1744]" aria-hidden="true" />
              <span>{authState.errorMessage}</span>
            </div>
          )}

          <form onSubmit={(e) => void handleStaffLogin(e)} className="mt-5 space-y-4">
            <div>
              <label
                htmlFor="staff-email"
                className="block font-mono-num text-[11px] tracking-wider text-[#EAE7E0]/70 uppercase"
              >
                Staff Email
              </label>
              <input
                id="staff-email"
                type="email"
                required
                autoComplete="email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="staff@quadai.edu"
                className="mt-1.5 min-h-[44px] w-full border border-[#EAE7E0]/20 bg-[#050505] px-3.5 py-2.5 text-sm text-[#EAE7E0] outline-none placeholder:text-[#EAE7E0]/30 focus:border-[#00E5FF]"
              />
            </div>

            <div>
              <label
                htmlFor="staff-password"
                className="block font-mono-num text-[11px] tracking-wider text-[#EAE7E0]/70 uppercase"
              >
                Password
              </label>
              <input
                id="staff-password"
                type="password"
                required
                autoComplete="current-password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="••••••••"
                className="mt-1.5 min-h-[44px] w-full border border-[#EAE7E0]/20 bg-[#050505] px-3.5 py-2.5 text-sm text-[#EAE7E0] outline-none placeholder:text-[#EAE7E0]/30 focus:border-[#00E5FF]"
              />
            </div>

            <button
              type="submit"
              disabled={isSigningIn}
              className="flex min-h-[46px] w-full cursor-pointer items-center justify-center gap-2 border border-[#FF1744] bg-[#FF1744] px-4 py-2.5 font-mono-num text-xs font-bold tracking-widest text-[#EAE7E0] uppercase transition-colors hover:bg-[#EAE7E0] hover:text-[#050505] disabled:opacity-50"
            >
              {isSigningIn ? (
                <RefreshCw className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              )}
              <span>{isSigningIn ? 'Authenticating...' : 'Sign In to Gate Scanner'}</span>
            </button>
          </form>

          <div className="mt-6 flex items-center justify-between border-t border-[#EAE7E0]/12 pt-4 text-[11px] text-[#EAE7E0]/50">
            <span>No public signup · Invite only</span>
            <button
              type="button"
              onClick={navigateToHome}
              className="inline-flex cursor-pointer items-center gap-1 text-[#00E5FF] hover:underline"
            >
              <span>Public Site</span>
              <ExternalLink className="h-3 w-3" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  const { staff, stats, recentCheckins } = authState.payload;

  return (
    <div className="min-h-screen bg-[#050505] text-[#EAE7E0]">
      {/* Sticky Top Gate Header */}
      <header className="sticky top-0 z-20 border-b border-[#EAE7E0]/12 bg-[#0B0B0D]/95 px-4 py-3.5 backdrop-blur-md sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-mono-num text-[11px] tracking-wider text-[#00E5FF] uppercase">
              ALFAAZ — UNFILTERED · Gate Check-In Console
            </p>
            <div className="mt-0.5 flex flex-wrap items-center gap-2">
              <h1 className="font-display text-xl font-black tracking-tight text-[#EAE7E0] uppercase sm:text-2xl">
                Entry Scanner
              </h1>
              <span className="border border-[#C8F36B]/40 bg-[#C8F36B]/10 px-2 py-0.5 font-mono-num text-[10px] font-semibold tracking-wider text-[#C8F36B] uppercase">
                Staff: {staff.fullName}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isRefreshing}
              onClick={() => void loadAuthorizedSession({ silent: true })}
              className="inline-flex min-h-[38px] cursor-pointer items-center gap-1.5 border border-[#EAE7E0]/20 bg-[#050505] px-3 py-1.5 font-mono-num text-xs text-[#EAE7E0] transition-colors hover:border-[#00E5FF] hover:text-[#00E5FF] disabled:opacity-50"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
              <span className="hidden sm:inline">Refresh Stats</span>
            </button>

            <button
              type="button"
              onClick={() => void handleSignOut()}
              className="inline-flex min-h-[38px] cursor-pointer items-center gap-1.5 border border-[#FF1744]/45 bg-[#FF1744]/10 px-3 py-1.5 font-mono-num text-xs font-semibold text-[#FF1744] uppercase transition-colors hover:bg-[#FF1744] hover:text-[#EAE7E0]"
            >
              <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        {/* Live Gate Counters */}
        <section aria-label="Live Gate Attendance Counters" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="border border-[#EAE7E0]/12 bg-[#0B0B0D] p-4">
            <p className="font-mono-num text-[10px] tracking-wider text-[#EAE7E0]/55 uppercase">
              Valid Passes
            </p>
            <p className="mt-1 font-display text-2xl font-black text-[#EAE7E0] sm:text-3xl">
              {stats.totalValidTickets}
            </p>
          </div>
          <div className="border border-[#C8F36B]/30 bg-[#0B0B0D] p-4">
            <p className="font-mono-num text-[10px] tracking-wider text-[#C8F36B] uppercase">
              Checked In
            </p>
            <p className="mt-1 font-display text-2xl font-black text-[#C8F36B] sm:text-3xl">
              {stats.checkedInCount}
            </p>
          </div>
          <div className="border border-[#00E5FF]/25 bg-[#0B0B0D] p-4">
            <p className="font-mono-num text-[10px] tracking-wider text-[#00E5FF] uppercase">
              Remaining
            </p>
            <p className="mt-1 font-display text-2xl font-black text-[#00E5FF] sm:text-3xl">
              {stats.remainingCount}
            </p>
          </div>
          <div className="border border-[#EAE7E0]/12 bg-[#0B0B0D] p-4">
            <p className="font-mono-num text-[10px] tracking-wider text-[#EAE7E0]/55 uppercase">
              Gate Turnout
            </p>
            <p className="mt-1 font-display text-2xl font-black text-[#EAE7E0] sm:text-3xl">
              {stats.checkInRatePercent}%
            </p>
          </div>
        </section>

        {/* Scanner & Verdict Grid */}
        <div className="grid gap-6 lg:grid-cols-12">
          {/* Left: Camera Scanner + Manual Fallback */}
          <div className="space-y-5 lg:col-span-7">
            <QrCameraScanner
              onDetect={handleQrDetected}
              paused={scanPaused}
              isProcessing={isScanning}
            />

            {/* Manual Fallback Card */}
            <form
              onSubmit={handleManualSubmit}
              className="border border-[#EAE7E0]/15 bg-[#0B0B0D] p-4 sm:p-5"
            >
              <div className="flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-[#C8F36B]" aria-hidden="true" />
                <h2 className="font-mono-num text-xs font-semibold tracking-wider text-[#EAE7E0] uppercase">
                  Manual Ticket Fallback
                </h2>
              </div>
              <p className="mt-1 text-xs text-[#EAE7E0]/60">
                If camera scanning fails, enter the Ticket ID (<span className="font-mono-num text-[#EAE7E0]/85">ALF-TKT-...</span>) or Registration Code (<span className="font-mono-num text-[#EAE7E0]/85">ALF-...</span>).
              </p>

              <div className="mt-3 flex flex-col gap-2.5 sm:flex-row">
                <input
                  type="text"
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value)}
                  placeholder="ALF-TKT-XXXXXXXXXX or ALF-..."
                  aria-label="Ticket ID or Registration Code"
                  className="min-h-[44px] flex-1 border border-[#EAE7E0]/20 bg-[#050505] px-3.5 py-2 font-mono-num text-sm text-[#EAE7E0] outline-none placeholder:text-[#EAE7E0]/30 focus:border-[#C8F36B]"
                />
                <button
                  type="submit"
                  disabled={isScanning}
                  className="inline-flex min-h-[44px] shrink-0 cursor-pointer items-center justify-center gap-2 border border-[#C8F36B] bg-[#C8F36B] px-5 py-2 font-mono-num text-xs font-bold tracking-wider text-[#050505] uppercase transition-colors hover:bg-[#EAE7E0] disabled:opacity-50"
                >
                  <ScanLine className="h-4 w-4" aria-hidden="true" />
                  <span>{isScanning ? 'Checking...' : 'Verify & Check In'}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Right: Verdict Banner */}
          <div className="lg:col-span-5">
            {scanError && (
              <div
                role="alert"
                className="mb-4 flex items-start gap-2.5 border border-[#FF1744]/50 bg-[#FF1744]/10 p-4 text-xs text-[#EAE7E0]"
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#FF1744]" aria-hidden="true" />
                <span>{scanError}</span>
              </div>
            )}

            {lastResult ? (
              <div
                role="status"
                aria-live="assertive"
                className={`border-2 p-6 ${
                  lastResult.outcome === 'ENTRY_APPROVED'
                    ? 'border-[#C8F36B] bg-[#0B160B]'
                    : lastResult.outcome === 'ALREADY_CHECKED_IN'
                      ? 'border-[#FF6D00] bg-[#191005]'
                      : 'border-[#FF1744] bg-[#19060B]'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    {lastResult.outcome === 'ENTRY_APPROVED' ? (
                      <CheckCircle2 className="h-8 w-8 shrink-0 text-[#C8F36B]" aria-hidden="true" />
                    ) : lastResult.outcome === 'ALREADY_CHECKED_IN' ? (
                      <AlertTriangle className="h-8 w-8 shrink-0 text-[#FF6D00]" aria-hidden="true" />
                    ) : (
                      <XCircle className="h-8 w-8 shrink-0 text-[#FF1744]" aria-hidden="true" />
                    )}
                    <div>
                      <p
                        className={`font-mono-num text-[11px] font-bold tracking-widest uppercase ${
                          lastResult.outcome === 'ENTRY_APPROVED'
                            ? 'text-[#C8F36B]'
                            : lastResult.outcome === 'ALREADY_CHECKED_IN'
                              ? 'text-[#FF6D00]'
                              : 'text-[#FF1744]'
                        }`}
                      >
                        Gate Verdict · {lastResult.scanMethod.toUpperCase()}
                      </p>
                      <h2 className="mt-0.5 font-display text-2xl font-black tracking-tight text-[#EAE7E0] uppercase">
                        {lastResult.headline}
                      </h2>
                    </div>
                  </div>
                </div>

                <p className="mt-3 text-sm leading-relaxed text-[#EAE7E0]/85">{lastResult.message}</p>

                {lastResult.checkedInAt && (
                  <div className="mt-4 border border-[#EAE7E0]/15 bg-[#050505]/70 p-3 font-mono-num text-xs">
                    <p className="text-[10px] tracking-wider text-[#EAE7E0]/55 uppercase">
                      {lastResult.outcome === 'ALREADY_CHECKED_IN'
                        ? 'Original Check-In Timestamp'
                        : 'Checked-In Timestamp'}
                    </p>
                    <p className="mt-1 font-semibold text-[#EAE7E0]">
                      {formatTimestamp(lastResult.checkedInAt)}
                    </p>
                    {lastResult.checkedInByName && (
                      <p className="mt-1 text-[11px] text-[#EAE7E0]/65">
                        Gate Staff: {lastResult.checkedInByName}
                      </p>
                    )}
                  </div>
                )}

                {lastResult.ticket && (
                  <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-[#EAE7E0]/12 pt-4 text-xs">
                    <div>
                      <dt className="font-mono-num text-[10px] tracking-wider text-[#EAE7E0]/50 uppercase">
                        Participant / Team
                      </dt>
                      <dd className="mt-0.5 font-semibold text-[#EAE7E0]">
                        {lastResult.ticket.participantOrTeamName}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-mono-num text-[10px] tracking-wider text-[#EAE7E0]/50 uppercase">
                        Pass Tier
                      </dt>
                      <dd className="mt-0.5 font-semibold text-[#C8F36B]">
                        {lastResult.ticket.passCategoryLabel} ({lastResult.ticket.participantCount})
                      </dd>
                    </div>
                    <div>
                      <dt className="font-mono-num text-[10px] tracking-wider text-[#EAE7E0]/50 uppercase">
                        Ticket ID
                      </dt>
                      <dd className="mt-0.5 font-mono-num text-[#EAE7E0]">
                        {lastResult.ticket.ticketId}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-mono-num text-[10px] tracking-wider text-[#EAE7E0]/50 uppercase">
                        Registration Code
                      </dt>
                      <dd className="mt-0.5 font-mono-num text-[#EAE7E0]">
                        {lastResult.ticket.registrationCode}
                      </dd>
                    </div>
                    <div className="col-span-2">
                      <dt className="font-mono-num text-[10px] tracking-wider text-[#EAE7E0]/50 uppercase">
                        Categories
                      </dt>
                      <dd className="mt-0.5 text-[#EAE7E0]/85">
                        {lastResult.ticket.categoriesDisplay}
                      </dd>
                    </div>
                  </dl>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setLastResult(null);
                    setScanPaused(false);
                    setScanError(null);
                  }}
                  className="mt-5 flex min-h-[42px] w-full cursor-pointer items-center justify-center gap-2 border border-[#EAE7E0]/30 bg-[#050505] px-4 py-2 font-mono-num text-xs font-semibold tracking-wider text-[#EAE7E0] uppercase transition-colors hover:border-[#00E5FF] hover:text-[#00E5FF]"
                >
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Scan Next Ticket</span>
                </button>
              </div>
            ) : (
              <div className="flex h-full min-h-[260px] flex-col items-center justify-center border border-[#EAE7E0]/12 bg-[#0B0B0D] p-6 text-center">
                <ScanLine className="h-9 w-9 text-[#EAE7E0]/30" aria-hidden="true" />
                <p className="mt-3 font-display text-lg font-bold tracking-tight text-[#EAE7E0] uppercase">
                  Awaiting Ticket Scan
                </p>
                <p className="mt-1.5 max-w-xs text-xs leading-relaxed text-[#EAE7E0]/55">
                  Every QR scan and manual lookup is validated server-side with duplicate check-in lock protection.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Recent Gate Activity */}
        <section className="border border-[#EAE7E0]/12 bg-[#0B0B0D]">
          <div className="flex items-center justify-between border-b border-[#EAE7E0]/12 px-4 py-3.5 sm:px-5">
            <div>
              <h2 className="font-display text-base font-bold tracking-tight text-[#EAE7E0] uppercase">
                Recent Gate Check-Ins
              </h2>
              <p className="font-mono-num text-[11px] text-[#EAE7E0]/50">
                Showing up to 15 most recent admissions
              </p>
            </div>
          </div>

          {recentCheckins.length === 0 ? (
            <p className="px-5 py-8 text-center text-xs text-[#EAE7E0]/50">
              No tickets have been checked in yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-[#EAE7E0]/10 font-mono-num text-[10px] tracking-wider text-[#EAE7E0]/50 uppercase">
                    <th className="px-4 py-3">Ticket ID</th>
                    <th className="px-4 py-3">Reg Code</th>
                    <th className="px-4 py-3">Guest / Team</th>
                    <th className="px-4 py-3">Pass</th>
                    <th className="px-4 py-3">Method</th>
                    <th className="px-4 py-3">Checked-In By</th>
                    <th className="px-4 py-3">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EAE7E0]/8">
                  {recentCheckins.map((item) => (
                    <tr key={`${item.ticketId}-${item.checkedInAt}`} className="hover:bg-[#EAE7E0]/[0.02]">
                      <td className="px-4 py-3 font-mono-num font-semibold text-[#C8F36B]">
                        {item.ticketId}
                      </td>
                      <td className="px-4 py-3 font-mono-num text-[#EAE7E0]/80">
                        {item.registrationCode}
                      </td>
                      <td className="px-4 py-3 font-medium text-[#EAE7E0]">
                        {item.participantOrTeamName}
                      </td>
                      <td className="px-4 py-3 font-mono-num text-[#EAE7E0]/75">
                        {item.passCategoryLabel} ({item.participantCount})
                      </td>
                      <td className="px-4 py-3 font-mono-num text-[11px] uppercase text-[#00E5FF]">
                        {item.scanMethod}
                      </td>
                      <td className="px-4 py-3 text-[#EAE7E0]/75">{item.checkedInByName}</td>
                      <td className="px-4 py-3 font-mono-num text-[11px] text-[#EAE7E0]/60">
                        {formatTimestamp(item.checkedInAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
