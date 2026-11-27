import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Loader2,
  MapPin,
  QrCode,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Ticket,
  Users,
  XCircle,
} from 'lucide-react';
import { ParticipantApiError, verifyTicketQrCode } from '../../services/participantApi';
import type { TicketQrVerificationResponse } from '../../types/participant';

interface TicketVerificationPageProps {
  onNavigateHome: () => void;
  onNavigateMyTickets: () => void;
}

interface ParsedQrQuery {
  ticketId: string;
  registrationId: string;
  signature: string;
}

function readTicketVerificationQuery(): ParsedQrQuery {
  if (typeof window === 'undefined') {
    return { ticketId: '', registrationId: '', signature: '' };
  }
  const params = new URLSearchParams(window.location.search);
  const ticketId = (params.get('ticketId') ?? params.get('verify') ?? '').trim();
  const registrationId = (params.get('reg') ?? params.get('registrationId') ?? '').trim();
  const signature = (params.get('sig') ?? '').trim();
  return { ticketId, registrationId, signature };
}

function formatVerifiedTimestamp(raw: string | null | undefined): string {
  if (!raw) return 'Confirmed';
  const dt = new Date(raw);
  if (Number.isNaN(dt.getTime())) return 'Confirmed';
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(dt);
}

export default function TicketVerificationPage({
  onNavigateHome,
  onNavigateMyTickets,
}: TicketVerificationPageProps) {
  const [query] = useState<ParsedQrQuery>(readTicketVerificationQuery);
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<TicketQrVerificationResponse | null>(null);
  const [networkError, setNetworkError] = useState<string | null>(null);

  const runVerification = useCallback(async () => {
    setLoading(true);
    setNetworkError(null);

    if (!query.ticketId || !query.registrationId || !query.signature) {
      setResult({
        valid: false,
        status: 'invalid',
        statusLabel: 'INVALID TICKET',
        message:
          'Missing or incomplete ticket verification parameters in QR link. Please scan the original QR pass again.',
        ticketId: query.ticketId || 'INVALID',
        eventName: 'ALFAAZ — UNFILTERED',
        eventDate: '18 December 2026 · 10:00 AM',
        venue: 'Quad AI, Bengaluru',
      });
      setLoading(false);
      return;
    }

    try {
      const response = await verifyTicketQrCode({
        ticketId: query.ticketId,
        registrationId: query.registrationId,
        signature: query.signature,
      });
      setResult(response);
    } catch (err) {
      setNetworkError(
        err instanceof ParticipantApiError
          ? err.message
          : 'Unable to reach ticket verification server right now. Please retry.'
      );
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    void runVerification();
  }, [runVerification]);

  const isValidTicket = Boolean(result?.valid && result.status === 'verified');
  const isRevokedOrUnverified = Boolean(
    result && !result.valid && (result.status === 'revoked' || result.status === 'pending')
  );

  return (
    <div className="underground-surface relative min-h-screen bg-[#050505] text-[#EAE7E0]">
      <div
        aria-hidden="true"
        className="grain-overlay pointer-events-none fixed inset-0 z-10 opacity-[0.04]"
      />

      {/* Public Gate Verification Header */}
      <header className="sticky top-0 z-20 border-b border-[#EAE7E0]/15 bg-[#050505]/92 backdrop-blur-md">
        <div className="mx-auto flex max-w-[960px] flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
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
                ALFAAZ — UNFILTERED · Entry Gate Verification
              </p>
              <h1 className="font-display text-2xl font-black tracking-tight text-[#EAE7E0] uppercase sm:text-3xl">
                Official Pass Check
              </h1>
            </div>
          </div>

          <button
            type="button"
            disabled={loading}
            onClick={() => void runVerification()}
            className="inline-flex min-h-[40px] cursor-pointer items-center gap-1.5 border border-[#EAE7E0]/25 bg-[#0A0A0D] px-3.5 py-2 font-mono-num text-xs font-semibold tracking-wider text-[#EAE7E0] uppercase transition-colors hover:border-[#00E5FF] hover:text-[#00E5FF] disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
            <span>Re-Verify</span>
          </button>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-[760px] px-4 py-8 sm:px-6 sm:py-12">
        {loading ? (
          <section
            aria-label="Verifying ticket"
            className="flex min-h-[280px] flex-col items-center justify-center border border-[#EAE7E0]/20 bg-[#0A0A0D] p-8 text-center"
          >
            <Loader2 className="h-9 w-9 animate-spin text-[#00E5FF]" aria-hidden="true" />
            <p className="mt-4 font-display text-2xl font-black tracking-wider text-[#EAE7E0] uppercase">
              Verifying Ticket Pass...
            </p>
            <p className="mt-1.5 font-mono-num text-xs text-[#EAE7E0]/65">
              Checking server cryptographic signature &amp; live payment status
            </p>
          </section>
        ) : networkError ? (
          <section
            role="alert"
            className="border border-[#FF1744]/60 bg-[#14060A] p-6 sm:p-8"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-7 w-7 shrink-0 text-[#FF1744]" aria-hidden="true" />
              <div>
                <p className="font-mono-num text-xs font-bold tracking-[0.2em] text-[#FF1744] uppercase">
                  Verification Service Error
                </p>
                <p className="mt-2 text-sm text-[#EAE7E0]/90">{networkError}</p>
                <button
                  type="button"
                  onClick={() => void runVerification()}
                  className="mt-5 inline-flex min-h-[44px] cursor-pointer items-center gap-2 border border-[#FF1744] bg-[#FF1744] px-5 py-2.5 font-display text-base font-extrabold tracking-wider text-[#EAE7E0] uppercase hover:bg-[#ff2b54]"
                >
                  <RefreshCw className="h-4 w-4" aria-hidden="true" />
                  <span>Retry Verification</span>
                </button>
              </div>
            </div>
          </section>
        ) : result ? (
          <section
            aria-label="Ticket verification verdict"
            className={`border p-6 shadow-2xl sm:p-8 ${
              isValidTicket
                ? 'border-[#C8F36B]/70 bg-[#071109] shadow-[0_0_40px_rgba(200,243,107,0.14)]'
                : isRevokedOrUnverified
                ? 'border-[#FF6D00]/70 bg-[#140A05] shadow-[0_0_40px_rgba(255,109,0,0.12)]'
                : 'border-[#FF1744]/70 bg-[#14060A] shadow-[0_0_40px_rgba(255,23,68,0.14)]'
            }`}
          >
            {/* Primary Verdict Banner */}
            <div className="flex flex-col gap-4 border-b border-[#EAE7E0]/15 pb-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3.5">
                {isValidTicket ? (
                  <CheckCircle2
                    className="mt-0.5 h-10 w-10 shrink-0 text-[#C8F36B]"
                    aria-hidden="true"
                  />
                ) : isRevokedOrUnverified ? (
                  <ShieldAlert
                    className="mt-0.5 h-10 w-10 shrink-0 text-[#FF6D00]"
                    aria-hidden="true"
                  />
                ) : (
                  <XCircle
                    className="mt-0.5 h-10 w-10 shrink-0 text-[#FF1744]"
                    aria-hidden="true"
                  />
                )}

                <div>
                  <span
                    className={`inline-block border px-2.5 py-0.5 font-mono-num text-[11px] font-bold tracking-[0.2em] uppercase ${
                      isValidTicket
                        ? 'border-[#C8F36B]/60 bg-[#0D1A0E] text-[#C8F36B]'
                        : isRevokedOrUnverified
                        ? 'border-[#FF6D00]/60 bg-[#1E1007] text-[#FF6D00]'
                        : 'border-[#FF1744]/60 bg-[#1F070D] text-[#FF1744]'
                    }`}
                  >
                    {isValidTicket
                      ? 'VALID TICKET'
                      : isRevokedOrUnverified
                      ? 'REVOKED / NOT VALID'
                      : 'INVALID TICKET'}
                  </span>

                  <h2 className="mt-2 font-display text-3xl font-black tracking-tight text-[#EAE7E0] uppercase sm:text-4xl">
                    {result.statusLabel}
                  </h2>
                  <p className="mt-1.5 text-sm leading-relaxed text-[#EAE7E0]/85">
                    {result.message}
                  </p>
                </div>
              </div>
            </div>

            {/* Safe Public Entry Details */}
            <dl className="mt-6 grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
              <div className="border border-[#EAE7E0]/12 bg-[#050505]/70 p-3.5">
                <dt className="flex items-center gap-1.5 font-mono-num text-[10px] tracking-[0.18em] text-[#EAE7E0]/55 uppercase">
                  <Ticket className="h-3.5 w-3.5 text-[#00E5FF]" aria-hidden="true" />
                  Ticket ID
                </dt>
                <dd className="mt-1 font-mono-num text-base font-bold text-[#EAE7E0]">
                  {result.ticketId}
                </dd>
              </div>

              {result.registrationCode && (
                <div className="border border-[#EAE7E0]/12 bg-[#050505]/70 p-3.5">
                  <dt className="flex items-center gap-1.5 font-mono-num text-[10px] tracking-[0.18em] text-[#EAE7E0]/55 uppercase">
                    <QrCode className="h-3.5 w-3.5 text-[#00E5FF]" aria-hidden="true" />
                    Registration Code
                  </dt>
                  <dd className="mt-1 font-mono-num text-base font-bold text-[#EAE7E0]">
                    {result.registrationCode}
                  </dd>
                </div>
              )}

              {result.participantOrTeamName && (
                <div className="border border-[#EAE7E0]/12 bg-[#050505]/70 p-3.5">
                  <dt className="font-mono-num text-[10px] tracking-[0.18em] text-[#EAE7E0]/55 uppercase">
                    Participant / Team Name
                  </dt>
                  <dd className="mt-1 font-display text-2xl font-black tracking-tight text-[#EAE7E0] uppercase">
                    {result.participantOrTeamName}
                  </dd>
                </div>
              )}

              {result.passCategoryLabel && (
                <div className="border border-[#EAE7E0]/12 bg-[#050505]/70 p-3.5">
                  <dt className="font-mono-num text-[10px] tracking-[0.18em] text-[#EAE7E0]/55 uppercase">
                    Pass Tier &amp; Category
                  </dt>
                  <dd className="mt-1 font-semibold text-[#EAE7E0]">
                    {result.passCategoryLabel} · {result.categoriesDisplay || 'General'}
                  </dd>
                </div>
              )}

              {typeof result.participantCount === 'number' && result.participantCount > 0 && (
                <div className="border border-[#EAE7E0]/12 bg-[#050505]/70 p-3.5">
                  <dt className="flex items-center gap-1.5 font-mono-num text-[10px] tracking-[0.18em] text-[#EAE7E0]/55 uppercase">
                    <Users className="h-3.5 w-3.5 text-[#C8F36B]" aria-hidden="true" />
                    Admitted Count
                  </dt>
                  <dd className="mt-1 font-mono-num font-bold text-[#EAE7E0]">
                    {result.participantCount} Member(s)
                  </dd>
                </div>
              )}

              {isValidTicket && (
                <div className="border border-[#EAE7E0]/12 bg-[#050505]/70 p-3.5">
                  <dt className="flex items-center gap-1.5 font-mono-num text-[10px] tracking-[0.18em] text-[#EAE7E0]/55 uppercase">
                    <ShieldCheck className="h-3.5 w-3.5 text-[#C8F36B]" aria-hidden="true" />
                    Payment &amp; Verification
                  </dt>
                  <dd className="mt-1 font-mono-num font-bold text-[#C8F36B]">
                    Confirmed ({formatVerifiedTimestamp(result.verifiedAt)})
                  </dd>
                </div>
              )}
            </dl>

            {/* Event Context Footer */}
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-[#EAE7E0]/12 pt-5 text-xs text-[#EAE7E0]/70">
              <div className="flex flex-wrap items-center gap-4">
                <span className="inline-flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-[#FF1744]" aria-hidden="true" />
                  {result.eventDate}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-[#00E5FF]" aria-hidden="true" />
                  {result.venue}
                </span>
              </div>
            </div>
          </section>
        ) : null}

        {/* Non-blocking portal footer navigation */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-xs text-[#EAE7E0]/60">
          <p>Public pass verification powered by ALFAAZ server signature validation.</p>
          <button
            type="button"
            onClick={onNavigateMyTickets}
            className="cursor-pointer font-mono-num text-xs font-semibold text-[#C8F36B] underline underline-offset-4 hover:text-[#EAE7E0]"
          >
            Participant? Open My Tickets Portal →
          </button>
        </div>
      </main>
    </div>
  );
}
