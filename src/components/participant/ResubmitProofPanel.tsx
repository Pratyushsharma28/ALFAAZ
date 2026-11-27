import { ChangeEvent, useRef, useState } from 'react';
import {
  AlertTriangle,
  FileText,
  ImageIcon,
  Loader2,
  QrCode,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Upload,
} from 'lucide-react';
import {
  ALLOWED_PROOF_EXTENSIONS,
  validatePaymentProofFile,
  validateUtr,
} from '../../types/registration';
import {
  ParticipantApiError,
  resubmitRejectedProofWithProgress,
} from '../../services/participantApi';
import type { ParticipantRegistrationItem } from '../../types/participant';

const OFFICIAL_ALFAAZ_QR_URL =
  '/assets/aistudio/WhatsApp_Image_2026-11-27_at_16.07.15_8695a728.jpeg';

interface ResubmitProofPanelProps {
  registration: ParticipantRegistrationItem;
  onResubmitted: () => Promise<void> | void;
}

export function ResubmitProofPanel({
  registration,
  onResubmitted,
}: ResubmitProofPanelProps) {
  const [isOpen, setIsOpen] = useState(registration.paymentStatus === 'rejected');
  const [utr, setUtr] = useState('');
  const [utrError, setUtrError] = useState<string | null>(null);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!registration.canResubmitProof || registration.paymentStatus === 'verified') {
    return null;
  }

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setProofFile(file);
    setFileError(file ? validatePaymentProofFile(file) : null);
    setServerError(null);
    e.target.value = '';
  };

  const handleSubmit = async () => {
    if (submitting) return;
    const nextUtrErr = validateUtr(utr);
    const nextFileErr = validatePaymentProofFile(proofFile);
    setUtrError(nextUtrErr);
    setFileError(nextFileErr);
    setServerError(null);

    if (nextUtrErr || nextFileErr || !proofFile) return;

    setSubmitting(true);
    setUploadProgress(0);

    try {
      const res = await resubmitRejectedProofWithProgress({
        registrationId: registration.registrationId,
        utr: utr.trim(),
        proofFile,
        onProgress: (pct) => setUploadProgress(pct),
      });
      setSuccessMsg(res.message);
      setUtr('');
      setProofFile(null);
      await onResubmitted();
    } catch (err) {
      setUploadProgress(0);
      setServerError(
        err instanceof ParticipantApiError
          ? err.message
          : 'Unable to submit updated payment proof right now.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const isRejected = registration.paymentStatus === 'rejected';

  return (
    <div
      className={`mt-5 border p-4 sm:p-5 ${
        isRejected
          ? 'border-[#FF1744]/55 bg-[#12060A]'
          : 'border-[#00E5FF]/35 bg-[#060B0E]'
      }`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-2.5">
          <AlertTriangle
            className={`mt-0.5 h-5 w-5 shrink-0 ${
              isRejected ? 'text-[#FF1744]' : 'text-[#00E5FF]'
            }`}
            aria-hidden="true"
          />
          <div>
            <p
              className={`font-mono-num text-xs font-bold tracking-[0.18em] uppercase ${
                isRejected ? 'text-[#FF1744]' : 'text-[#00E5FF]'
              }`}
            >
              {isRejected
                ? 'Rejected — Action Required'
                : 'Payment Proof Pending Submission'}
            </p>
            {isRejected && registration.rejectionReason && (
              <p className="mt-1 text-sm leading-relaxed text-[#EAE7E0]/90">
                <span className="font-semibold text-[#EAE7E0]">Organizer note:</span>{' '}
                {registration.rejectionReason}
              </p>
            )}
            {!isRejected && (
              <p className="mt-1 text-xs text-[#EAE7E0]/75">
                Complete your UPI payment of ₹{registration.amountPayableInr} and submit your
                UTR and payment proof for organizer verification.
              </p>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className="inline-flex min-h-[38px] shrink-0 cursor-pointer items-center gap-1.5 border border-[#EAE7E0]/25 bg-[#050505] px-3.5 py-1.5 font-mono-num text-[11px] font-semibold tracking-wider text-[#EAE7E0] uppercase transition-colors hover:border-[#FF1744] hover:text-[#FF1744]"
        >
          {isOpen ? 'Hide Upload Form' : isRejected ? 'Resubmit Payment Proof' : 'Upload Payment Proof'}
        </button>
      </div>

      {successMsg && (
        <p className="mt-3 border border-[#C8F36B]/45 bg-[#09120A] px-3.5 py-2.5 text-xs text-[#C8F36B]">
          {successMsg}
        </p>
      )}

      {isOpen && (
        <div className="mt-4 grid grid-cols-1 gap-5 border-t border-[#EAE7E0]/12 pt-4 md:grid-cols-[200px_1fr]">
          {/* UPI QR */}
          <div className="flex flex-col items-center border border-[#EAE7E0]/15 bg-[#050505] p-3 text-center">
            <p className="inline-flex items-center gap-1 font-mono-num text-[10px] font-bold tracking-widest text-[#FF6D00] uppercase">
              <QrCode className="h-3.5 w-3.5" aria-hidden="true" />
              Pay ₹{registration.amountPayableInr} via UPI
            </p>
            <img
              src={OFFICIAL_ALFAAZ_QR_URL}
              alt="Official ALFAAZ UPI Payment QR Code"
              className="mt-2.5 aspect-square w-36 bg-white object-contain p-1"
            />
            <p className="mt-2 font-mono-num text-[10px] text-[#EAE7E0]/60">
              Scan &amp; pay ₹{registration.amountPayableInr}, then upload proof
            </p>
          </div>

          {/* UTR + Screenshot Form */}
          <div className="space-y-4">
            <div>
              <label
                htmlFor={`resubmit-utr-${registration.registrationId}`}
                className="block text-xs font-semibold text-[#EAE7E0]"
              >
                UPI Transaction ID / UTR <span className="text-[#FF1744]">*</span>
              </label>
              <input
                id={`resubmit-utr-${registration.registrationId}`}
                type="text"
                disabled={submitting}
                placeholder="e.g. 433189402512"
                value={utr}
                onChange={(e) => {
                  setUtr(e.target.value);
                  setUtrError(null);
                  setServerError(null);
                }}
                onBlur={() => {
                  if (utr.trim()) setUtrError(validateUtr(utr));
                }}
                className={`mt-1.5 min-h-[42px] w-full border bg-[#050505] px-3 py-2 font-mono-num text-sm text-[#EAE7E0] placeholder:text-[#EAE7E0]/35 focus:border-[#FF6D00] focus:outline-none ${
                  utrError ? 'border-[#FF1744]' : 'border-[#EAE7E0]/20'
                }`}
              />
              {utrError && (
                <p role="alert" className="mt-1 text-xs text-[#FF1744]">
                  {utrError}
                </p>
              )}
            </div>

            <div>
              <span className="block text-xs font-semibold text-[#EAE7E0]">
                Payment Screenshot / PDF Receipt <span className="text-[#FF1744]">*</span>
              </span>
              <input
                ref={fileInputRef}
                id={`resubmit-file-${registration.registrationId}`}
                type="file"
                disabled={submitting}
                accept={`${ALLOWED_PROOF_EXTENSIONS.join(',')},image/jpeg,image/png,application/pdf`}
                onChange={handleFileChange}
                className="sr-only"
              />

              {!proofFile ? (
                <label
                  htmlFor={`resubmit-file-${registration.registrationId}`}
                  className="mt-1.5 flex cursor-pointer flex-col items-center justify-center border border-dashed border-[#EAE7E0]/25 bg-[#050505] px-4 py-4 text-center transition-colors hover:border-[#FF6D00]"
                >
                  <Upload className="h-5 w-5 text-[#FF6D00]" aria-hidden="true" />
                  <p className="mt-1.5 text-xs font-semibold text-[#EAE7E0]">
                    Select payment screenshot or PDF receipt (max 10 MB)
                  </p>
                </label>
              ) : (
                <div className="mt-1.5 flex flex-wrap items-center justify-between gap-3 border border-[#EAE7E0]/20 bg-[#050505] p-3">
                  <div className="flex min-w-0 items-center gap-2.5">
                    {proofFile.type === 'application/pdf' ? (
                      <FileText className="h-5 w-5 shrink-0 text-[#FF6D00]" aria-hidden="true" />
                    ) : (
                      <ImageIcon className="h-5 w-5 shrink-0 text-[#C8F36B]" aria-hidden="true" />
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-[#EAE7E0]">
                        {proofFile.name}
                      </p>
                      <p className="font-mono-num text-[11px] text-[#C8F36B]">
                        {(proofFile.size / 1024).toFixed(0)} KB
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex min-h-[34px] cursor-pointer items-center gap-1 border border-[#EAE7E0]/25 px-2.5 font-mono-num text-[11px] text-[#EAE7E0] uppercase hover:border-[#FF6D00]"
                    >
                      <RefreshCw className="h-3 w-3" aria-hidden="true" />
                      Replace
                    </button>
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => {
                        setProofFile(null);
                        setFileError(null);
                      }}
                      className="inline-flex min-h-[34px] cursor-pointer items-center gap-1 border border-[#FF1744]/40 px-2.5 font-mono-num text-[11px] text-[#FF1744] uppercase hover:bg-[#FF1744] hover:text-[#EAE7E0]"
                    >
                      <Trash2 className="h-3 w-3" aria-hidden="true" />
                      Remove
                    </button>
                  </div>
                </div>
              )}

              {fileError && (
                <p role="alert" className="mt-1 text-xs text-[#FF1744]">
                  {fileError}
                </p>
              )}
            </div>

            {submitting && (
              <div className="border border-[#EAE7E0]/15 bg-[#050505] p-2.5">
                <div className="flex justify-between font-mono-num text-[11px] text-[#EAE7E0]/80">
                  <span>Uploading updated proof...</span>
                  <span className="text-[#C8F36B]">{uploadProgress}%</span>
                </div>
                <div className="mt-1.5 h-1.5 w-full bg-[#EAE7E0]/10">
                  <div
                    className="h-full bg-gradient-to-r from-[#FF1744] to-[#C8F36B] transition-all"
                    style={{ width: `${Math.max(uploadProgress, 10)}%` }}
                  />
                </div>
              </div>
            )}

            {serverError && (
              <p role="alert" className="border border-[#FF1744]/50 bg-[#15060A] px-3 py-2 text-xs text-[#FF1744]">
                {serverError}
              </p>
            )}

            <button
              type="button"
              disabled={submitting}
              onClick={handleSubmit}
              className="inline-flex min-h-[42px] cursor-pointer items-center gap-2 border border-[#FF1744] bg-[#FF1744] px-5 py-2 font-display text-base font-extrabold tracking-wider text-[#EAE7E0] uppercase transition-colors hover:bg-[#ff2b54] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  <span>Uploading Proof...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                  <span>Submit New Payment Proof</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
