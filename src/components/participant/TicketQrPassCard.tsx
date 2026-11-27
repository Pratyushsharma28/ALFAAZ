import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import {
  CheckCircle2,
  Download,
  ExternalLink,
  Loader2,
  QrCode,
  ShieldCheck,
} from 'lucide-react';
import {
  downloadConfirmedTicketPdf,
  ParticipantApiError,
} from '../../services/participantApi';
import type { ParticipantRegistrationItem } from '../../types/participant';

interface TicketQrPassCardProps {
  registration: ParticipantRegistrationItem;
  onInspectQrVerification?: (url: string) => void;
}

export function TicketQrPassCard({
  registration,
  onInspectQrVerification,
}: TicketQrPassCardProps) {
  const ticket = registration.ticket;
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  useEffect(() => {
    if (!ticket || registration.paymentStatus !== 'verified') {
      setQrDataUrl('');
      return;
    }

    let cancelled = false;
    QRCode.toDataURL(ticket.qrVerificationUrl, {
      width: 320,
      margin: 2,
      color: {
        dark: '#050505',
        light: '#FFFFFF',
      },
      errorCorrectionLevel: 'M',
    })
      .then((dataUrl) => {
        if (!cancelled) setQrDataUrl(dataUrl);
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl('');
      });

    return () => {
      cancelled = true;
    };
  }, [ticket, registration.paymentStatus]);

  // Strict safeguard: never render a confirmed ticket or QR code unless admin-verified
  if (registration.paymentStatus !== 'verified' || !ticket) {
    return null;
  }

  const handleDownloadPdf = async () => {
    if (downloading) return;
    setDownloading(true);
    setDownloadError(null);
    try {
      await downloadConfirmedTicketPdf({
        registrationId: registration.registrationId,
        fallbackCode: registration.registrationCode,
      });
    } catch (err) {
      setDownloadError(
        err instanceof ParticipantApiError
          ? err.message
          : 'Unable to download your PDF ticket right now. Please try again.'
      );
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="mt-6 border border-[#C8F36B]/55 bg-[#070E08] p-5 shadow-[0_0_28px_rgba(200,243,107,0.12)] sm:p-6">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        {/* Left Ticket Body */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="inline-flex items-center gap-1.5 border border-[#C8F36B]/60 bg-[#0D1A0E] px-2.5 py-1 font-mono-num text-[11px] font-bold tracking-[0.18em] text-[#C8F36B] uppercase">
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
              Confirmed Official Pass
            </span>
            <span className="font-mono-num text-xs text-[#EAE7E0]/70">
              Ticket ID:{' '}
              <strong className="text-[#C8F36B]">{ticket.ticketId}</strong>
            </span>
          </div>

          <h4 className="mt-3 font-display text-3xl font-black tracking-tight text-[#EAE7E0] uppercase sm:text-4xl">
            {registration.teamOrIndividualName}
          </h4>
          <p className="mt-1 text-xs text-[#EAE7E0]/70">
            {registration.eventName} · {registration.eventDate} · {registration.venue}
          </p>

          <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 border-t border-[#EAE7E0]/12 pt-4 text-xs sm:grid-cols-4">
            <div>
              <dt className="font-mono-num text-[10px] tracking-widest text-[#EAE7E0]/50 uppercase">
                Registration Code
              </dt>
              <dd className="mt-0.5 font-mono-num font-bold text-[#EAE7E0]">
                {registration.registrationCode}
              </dd>
            </div>
            <div>
              <dt className="font-mono-num text-[10px] tracking-widest text-[#EAE7E0]/50 uppercase">
                Pass &amp; Category
              </dt>
              <dd className="mt-0.5 font-semibold text-[#EAE7E0]">
                {registration.passCategoryLabel} · {registration.categoriesDisplay}
              </dd>
            </div>
            <div>
              <dt className="font-mono-num text-[10px] tracking-widest text-[#EAE7E0]/50 uppercase">
                Participants
              </dt>
              <dd className="mt-0.5 font-mono-num font-semibold text-[#EAE7E0]">
                {registration.participantCount} Member(s)
              </dd>
            </div>
            <div>
              <dt className="font-mono-num text-[10px] tracking-widest text-[#EAE7E0]/50 uppercase">
                Status
              </dt>
              <dd className="mt-0.5 inline-flex items-center gap-1 font-mono-num font-bold text-[#C8F36B]">
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                Verified (₹{registration.amountPaidInr ?? registration.amountPayableInr})
              </dd>
            </div>
          </dl>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={downloading}
              onClick={handleDownloadPdf}
              className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 border border-[#C8F36B] bg-[#C8F36B] px-5 py-2.5 font-display text-lg font-extrabold tracking-wider text-[#050505] uppercase transition-colors hover:bg-[#d7f98d] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {downloading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  <span>Generating PDF...</span>
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" aria-hidden="true" />
                  <span>Download Ticket (PDF)</span>
                </>
              )}
            </button>

            {onInspectQrVerification && (
              <button
                type="button"
                onClick={() => onInspectQrVerification(ticket.qrVerificationUrl)}
                className="inline-flex min-h-[44px] cursor-pointer items-center gap-1.5 border border-[#EAE7E0]/25 bg-[#050505] px-4 py-2.5 font-mono-num text-xs font-semibold tracking-wider text-[#EAE7E0]/85 uppercase transition-colors hover:border-[#00E5FF] hover:text-[#00E5FF]"
              >
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Verify QR Live</span>
              </button>
            )}
          </div>

          {downloadError && (
            <p role="alert" className="mt-3 text-xs font-medium text-[#FF1744]">
              {downloadError}
            </p>
          )}
        </div>

        {/* Right Signed Gate QR Pass Stub */}
        <div className="flex shrink-0 flex-col items-center border border-[#EAE7E0]/15 bg-[#050505] p-4">
          {qrDataUrl ? (
            <img
              src={qrDataUrl}
              alt={`Verified QR code for Ticket ${ticket.ticketId}`}
              className="h-32 w-32 bg-white p-1.5"
            />
          ) : (
            <div className="flex h-32 w-32 items-center justify-center bg-[#0B0B0E] text-[#EAE7E0]/45">
              <QrCode className="h-10 w-10" aria-hidden="true" />
            </div>
          )}
          <p className="mt-2 font-mono-num text-[10px] font-bold tracking-[0.18em] text-[#C8F36B] uppercase">
            Scan at Entry Gate
          </p>
          <p className="mt-0.5 font-mono-num text-[10px] text-[#EAE7E0]/60">
            {ticket.ticketId}
          </p>
        </div>
      </div>
    </div>
  );
}
