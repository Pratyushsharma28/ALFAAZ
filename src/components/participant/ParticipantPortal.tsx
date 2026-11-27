import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Calendar,
  CheckCircle2,
  Clock,
  CreditCard,
  Loader2,
  LogOut,
  Mail,
  MapPin,
  QrCode,
  RefreshCw,
  ShieldCheck,
  Ticket,
  Users,
  XCircle,
} from 'lucide-react';
import { getParticipantSupabaseClient } from '../../lib/participantSupabaseClient';
import { getSupabaseConfigStatus } from '../../lib/supabaseClient';
import {
  fetchMyRegistrations,
  getActiveParticipantSession,
  ParticipantApiError,
  requestParticipantEmailOtp,
  signOutParticipant,
  verifyParticipantEmailOtp,
  verifyTicketQrCode,
} from '../../services/participantApi';
import type {
  ParticipantPaymentStatusCode,
  ParticipantPortalPayload,
  ParticipantRegistrationItem,
  TicketQrVerificationResponse,
} from '../../types/participant';
import { TicketQrPassCard } from './TicketQrPassCard';
import { ResubmitProofPanel } from './ResubmitProofPanel';

interface ParticipantPortalProps {
  onNavigateHome: () => void;
  onOpenRegistration: () => void;
}

function formatDateTime(raw: string | null | undefined): string {
  if (!raw) return '—';
  const dt = new Date(raw);
  if (Number.isNaN(dt.getTime())) return raw;
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(dt);
}

function getStatusBadgeStyle(status: ParticipantPaymentStatusCode): string {
  switch (status) {
    case 'verified':
      return 'border-[#C8F36B]/60 bg-[#0D1A0E] text-[#C8F36B]';
    case 'rejected':
      return 'border-[#FF1744]/65 bg-[#17060A] text-[#FF1744]';
    case 'proof_submitted':
      return 'border-[#FF6D00]/60 bg-[#140B06] text-[#FF6D00]';
    default:
      return 'border-[#00E5FF]/50 bg-[#060E12] text-[#00E5FF]';
  }
}

function readQrVerifyParams(): {
  ticketId: string;
  registrationId: string;
  signature: string;
} | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const ticketId = params.get('verify')?.trim() ?? '';
  const registrationId = params.get('reg')?.trim() ?? '';
  const signature = params.get('sig')?.trim() ?? '';
  if (!ticketId || !registrationId || !signature) return null;
  return { ticketId, registrationId, signature };
}

export default function ParticipantPortal({
  onNavigateHome,
  onOpenRegistration,
}: ParticipantPortalProps) {
  const supabaseConfig = useMemo(() => getSupabaseConfigStatus(), []);

  // Gate QR verification state (when opened via scanned QR URL)
  const [qrParams, setQrParams] = useState(readQrVerifyParams);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrResult, setQrResult] = useState<TicketQrVerificationResponse | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);

  // Auth / OTP state
  const [authChecking, setAuthChecking] = useState(true);
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [emailInput, setEmailInput] = useState('');
  const [otpInput, setOtpInput] = useState('');
  const [otpSentToEmail, setOtpSentToEmail] = useState<string | null>(null);
  const [otpCooldown, setOtpCooldown] = useState(0);
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authNotice, setAuthNotice] = useState<string | null>(null);

  // Portal data state
  const [portalData, setPortalData] = useState<ParticipantPortalPayload | null>(null);
  const [loadingData, setLoadingData] = useState(false);
  const [refreshingData, setRefreshingData] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);

  // Run QR verification lookup whenever qrParams are present
  useEffect(() => {
    if (!qrParams) {
      setQrResult(null);
      setQrError(null);
      return;
    }

    let cancelled = false;
    setQrLoading(true);
    setQrError(null);

    verifyTicketQrCode(qrParams)
      .then((res) => {
        if (!cancelled) setQrResult(res);
      })
      .catch((err) => {
        if (!cancelled) {
          setQrError(
            err instanceof ParticipantApiError
              ? err.message
              : 'Unable to verify ticket pass right now.'
          );
        }
      })
      .finally(() => {
        if (!cancelled) setQrLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [qrParams]);

  // Countdown timer for OTP resend
  useEffect(() => {
    if (otpCooldown <= 0) return;
    const timer = window.setInterval(() => {
      setOtpCooldown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [otpCooldown]);

  const loadRegistrations = useCallback(async (isBackgroundRefresh = false) => {
    if (isBackgroundRefresh) {
      setRefreshingData(true);
    } else {
      setLoadingData(true);
    }
    setDataError(null);

    try {
      const payload = await fetchMyRegistrations();
      setPortalData(payload);
    } catch (err) {
      if (err instanceof ParticipantApiError && err.statusCode === 401) {
        setSessionEmail(null);
        setPortalData(null);
        setAuthError('Your verification session expired. Please verify your email again.');
      } else {
        setDataError(
          err instanceof ParticipantApiError
            ? err.message
            : 'Unable to load your registrations and payment history.'
        );
      }
    } finally {
      setLoadingData(false);
      setRefreshingData(false);
    }
  }, []);

  // Initialize & subscribe to isolated participant auth session (handles both OTP and Magic Link callbacks)
  useEffect(() => {
    if (!supabaseConfig.isConfigured) {
      setAuthChecking(false);
      return;
    }

    let mounted = true;
    const supabase = getParticipantSupabaseClient();

    getActiveParticipantSession()
      .then((session) => {
        if (!mounted) return;
        const email = session?.user?.email?.trim().toLowerCase() ?? null;
        setSessionEmail(email);
        if (email) {
          void loadRegistrations(false);
        }
      })
      .finally(() => {
        if (mounted) setAuthChecking(false);
      });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return;
      const nextEmail = nextSession?.user?.email?.trim().toLowerCase() ?? null;
      setSessionEmail(nextEmail);
      if (nextEmail) {
        setAuthError(null);
        setAuthNotice(null);
        // Clean magic-link hash params from address bar cleanly
        if (window.location.hash && window.location.hash.includes('access_token')) {
          window.history.replaceState(
            null,
            '',
            `${window.location.pathname}${window.location.search}`
          );
        }
        void loadRegistrations(false);
      } else {
        setPortalData(null);
      }
    });

    return () => {
      mounted = false;
      subscription.subscription.unsubscribe();
    };
  }, [supabaseConfig.isConfigured, loadRegistrations]);

  // Auto-sync on window focus & every 30s while any registration awaits admin verification
  useEffect(() => {
    if (!sessionEmail) return;
    const hasPendingVerification = Boolean(
      portalData?.registrations.some(
        (r) => r.paymentStatus === 'proof_submitted' || r.paymentStatus === 'payment_pending'
      )
    );

    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        void loadRegistrations(true);
      }
    };

    window.addEventListener('focus', handleVisibilityOrFocus);
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);

    let intervalId: number | null = null;
    if (hasPendingVerification) {
      intervalId = window.setInterval(() => {
        if (document.visibilityState === 'visible') {
          void loadRegistrations(true);
        }
      }, 30000);
    }

    return () => {
      window.removeEventListener('focus', handleVisibilityOrFocus);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      if (intervalId !== null) window.clearInterval(intervalId);
    };
  }, [sessionEmail, portalData?.registrations, loadRegistrations]);

  const handleRequestOtp = async (event?: FormEvent) => {
    event?.preventDefault();
    if (authSubmitting || otpCooldown > 0) return;

    const targetEmail = (otpSentToEmail || emailInput).trim().toLowerCase();
    setAuthSubmitting(true);
    setAuthError(null);
    setAuthNotice(null);

    try {
      const { cooldownSeconds } = await requestParticipantEmailOtp(targetEmail);
      setOtpSentToEmail(targetEmail);
      setOtpCooldown(cooldownSeconds);
      setAuthNotice(
        `We sent a verification code and login link to ${targetEmail}. Enter the 6-digit code below or click the link in your email.`
      );
    } catch (err) {
      setAuthError(
        err instanceof ParticipantApiError
          ? err.message
          : 'Unable to send verification email. Please check your email and try again.'
      );
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleVerifyOtp = async (event: FormEvent) => {
    event.preventDefault();
    if (authSubmitting || !otpSentToEmail) return;

    setAuthSubmitting(true);
    setAuthError(null);

    try {
      const session = await verifyParticipantEmailOtp(otpSentToEmail, otpInput);
      setSessionEmail(session.user?.email?.trim().toLowerCase() ?? otpSentToEmail);
      setOtpInput('');
    } catch (err) {
      setAuthError(
        err instanceof ParticipantApiError
          ? err.message
          : 'Invalid or expired verification code.'
      );
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleLogout = async () => {
    await signOutParticipant();
    setSessionEmail(null);
    setPortalData(null);
    setOtpSentToEmail(null);
    setOtpInput('');
    setAuthNotice(null);
    setAuthError(null);
  };

  const handleInspectQrUrl = (verificationUrl: string) => {
    try {
      const parsed = new URL(verificationUrl);
      const ticketId = parsed.searchParams.get('verify') || '';
      const registrationId = parsed.searchParams.get('reg') || '';
      const signature = parsed.searchParams.get('sig') || '';
      if (ticketId && registrationId && signature) {
        window.history.pushState(null, '', `/my-tickets${parsed.search}`);
        setQrParams({ ticketId, registrationId, signature });
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } catch {
      // ignore invalid URL
    }
  };

  const dismissQrParams = () => {
    window.history.pushState(null, '', '/my-tickets');
    setQrParams(null);
  };

  const summary = useMemo(() => {
    const list = portalData?.registrations ?? [];
    return {
      total: list.length,
      verified: list.filter((r) => r.paymentStatus === 'verified').length,
      pending: list.filter(
        (r) => r.paymentStatus === 'proof_submitted' || r.paymentStatus === 'payment_pending'
      ).length,
      rejected: list.filter((r) => r.paymentStatus === 'rejected').length,
    };
  }, [portalData]);

  return (
    <div className="underground-surface relative min-h-screen bg-[#050505] text-[#EAE7E0]">
      <div
        aria-hidden="true"
        className="grain-overlay pointer-events-none fixed inset-0 z-10 opacity-[0.04]"
      />

      {/* Portal Header */}
      <header className="sticky top-0 z-20 border-b border-[#EAE7E0]/15 bg-[#050505]/92 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1280px] flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-10">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onNavigateHome}
              className="inline-flex min-h-[40px] cursor-pointer items-center gap-1.5 border border-[#EAE7E0]/20 bg-[#050505] px-3 py-1.5 font-mono-num text-xs font-semibold tracking-wider text-[#EAE7E0]/85 uppercase transition-colors hover:border-[#FF1744] hover:text-[#FF1744]"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Event Home</span>
            </button>
            <div>
              <p className="font-mono-num text-[10px] tracking-[0.22em] text-[#C8F36B] uppercase">
                ALFAAZ — UNFILTERED · Quad AI, Bengaluru
              </p>
              <h1 className="font-display text-2xl font-black tracking-tight text-[#EAE7E0] uppercase sm:text-3xl">
                My Tickets <span className="text-[#FF1744]">&amp;</span> Payment History
              </h1>
            </div>
          </div>

          {sessionEmail && (
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="hidden border border-[#EAE7E0]/15 bg-[#0A0A0D] px-3 py-2 font-mono-num text-xs text-[#EAE7E0]/80 sm:inline-flex sm:items-center sm:gap-1.5">
                <Mail className="h-3.5 w-3.5 text-[#C8F36B]" aria-hidden="true" />
                {sessionEmail}
              </span>

              <button
                type="button"
                disabled={refreshingData || loadingData}
                onClick={() => void loadRegistrations(true)}
                className="inline-flex min-h-[40px] cursor-pointer items-center gap-1.5 border border-[#EAE7E0]/25 bg-[#0A0A0D] px-3.5 py-2 font-mono-num text-xs font-semibold tracking-wider text-[#EAE7E0] uppercase transition-colors hover:border-[#00E5FF] hover:text-[#00E5FF] disabled:opacity-50"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${refreshingData ? 'animate-spin' : ''}`}
                  aria-hidden="true"
                />
                <span>Refresh</span>
              </button>

              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex min-h-[40px] cursor-pointer items-center gap-1.5 border border-[#FF1744]/50 bg-[#12060A] px-3.5 py-2 font-mono-num text-xs font-semibold tracking-wider text-[#FF1744] uppercase transition-colors hover:bg-[#FF1744] hover:text-[#EAE7E0]"
              >
                <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Logout</span>
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-[1280px] px-4 py-8 sm:px-6 lg:px-10">
        {/* Live Server QR Gate Verification Banner (when opened from ?verify=...&reg=...&sig=...) */}
        {qrParams && (
          <section
            aria-label="Ticket QR verification result"
            className="mb-8 border border-[#EAE7E0]/20 bg-[#0A0A0D] p-5 sm:p-6"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#EAE7E0]/12 pb-3">
              <div className="flex items-center gap-2">
                <QrCode className="h-5 w-5 text-[#00E5FF]" aria-hidden="true" />
                <h2 className="font-display text-2xl font-black tracking-tight uppercase">
                  Server Pass Verification Check
                </h2>
              </div>
              <button
                type="button"
                onClick={dismissQrParams}
                className="cursor-pointer border border-[#EAE7E0]/20 px-3 py-1 font-mono-num text-[11px] text-[#EAE7E0]/75 uppercase hover:border-[#EAE7E0]"
              >
                Close Check
              </button>
            </div>

            {qrLoading ? (
              <div className="flex items-center gap-2.5 py-6 text-sm text-[#EAE7E0]/80">
                <Loader2 className="h-5 w-5 animate-spin text-[#00E5FF]" aria-hidden="true" />
                <span>Verifying pass signature and live payment status...</span>
              </div>
            ) : qrError ? (
              <p className="mt-4 text-sm text-[#FF1744]">{qrError}</p>
            ) : qrResult ? (
              <div
                className={`mt-4 border p-4 sm:p-5 ${
                  qrResult.valid
                    ? 'border-[#C8F36B]/55 bg-[#081209]'
                    : 'border-[#FF1744]/60 bg-[#14060A]'
                }`}
              >
                <div className="flex items-start gap-3">
                  {qrResult.valid ? (
                    <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-[#C8F36B]" aria-hidden="true" />
                  ) : (
                    <XCircle className="mt-0.5 h-6 w-6 shrink-0 text-[#FF1744]" aria-hidden="true" />
                  )}
                  <div>
                    <p
                      className={`font-mono-num text-xs font-bold tracking-[0.2em] uppercase ${
                        qrResult.valid ? 'text-[#C8F36B]' : 'text-[#FF1744]'
                      }`}
                    >
                      {qrResult.statusLabel}
                    </p>
                    <p className="mt-1 text-sm text-[#EAE7E0]/90">{qrResult.message}</p>

                    <dl className="mt-3 grid grid-cols-2 gap-4 text-xs sm:grid-cols-4">
                      <div>
                        <dt className="font-mono-num text-[10px] text-[#EAE7E0]/55 uppercase">
                          Ticket ID
                        </dt>
                        <dd className="mt-0.5 font-mono-num font-bold text-[#EAE7E0]">
                          {qrResult.ticketId}
                        </dd>
                      </div>
                      {qrResult.registrationCode && (
                        <div>
                          <dt className="font-mono-num text-[10px] text-[#EAE7E0]/55 uppercase">
                            Registration Code
                          </dt>
                          <dd className="mt-0.5 font-mono-num font-bold text-[#EAE7E0]">
                            {qrResult.registrationCode}
                          </dd>
                        </div>
                      )}
                      {qrResult.participantOrTeamName && (
                        <div>
                          <dt className="font-mono-num text-[10px] text-[#EAE7E0]/55 uppercase">
                            Participant / Team
                          </dt>
                          <dd className="mt-0.5 font-semibold text-[#EAE7E0]">
                            {qrResult.participantOrTeamName}
                          </dd>
                        </div>
                      )}
                      {qrResult.passCategoryLabel && (
                        <div>
                          <dt className="font-mono-num text-[10px] text-[#EAE7E0]/55 uppercase">
                            Pass &amp; Category
                          </dt>
                          <dd className="mt-0.5 font-semibold text-[#EAE7E0]">
                            {qrResult.passCategoryLabel} · {qrResult.categoriesDisplay}
                          </dd>
                        </div>
                      )}
                    </dl>
                  </div>
                </div>
              </div>
            ) : null}
          </section>
        )}

        {/* Loading Auth State */}
        {authChecking ? (
          <div className="flex min-h-[320px] flex-col items-center justify-center border border-[#EAE7E0]/15 bg-[#0A0A0D] p-8 text-center">
            <Loader2 className="h-7 w-7 animate-spin text-[#FF1744]" aria-hidden="true" />
            <p className="mt-4 font-mono-num text-xs tracking-widest text-[#EAE7E0]/70 uppercase">
              Checking verification session...
            </p>
          </div>
        ) : !supabaseConfig.isConfigured ? (
          <div className="border border-[#FF1744]/55 bg-[#12060A] p-6">
            <p className="font-mono-num text-xs font-bold tracking-widest text-[#FF1744] uppercase">
              Participant Auth Configuration Required
            </p>
            <p className="mt-2 text-sm text-[#EAE7E0]/85">{supabaseConfig.configError}</p>
          </div>
        ) : !sessionEmail ? (
          /* SECURE EMAIL OTP / MAGIC LINK LOGIN VIEW */
          <div className="mx-auto max-w-xl border border-[#EAE7E0]/20 bg-[#0A0A0D] p-6 shadow-[0_0_40px_rgba(255,23,68,0.08)] sm:p-8">
            <div className="flex items-center gap-2 font-mono-num text-[11px] font-bold tracking-[0.2em] text-[#C8F36B] uppercase">
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              <span>Verified Participant Access</span>
            </div>

            <h2 className="mt-2 font-display text-4xl font-black tracking-tight text-[#EAE7E0] uppercase">
              Verify Your Registration Email
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-[#EAE7E0]/75">
              Enter the email address used during your ALFAAZ registration. We will send a
              one-time verification code and secure sign-in link to protect your tickets and
              payment history.
            </p>

            {!otpSentToEmail ? (
              <form onSubmit={handleRequestOtp} className="mt-6 space-y-4">
                <div>
                  <label
                    htmlFor="participant-login-email"
                    className="block font-mono-num text-xs font-semibold tracking-wider text-[#EAE7E0]/85 uppercase"
                  >
                    Registered Email Address
                  </label>
                  <input
                    id="participant-login-email"
                    type="email"
                    required
                    autoComplete="email"
                    disabled={authSubmitting}
                    placeholder="you@college.edu"
                    value={emailInput}
                    onChange={(e) => {
                      setEmailInput(e.target.value);
                      setAuthError(null);
                    }}
                    className="mt-2 min-h-[46px] w-full border border-[#EAE7E0]/25 bg-[#050505] px-4 py-2.5 text-sm text-[#EAE7E0] placeholder:text-[#EAE7E0]/35 focus:border-[#FF1744] focus:outline-none"
                  />
                </div>

                {authError && (
                  <p role="alert" className="border border-[#FF1744]/55 bg-[#15060A] px-3.5 py-2.5 text-xs text-[#FF1744]">
                    {authError}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={authSubmitting}
                  className="neon-cta-breathe inline-flex min-h-[46px] w-full cursor-pointer items-center justify-center gap-2 border border-[#FF1744] bg-[#FF1744] px-6 py-2.5 font-display text-xl font-extrabold tracking-wider text-[#EAE7E0] uppercase transition-colors hover:bg-[#ff2b54] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {authSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                      <span>Sending Verification Code...</span>
                    </>
                  ) : (
                    <>
                      <span>Send Verification Code</span>
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </>
                  )}
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp} className="mt-6 space-y-4">
                <div className="border border-[#00E5FF]/40 bg-[#050B0E] px-4 py-3 text-xs leading-relaxed text-[#00E5FF]">
                  {authNotice ||
                    `Verification code & link sent to ${otpSentToEmail}. Check your inbox (and spam folder).`}
                </div>

                <div>
                  <label
                    htmlFor="participant-login-otp"
                    className="block font-mono-num text-xs font-semibold tracking-wider text-[#EAE7E0]/85 uppercase"
                  >
                    6-Digit Email Verification Code
                  </label>
                  <input
                    id="participant-login-otp"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    required
                    disabled={authSubmitting}
                    placeholder="Enter 6-digit code"
                    value={otpInput}
                    onChange={(e) => {
                      setOtpInput(e.target.value);
                      setAuthError(null);
                    }}
                    className="mt-2 min-h-[48px] w-full border border-[#EAE7E0]/25 bg-[#050505] px-4 py-2.5 font-mono-num text-lg tracking-[0.3em] text-[#EAE7E0] placeholder:text-sm placeholder:tracking-normal placeholder:text-[#EAE7E0]/35 focus:border-[#C8F36B] focus:outline-none"
                  />
                </div>

                {authError && (
                  <p role="alert" className="border border-[#FF1744]/55 bg-[#15060A] px-3.5 py-2.5 text-xs text-[#FF1744]">
                    {authError}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={authSubmitting}
                  className="inline-flex min-h-[46px] w-full cursor-pointer items-center justify-center gap-2 border border-[#C8F36B] bg-[#C8F36B] px-6 py-2.5 font-display text-xl font-extrabold tracking-wider text-[#050505] uppercase transition-colors hover:bg-[#d7f98d] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {authSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                      <span>Verifying Code...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                      <span>Verify &amp; View My Tickets</span>
                    </>
                  )}
                </button>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 text-xs">
                  <button
                    type="button"
                    disabled={authSubmitting || otpCooldown > 0}
                    onClick={() => void handleRequestOtp()}
                    className="cursor-pointer font-mono-num text-[#00E5FF] underline-offset-4 hover:underline disabled:cursor-not-allowed disabled:text-[#EAE7E0]/40 disabled:no-underline"
                  >
                    {otpCooldown > 0
                      ? `Resend code in ${otpCooldown}s`
                      : 'Resend verification code'}
                  </button>

                  <button
                    type="button"
                    disabled={authSubmitting}
                    onClick={() => {
                      setOtpSentToEmail(null);
                      setOtpInput('');
                      setAuthError(null);
                      setAuthNotice(null);
                    }}
                    className="cursor-pointer font-mono-num text-[#EAE7E0]/70 hover:text-[#EAE7E0]"
                  >
                    Use different email
                  </button>
                </div>
              </form>
            )}
          </div>
        ) : (
          /* AUTHENTICATED PARTICIPANT PORTAL */
          <div className="space-y-6">
            {/* Mobile email banner */}
            <div className="flex flex-wrap items-center justify-between gap-2 border border-[#EAE7E0]/12 bg-[#0A0A0D] px-4 py-2.5 text-xs sm:hidden">
              <span className="font-mono-num text-[#EAE7E0]/80">{sessionEmail}</span>
              {portalData?.fetchedAt && (
                <span className="font-mono-num text-[11px] text-[#EAE7E0]/50">
                  Synced {formatDateTime(portalData.fetchedAt)}
                </span>
              )}
            </div>

            {/* Summary KPI Strip */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="border border-[#EAE7E0]/15 bg-[#0A0A0D] p-4">
                <p className="font-mono-num text-[10px] tracking-widest text-[#EAE7E0]/55 uppercase">
                  My Registrations
                </p>
                <p className="mt-1 font-display text-3xl font-black text-[#EAE7E0]">
                  {summary.total}
                </p>
              </div>
              <div className="border border-[#C8F36B]/30 bg-[#081009] p-4">
                <p className="font-mono-num text-[10px] tracking-widest text-[#C8F36B] uppercase">
                  Confirmed Tickets
                </p>
                <p className="mt-1 font-display text-3xl font-black text-[#C8F36B]">
                  {summary.verified}
                </p>
              </div>
              <div className="border border-[#FF6D00]/30 bg-[#120A06] p-4">
                <p className="font-mono-num text-[10px] tracking-widest text-[#FF6D00] uppercase">
                  Awaiting Verification
                </p>
                <p className="mt-1 font-display text-3xl font-black text-[#FF6D00]">
                  {summary.pending}
                </p>
              </div>
              <div className="border border-[#FF1744]/35 bg-[#12060A] p-4">
                <p className="font-mono-num text-[10px] tracking-widest text-[#FF1744] uppercase">
                  Action Required
                </p>
                <p className="mt-1 font-display text-3xl font-black text-[#FF1744]">
                  {summary.rejected}
                </p>
              </div>
            </div>

            {loadingData ? (
              <div className="flex min-h-[260px] flex-col items-center justify-center border border-[#EAE7E0]/15 bg-[#0A0A0D] p-8 text-center">
                <Loader2 className="h-7 w-7 animate-spin text-[#FF1744]" aria-hidden="true" />
                <p className="mt-3 font-mono-num text-xs tracking-widest text-[#EAE7E0]/70 uppercase">
                  Loading registrations and payment history...
                </p>
              </div>
            ) : dataError ? (
              <div role="alert" className="border border-[#FF1744]/55 bg-[#12060A] p-6">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[#FF1744]" aria-hidden="true" />
                  <div>
                    <p className="font-mono-num text-xs font-bold tracking-widest text-[#FF1744] uppercase">
                      Unable to Load Portal Data
                    </p>
                    <p className="mt-1 text-sm text-[#EAE7E0]/85">{dataError}</p>
                    <button
                      type="button"
                      onClick={() => void loadRegistrations(false)}
                      className="mt-4 inline-flex min-h-[40px] cursor-pointer items-center gap-2 border border-[#FF1744] bg-[#FF1744] px-4 py-2 font-mono-num text-xs font-semibold text-[#EAE7E0] uppercase"
                    >
                      <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                      Try Again
                    </button>
                  </div>
                </div>
              </div>
            ) : !portalData || portalData.registrations.length === 0 ? (
              /* Friendly Empty State */
              <div className="border border-[#EAE7E0]/15 bg-[#0A0A0D] p-8 text-center sm:p-12">
                <Ticket className="mx-auto h-10 w-10 text-[#EAE7E0]/35" aria-hidden="true" />
                <h2 className="mt-4 font-display text-3xl font-black tracking-tight text-[#EAE7E0] uppercase">
                  No Registrations Found for {sessionEmail}
                </h2>
                <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-[#EAE7E0]/70">
                  We could not find any ALFAAZ — UNFILTERED registrations linked to this verified
                  email address. If you registered with another email, sign out and verify that
                  email instead, or register now to book your pass.
                </p>
                <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={onOpenRegistration}
                    className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 border border-[#FF1744] bg-[#FF1744] px-6 py-2.5 font-display text-lg font-extrabold tracking-wider text-[#EAE7E0] uppercase hover:bg-[#ff2b54]"
                  >
                    Register for ALFAAZ
                  </button>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 border border-[#EAE7E0]/25 bg-[#050505] px-5 py-2.5 font-mono-num text-xs font-semibold text-[#EAE7E0] uppercase hover:border-[#EAE7E0]/60"
                  >
                    Try Different Email
                  </button>
                </div>
              </div>
            ) : (
              /* Registration Cards + Payment History */
              <div className="space-y-8">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-mono-num text-xs tracking-wider text-[#EAE7E0]/60 uppercase">
                    Showing {portalData.registrations.length} registration
                    {portalData.registrations.length > 1 ? 's' : ''} linked to{' '}
                    <span className="text-[#EAE7E0]">{portalData.email}</span>
                  </p>
                  <p className="font-mono-num text-[11px] text-[#EAE7E0]/50">
                    Last synced: {formatDateTime(portalData.fetchedAt)}
                  </p>
                </div>

                {portalData.registrations.map((reg: ParticipantRegistrationItem) => (
                  <article
                    key={reg.registrationId}
                    className="border border-[#EAE7E0]/20 bg-[#0A0A0D] p-5 sm:p-7"
                  >
                    {/* Top Registration Banner */}
                    <div className="flex flex-col gap-4 border-b border-[#EAE7E0]/12 pb-5 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-[#EAE7E0]/65">
                          <span className="font-mono-num font-bold tracking-widest text-[#FF1744] uppercase">
                            {reg.eventName}
                          </span>
                          <span>·</span>
                          <span className="inline-flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
                            {reg.eventDate}
                          </span>
                          <span>·</span>
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                            {reg.venue}
                          </span>
                        </div>

                        <h3 className="mt-2 font-display text-3xl font-black tracking-tight text-[#EAE7E0] uppercase sm:text-4xl">
                          {reg.teamOrIndividualName}
                        </h3>
                        <p className="mt-1 font-mono-num text-xs text-[#EAE7E0]/65">
                          Registration Code:{' '}
                          <strong className="text-[#EAE7E0]">{reg.registrationCode}</strong>
                          <span className="mx-2 text-[#EAE7E0]/30">|</span>
                          ID: <span className="text-[#EAE7E0]/85">{reg.registrationId}</span>
                        </p>
                      </div>

                      <div className="flex flex-col items-start gap-2 lg:items-end">
                        <span
                          className={`inline-flex items-center gap-1.5 border px-3 py-1.5 font-mono-num text-xs font-bold tracking-wider uppercase ${getStatusBadgeStyle(
                            reg.paymentStatus
                          )}`}
                        >
                          {reg.paymentStatus === 'verified' ? (
                            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                          ) : reg.paymentStatus === 'rejected' ? (
                            <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
                          ) : (
                            <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                          )}
                          <span>{reg.paymentStatusLabel}</span>
                        </span>

                        <span className="font-mono-num text-[11px] text-[#EAE7E0]/65">
                          Ticket Status:{' '}
                          <strong
                            className={
                              reg.paymentStatus === 'verified'
                                ? 'text-[#C8F36B]'
                                : reg.paymentStatus === 'rejected'
                                  ? 'text-[#FF1744]'
                                  : 'text-[#EAE7E0]'
                            }
                          >
                            {reg.ticketStatusLabel}
                          </strong>
                        </span>
                      </div>
                    </div>

                    {/* Registration Core Metadata Grid */}
                    <dl className="mt-5 grid grid-cols-2 gap-4 text-xs sm:grid-cols-3 lg:grid-cols-6">
                      <div>
                        <dt className="font-mono-num text-[10px] tracking-widest text-[#EAE7E0]/50 uppercase">
                          Lead / Participant
                        </dt>
                        <dd className="mt-1 font-semibold text-[#EAE7E0]">
                          {reg.participantName}
                        </dd>
                      </div>
                      <div>
                        <dt className="font-mono-num text-[10px] tracking-widest text-[#EAE7E0]/50 uppercase">
                          Pass Category
                        </dt>
                        <dd className="mt-1 font-semibold text-[#EAE7E0]">
                          {reg.passCategoryLabel} ({reg.categoriesDisplay})
                        </dd>
                      </div>
                      <div>
                        <dt className="font-mono-num text-[10px] tracking-widest text-[#EAE7E0]/50 uppercase">
                          Participants
                        </dt>
                        <dd className="mt-1 inline-flex items-center gap-1 font-mono-num font-semibold text-[#EAE7E0]">
                          <Users className="h-3.5 w-3.5 text-[#00E5FF]" aria-hidden="true" />
                          {reg.participantCount}
                        </dd>
                      </div>
                      <div>
                        <dt className="font-mono-num text-[10px] tracking-widest text-[#EAE7E0]/50 uppercase">
                          Registered On
                        </dt>
                        <dd className="mt-1 font-mono-num text-[#EAE7E0]/85">
                          {formatDateTime(reg.registeredAt)}
                        </dd>
                      </div>
                      <div>
                        <dt className="font-mono-num text-[10px] tracking-widest text-[#EAE7E0]/50 uppercase">
                          Amount Payable
                        </dt>
                        <dd className="mt-1 font-mono-num font-bold text-[#EAE7E0]">
                          ₹{reg.amountPayableInr}
                        </dd>
                      </div>
                      <div>
                        <dt className="font-mono-num text-[10px] tracking-widest text-[#EAE7E0]/50 uppercase">
                          Amount Paid
                        </dt>
                        <dd
                          className={`mt-1 font-mono-num font-bold ${
                            reg.amountPaidInr !== null ? 'text-[#C8F36B]' : 'text-[#EAE7E0]/55'
                          }`}
                        >
                          {reg.amountPaidInr !== null
                            ? `₹${reg.amountPaidInr} (Confirmed)`
                            : 'Not Confirmed Yet'}
                        </dd>
                      </div>
                    </dl>

                    {reg.participantNames && (
                      <p className="mt-3 text-xs text-[#EAE7E0]/65">
                        <span className="font-mono-num text-[10px] tracking-wider text-[#EAE7E0]/45 uppercase">
                          Member(s):{' '}
                        </span>
                        {reg.participantNames}
                      </p>
                    )}

                    {/* Confirmed Ticket Section (STRICTLY rendered only after admin verification) */}
                    <TicketQrPassCard
                      registration={reg}
                      onInspectQrVerification={handleInspectQrUrl}
                    />

                    {/* Resubmission Flow when Rejected or Awaiting Initial Proof */}
                    <ResubmitProofPanel
                      registration={reg}
                      onResubmitted={() => loadRegistrations(true)}
                    />

                    {/* Per-Registration Payment History */}
                    <div className="mt-6 border-t border-[#EAE7E0]/12 pt-5">
                      <div className="flex items-center gap-2">
                        <CreditCard className="h-4 w-4 text-[#00E5FF]" aria-hidden="true" />
                        <h4 className="font-mono-num text-xs font-bold tracking-[0.18em] text-[#EAE7E0] uppercase">
                          Payment History ({reg.paymentHistory.length})
                        </h4>
                      </div>

                      {reg.paymentHistory.length === 0 ? (
                        <p className="mt-3 border border-[#EAE7E0]/10 bg-[#050505] px-4 py-3 text-xs text-[#EAE7E0]/65">
                          No UPI payment submission recorded for this registration yet.
                        </p>
                      ) : (
                        <div className="mt-3 space-y-2.5">
                          {reg.paymentHistory.map((item) => (
                            <div
                              key={item.id}
                              className="grid grid-cols-1 gap-3 border border-[#EAE7E0]/12 bg-[#050505] p-3.5 text-xs sm:grid-cols-2 lg:grid-cols-5"
                            >
                              <div>
                                <p className="font-mono-num text-[10px] text-[#EAE7E0]/50 uppercase">
                                  Submitted Date
                                </p>
                                <p className="mt-0.5 font-mono-num text-[#EAE7E0]">
                                  {formatDateTime(item.submittedAt)}
                                </p>
                              </div>
                              <div>
                                <p className="font-mono-num text-[10px] text-[#EAE7E0]/50 uppercase">
                                  Method &amp; Amount
                                </p>
                                <p className="mt-0.5 font-mono-num font-bold text-[#EAE7E0]">
                                  {item.paymentMethod} · ₹{item.amountSubmittedInr}
                                </p>
                              </div>
                              <div>
                                <p className="font-mono-num text-[10px] text-[#EAE7E0]/50 uppercase">
                                  UTR / Reference
                                </p>
                                <p className="mt-0.5 font-mono-num text-[#C8F36B]">
                                  {item.utr}
                                </p>
                              </div>
                              <div>
                                <p className="font-mono-num text-[10px] text-[#EAE7E0]/50 uppercase">
                                  Proof Submission
                                </p>
                                <p className="mt-0.5 truncate text-[#EAE7E0]/85" title={item.proofFileName}>
                                  {item.proofStatusLabel} ({item.proofFileName})
                                </p>
                              </div>
                              <div>
                                <p className="font-mono-num text-[10px] text-[#EAE7E0]/50 uppercase">
                                  Admin Verification
                                </p>
                                <p
                                  className={`mt-0.5 font-semibold ${
                                    item.verificationStatus === 'verified'
                                      ? 'text-[#C8F36B]'
                                      : item.verificationStatus === 'rejected'
                                        ? 'text-[#FF1744]'
                                        : 'text-[#FF6D00]'
                                  }`}
                                >
                                  {item.verificationStatusLabel}
                                </p>
                                {item.reviewedAt && (
                                  <p className="mt-0.5 font-mono-num text-[10px] text-[#EAE7E0]/50">
                                    Reviewed: {formatDateTime(item.reviewedAt)}
                                  </p>
                                )}
                                {item.rejectionReason && (
                                  <p className="mt-1 text-[11px] text-[#FF1744]">
                                    Reason: {item.rejectionReason}
                                  </p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
