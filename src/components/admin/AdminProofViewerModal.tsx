import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  FileText,
  Maximize2,
  Minimize2,
  RefreshCw,
  ShieldCheck,
  X,
  XCircle,
} from 'lucide-react';
import {
  getSignedPaymentProofUrl,
  updatePaymentVerificationStatus,
} from '../../services/adminApi';
import { AdminPaymentSubmissionRecord } from '../../types/admin';
import { EDITORIAL_EASE } from '../MotionPrimitives';
import {
  ENTRY_TYPE_META,
  formatDateTime,
  formatInr,
  PAYMENT_STATUS_META,
  REGISTRATION_TYPE_META,
} from './AdminFormatters';

interface AdminProofViewerModalProps {
  submission: AdminPaymentSubmissionRecord | null;
  onClose: () => void;
  onVerificationSaved: (warning?: string) => Promise<void>;
}

function isPdfProof(submission: AdminPaymentSubmissionRecord, signedUrl: string | null): boolean {
  const mime = submission.proofMimeType.toLowerCase();
  if (mime.includes('pdf')) return true;
  const pathLower = submission.proofPath.toLowerCase();
  const fileLower = submission.proofFileName.toLowerCase();
  if (pathLower.endsWith('.pdf') || fileLower.endsWith('.pdf')) return true;
  if (signedUrl) {
    try {
      const urlPath = new URL(signedUrl).pathname.toLowerCase();
      if (urlPath.endsWith('.pdf')) return true;
    } catch {
      // Ignore parse error
    }
  }
  return false;
}

export function AdminProofViewerModal({
  submission,
  onClose,
  onVerificationSaved,
}: AdminProofViewerModalProps) {
  const shouldReduceMotion = useReducedMotion();
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loadingProof, setLoadingProof] = useState(false);
  const [proofError, setProofError] = useState<string | null>(null);
  const [zoomed, setZoomed] = useState(false);

  const [remarks, setRemarks] = useState('');
  const [savingDecision, setSavingDecision] = useState<'verified' | 'rejected' | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const loadSignedUrl = useCallback(async (proofPath: string) => {
    if (!proofPath) {
      setSignedUrl(null);
      setProofError('No payment proof file path was recorded for this submission.');
      return;
    }

    setLoadingProof(true);
    setProofError(null);
    try {
      const url = await getSignedPaymentProofUrl(proofPath);
      setSignedUrl(url);
    } catch (err) {
      setSignedUrl(null);
      setProofError(
        err instanceof Error
          ? err.message
          : 'Unable to load payment proof from private storage.'
      );
    } finally {
      setLoadingProof(false);
    }
  }, []);

  useEffect(() => {
    if (!submission) return;
    setRemarks(submission.adminRemarks ?? '');
    setSaveError(null);
    setZoomed(false);
    void loadSignedUrl(submission.proofPath);
  }, [submission, loadSignedUrl]);

  useEffect(() => {
    if (!submission) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !savingDecision) {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [submission, savingDecision, onClose]);

  const handleDecision = async (decision: 'verified' | 'rejected') => {
    if (!submission || savingDecision) return;

    if (decision === 'rejected' && !remarks.trim()) {
      setSaveError('Please enter an admin remark explaining why this payment is being rejected.');
      return;
    }

    setSavingDecision(decision);
    setSaveError(null);
    try {
      const outcome = await updatePaymentVerificationStatus({
        submission,
        decision,
        remarks,
      });
      await onVerificationSaved(outcome.warning);
      onClose();
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : 'Unable to save payment verification status.'
      );
    } finally {
      setSavingDecision(null);
    }
  };

  const pdfMode = submission ? isPdfProof(submission, signedUrl) : false;

  return (
    <AnimatePresence>
      {submission && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="proof-modal-title"
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => {
              if (!savingDecision) onClose();
            }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm"
          />

          <motion.div
            initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.98 }}
            transition={shouldReduceMotion ? { duration: 0.01 } : { duration: 0.24, ease: EDITORIAL_EASE }}
            className="relative z-10 flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden border border-[#EAE7E0]/20 bg-[#0B0B0D] text-[#EAE7E0] shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between gap-4 border-b border-[#EAE7E0]/12 px-5 py-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`border px-2 py-0.5 font-mono-num text-[10px] font-bold uppercase ${
                      REGISTRATION_TYPE_META[submission.registrationType].borderClass
                    }`}
                  >
                    {REGISTRATION_TYPE_META[submission.registrationType].label}
                  </span>
                  <p className="font-mono-num text-[11px] tracking-widest text-[#EAE7E0]/55 uppercase">
                    Payment Verification Review · {submission.registrationCode || submission.id}
                  </p>
                </div>
                <h2
                  id="proof-modal-title"
                  className="mt-1.5 truncate font-display text-2xl font-black tracking-tight text-[#EAE7E0] uppercase"
                >
                  {submission.participantName}
                  {submission.registrationType !== 'AUDIENCE' &&
                  submission.teamOrIndividualName &&
                  submission.teamOrIndividualName !== '—'
                    ? ` · ${submission.teamOrIndividualName}`
                    : ''}
                </h2>
              </div>

              <button
                type="button"
                onClick={onClose}
                disabled={Boolean(savingDecision)}
                aria-label="Close payment proof review"
                className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center border border-[#EAE7E0]/20 text-[#EAE7E0]/75 transition-colors hover:border-[#FF1744] hover:text-[#FF1744] disabled:opacity-50"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            {/* Body */}
            <div className="grid flex-1 grid-cols-1 overflow-y-auto lg:grid-cols-[1.25fr_1fr]">
              {/* Left: Private Storage Signed URL Viewer */}
              <div className="flex flex-col border-b border-[#EAE7E0]/12 bg-[#050505] p-5 lg:border-r lg:border-b-0">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-[#EAE7E0]">
                      Private Storage Proof (`payment-proofs`)
                    </p>
                    <p className="truncate font-mono-num text-[11px] text-[#EAE7E0]/55">
                      {submission.proofFileName}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {signedUrl && !pdfMode && (
                      <button
                        type="button"
                        onClick={() => setZoomed((z) => !z)}
                        className="inline-flex min-h-[34px] cursor-pointer items-center gap-1.5 border border-[#EAE7E0]/20 bg-[#0B0B0D] px-2.5 py-1 text-xs text-[#EAE7E0]/85 transition-colors hover:border-[#EAE7E0]/45"
                      >
                        {zoomed ? (
                          <Minimize2 className="h-3.5 w-3.5" aria-hidden="true" />
                        ) : (
                          <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" />
                        )}
                        <span>{zoomed ? 'Fit' : 'Zoom'}</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => void loadSignedUrl(submission.proofPath)}
                      disabled={loadingProof}
                      className="inline-flex min-h-[34px] cursor-pointer items-center gap-1.5 border border-[#EAE7E0]/20 bg-[#0B0B0D] px-2.5 py-1 text-xs text-[#EAE7E0]/85 transition-colors hover:border-[#00E5FF] hover:text-[#00E5FF] disabled:opacity-50"
                    >
                      <RefreshCw
                        className={`h-3.5 w-3.5 ${loadingProof ? 'animate-spin' : ''}`}
                        aria-hidden="true"
                      />
                      <span>Refresh URL</span>
                    </button>

                    {signedUrl && (
                      <a
                        href={signedUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex min-h-[34px] items-center gap-1.5 border border-[#00E5FF]/40 bg-[#00E5FF]/10 px-2.5 py-1 text-xs font-medium text-[#00E5FF] transition-colors hover:bg-[#00E5FF]/20"
                      >
                        <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Open</span>
                      </a>
                    )}
                  </div>
                </div>

                <div className="relative flex min-h-[320px] flex-1 items-center justify-center overflow-auto border border-[#EAE7E0]/12 bg-[#08080A]">
                  {loadingProof ? (
                    <div className="flex flex-col items-center gap-2 p-6 text-xs text-[#EAE7E0]/65">
                      <RefreshCw className="h-5 w-5 animate-spin text-[#00E5FF]" aria-hidden="true" />
                      <span>Generating short-lived signed URL...</span>
                    </div>
                  ) : proofError ? (
                    <div className="max-w-md p-6 text-center">
                      <AlertTriangle
                        className="mx-auto h-6 w-6 text-[#FF1744]"
                        aria-hidden="true"
                      />
                      <p className="mt-2 text-xs leading-relaxed text-[#EAE7E0]/80">{proofError}</p>
                      <button
                        type="button"
                        onClick={() => void loadSignedUrl(submission.proofPath)}
                        className="mt-4 inline-flex min-h-[36px] cursor-pointer items-center gap-1.5 border border-[#EAE7E0]/25 px-3 py-1.5 text-xs font-medium text-[#EAE7E0] hover:border-[#FF1744]"
                      >
                        Retry Signed URL
                      </button>
                    </div>
                  ) : signedUrl && pdfMode ? (
                    <div className="flex h-[460px] w-full flex-col">
                      <iframe
                        src={signedUrl}
                        title={`Payment proof PDF for ${submission.participantName}`}
                        className="h-full w-full flex-1 bg-white"
                      />
                      <div className="flex items-center justify-between border-t border-[#EAE7E0]/12 bg-[#0B0B0D] px-3 py-2 text-xs text-[#EAE7E0]/70">
                        <span className="inline-flex items-center gap-1.5">
                          <FileText className="h-3.5 w-3.5 text-[#00E5FF]" aria-hidden="true" />
                          PDF Receipt (5-min signed link)
                        </span>
                        <a
                          href={signedUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-[#00E5FF] underline hover:text-[#EAE7E0]"
                        >
                          Open PDF in new tab
                        </a>
                      </div>
                    </div>
                  ) : signedUrl ? (
                    <img
                      src={signedUrl}
                      alt={`Payment proof uploaded by ${submission.participantName}`}
                      referrerPolicy="no-referrer"
                      onError={() =>
                        setProofError(
                          'Image failed to render or signed URL expired. Click Refresh URL to generate a new signed link.'
                        )
                      }
                      className={
                        zoomed
                          ? 'max-w-none cursor-zoom-out object-contain p-2'
                          : 'max-h-[460px] w-auto max-w-full cursor-zoom-in object-contain p-2'
                      }
                      onClick={() => setZoomed((z) => !z)}
                    />
                  ) : null}
                </div>

                <p className="mt-2.5 text-[11px] text-[#EAE7E0]/50">
                  Signed URLs expire automatically after 5 minutes. An uploaded file never confirms
                  payment until an authorized admin verifies the UTR against bank records.
                </p>
              </div>

              {/* Right: Submission Metadata & Verification Decision */}
              <div className="flex flex-col justify-between p-5">
                <div className="space-y-5">
                  <div className="flex items-center justify-between gap-3 border-b border-[#EAE7E0]/12 pb-4">
                    <div>
                      <p className="text-xs text-[#EAE7E0]/55">Verification Status</p>
                      <span
                        className={`mt-1.5 inline-flex items-center gap-1.5 border px-2.5 py-1 text-xs font-semibold ${PAYMENT_STATUS_META[submission.status].borderClass} ${PAYMENT_STATUS_META[submission.status].textClass}`}
                      >
                        {submission.status === 'verified' ? (
                          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                        ) : submission.status === 'rejected' ? (
                          <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
                        ) : (
                          <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                        )}
                        {PAYMENT_STATUS_META[submission.status].label}
                      </span>
                    </div>

                    <div className="text-right">
                      <p className="text-xs text-[#EAE7E0]/55">Fee Amount</p>
                      <p className="mt-1 font-mono-num text-2xl font-bold text-[#EAE7E0]">
                        {formatInr(submission.amountInr)}
                      </p>
                    </div>
                  </div>

                  <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
                    <div>
                      <dt className="text-[#EAE7E0]/55">UTR / Transaction ID</dt>
                      <dd className="mt-0.5 font-mono-num font-semibold text-[#C8F36B] break-all">
                        {submission.utr}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[#EAE7E0]/55">Registration Type</dt>
                      <dd
                        className={`mt-0.5 font-semibold ${
                          REGISTRATION_TYPE_META[submission.registrationType].accentClass
                        }`}
                      >
                        {submission.registrationType === 'AUDIENCE'
                          ? 'Audience Pass (Watch Only)'
                          : `Participant · ${ENTRY_TYPE_META[submission.entryType].label}`}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[#EAE7E0]/55">Email</dt>
                      <dd className="mt-0.5 text-[#EAE7E0] break-all">{submission.email}</dd>
                    </div>
                    <div>
                      <dt className="text-[#EAE7E0]/55">Mobile</dt>
                      <dd className="mt-0.5 font-mono-num text-[#EAE7E0]">{submission.mobileNumber}</dd>
                    </div>
                    <div className="col-span-2">
                      <dt className="text-[#EAE7E0]/55">College</dt>
                      <dd className="mt-0.5 text-[#EAE7E0]">{submission.collegeName}</dd>
                    </div>
                    <div className="col-span-2">
                      <dt className="text-[#EAE7E0]/55">Submitted Date</dt>
                      <dd className="mt-0.5 font-mono-num text-[#EAE7E0]">
                        {formatDateTime(submission.submittedAt)}
                      </dd>
                    </div>
                    {submission.verifiedAt && (
                      <div className="col-span-2 border-t border-[#EAE7E0]/10 pt-2.5">
                        <dt className="text-[#EAE7E0]/55">Last Reviewed</dt>
                        <dd className="mt-0.5 font-mono-num text-[#EAE7E0]/85">
                          {formatDateTime(submission.verifiedAt)}
                          {submission.verifiedBy ? ` · By ${submission.verifiedBy}` : ''}
                        </dd>
                      </div>
                    )}
                  </dl>

                  <div>
                    <label
                      htmlFor="admin-verification-remarks"
                      className="block text-xs font-semibold tracking-wider text-[#EAE7E0]/80 uppercase"
                    >
                      Admin Remarks {submission.status === 'rejected' ? '' : '(Required for rejection)'}
                    </label>
                    <textarea
                      id="admin-verification-remarks"
                      rows={3}
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                      placeholder="Add verification note, bank match reference, or rejection reason..."
                      className="mt-1.5 w-full resize-y border border-[#EAE7E0]/20 bg-[#050505] p-3 text-xs text-[#EAE7E0] placeholder-[#EAE7E0]/35 focus:border-[#00E5FF] focus:outline-none"
                    />
                  </div>

                  {saveError && (
                    <div
                      role="alert"
                      className="flex items-start gap-2 border border-[#FF1744]/45 bg-[#FF1744]/10 p-3 text-xs text-[#EAE7E0]"
                    >
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#FF1744]" aria-hidden="true" />
                      <span>{saveError}</span>
                    </div>
                  )}
                </div>

                <div className="mt-6 grid grid-cols-1 gap-2.5 border-t border-[#EAE7E0]/12 pt-4 sm:grid-cols-2">
                  <button
                    type="button"
                    disabled={Boolean(savingDecision)}
                    onClick={() => void handleDecision('verified')}
                    className="inline-flex min-h-[42px] cursor-pointer items-center justify-center gap-2 border border-[#C8F36B]/70 bg-[#C8F36B]/15 px-4 py-2 text-xs font-bold tracking-wider text-[#C8F36B] uppercase transition-colors hover:bg-[#C8F36B] hover:text-[#050505] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                    <span>{savingDecision === 'verified' ? 'Verifying...' : 'Mark Verified'}</span>
                  </button>

                  <button
                    type="button"
                    disabled={Boolean(savingDecision)}
                    onClick={() => void handleDecision('rejected')}
                    className="inline-flex min-h-[42px] cursor-pointer items-center justify-center gap-2 border border-[#FF1744]/70 bg-[#FF1744]/15 px-4 py-2 text-xs font-bold tracking-wider text-[#FF1744] uppercase transition-colors hover:bg-[#FF1744] hover:text-[#EAE7E0] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <XCircle className="h-4 w-4" aria-hidden="true" />
                    <span>{savingDecision === 'rejected' ? 'Rejecting...' : 'Reject Payment'}</span>
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
