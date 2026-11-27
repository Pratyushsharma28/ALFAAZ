import { ChangeEvent, FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock,
  Edit3,
  Eye,
  FileText,
  ImageIcon,
  Loader2,
  Lock,
  QrCode,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Upload,
  X,
  XCircle,
} from 'lucide-react';
import { EDITORIAL_EASE } from './MotionPrimitives';
import {
  ALLOWED_PROOF_EXTENSIONS,
  AUDIENCE_PASS_FEE_INR,
  AUDIENCE_PASS_OPTION,
  AudienceRegistrationFieldErrors,
  AudienceRegistrationFormData,
  BackendPaymentProofSubmissionResult,
  BackendPaymentVerificationResult,
  BackendRegistrationResult,
  PaymentFlowStatus,
  validateAudienceRegistrationDetails,
  validatePaymentProofFile,
  validateUtr,
} from '../types/registration';
import {
  checkPaymentStatus,
  RegistrationApiError,
  submitAudienceRegistration,
  submitPaymentProofWithProgress,
} from '../services/registrationApi';

const OFFICIAL_ALFAAZ_QR_URL =
  '/assets/aistudio/WhatsApp_Image_2026-11-27_at_16.07.15_8695a728.jpeg';

const AUDIENCE_PAYMENT_INSTRUCTIONS = [
  'Open any UPI app (Google Pay, PhonePe, Paytm, BHIM) and scan the official ALFAAZ QR code.',
  `Enter and pay exactly ₹${AUDIENCE_PASS_FEE_INR} for 1 Audience Pass (Watch Only).`,
  'Copy the 12-digit UTR / UPI Reference ID from your payment confirmation screen.',
  'Upload a clear screenshot or PDF receipt of the completed ₹59 transaction below.',
  'An ALFAAZ organizer verifies your UTR & proof before issuing your Audience Pass QR ticket.',
];

export interface AudienceRegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSwitchToParticipant?: () => void;
}

function createInitialAudienceFormData(): AudienceRegistrationFormData {
  return {
    fullName: '',
    email: '',
    mobileNumber: '',
    collegeName: '',
    city: '',
    acknowledgedWatchOnly: false,
  };
}

function generateIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `alfaaz_aud_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function AudienceRegistrationModal({
  isOpen,
  onClose,
  onSwitchToParticipant,
}: AudienceRegistrationModalProps) {
  const shouldReduceMotion = useReducedMotion();
  const [step, setStep] = useState<1 | 2>(1);
  const [formData, setFormData] = useState<AudienceRegistrationFormData>(
    createInitialAudienceFormData
  );
  const [fieldErrors, setFieldErrors] = useState<AudienceRegistrationFieldErrors>({});

  const [utr, setUtr] = useState('');
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreviewUrl, setProofPreviewUrl] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [paymentFormError, setPaymentFormError] = useState<string | null>(null);

  const [flowStatus, setFlowStatus] = useState<PaymentFlowStatus>('idle');
  const [flowError, setFlowError] = useState<string | null>(null);
  const [registrationRecord, setRegistrationRecord] = useState<BackendRegistrationResult | null>(
    null
  );
  const [proofSubmission, setProofSubmission] =
    useState<BackendPaymentProofSubmissionResult | null>(null);
  const [verificationResult, setVerificationResult] =
    useState<BackendPaymentVerificationResult | null>(null);

  const idempotencyKeyRef = useRef<string>(generateIdempotencyKey());
  const proofInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setStep(1);
    setFormData(createInitialAudienceFormData());
    setFieldErrors({});
    setUtr('');
    setProofFile(null);
    setUploadProgress(0);
    setPaymentFormError(null);
    setFlowStatus('idle');
    setFlowError(null);
    setRegistrationRecord(null);
    setProofSubmission(null);
    setVerificationResult(null);
    idempotencyKeyRef.current = generateIdempotencyKey();
  }, [isOpen]);

  useEffect(() => {
    if (!proofFile || !proofFile.type.startsWith('image/')) {
      setProofPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(proofFile);
    setProofPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [proofFile]);

  const isBusy =
    flowStatus === 'preparing_registration' || flowStatus === 'uploading_proof';

  const handleRequestClose = useCallback(() => {
    if (isBusy) return;
    onClose();
  }, [isBusy, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isBusy) {
        handleRequestClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen, isBusy, handleRequestClose]);

  const updateField = <K extends keyof AudienceRegistrationFormData>(
    key: K,
    value: AudienceRegistrationFormData[K]
  ) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const handleProceedToPayment = (event: FormEvent) => {
    event.preventDefault();
    const errors = validateAudienceRegistrationDetails(formData);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;
    setFlowStatus('upi_payment');
    setFlowError(null);
    setStep(2);
  };

  const handleProofFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    if (!file) return;
    const validationErr = validatePaymentProofFile(file);
    if (validationErr) {
      setPaymentFormError(validationErr);
      return;
    }
    setPaymentFormError(null);
    setProofFile(file);
  };

  const handlePaymentProofSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setPaymentFormError(null);
    setFlowError(null);

    const detailsErrors = validateAudienceRegistrationDetails(formData);
    if (Object.keys(detailsErrors).length > 0) {
      setFieldErrors(detailsErrors);
      setStep(1);
      return;
    }

    const utrError = validateUtr(utr);
    if (utrError) {
      setPaymentFormError(utrError);
      return;
    }

    const fileError = validatePaymentProofFile(proofFile);
    if (fileError || !proofFile) {
      setPaymentFormError(fileError || 'Please attach your UPI payment screenshot or PDF.');
      return;
    }

    try {
      let reg = registrationRecord;
      if (!reg) {
        setFlowStatus('preparing_registration');
        reg = await submitAudienceRegistration(formData, idempotencyKeyRef.current);
        setRegistrationRecord(reg);
      }

      setFlowStatus('uploading_proof');
      setUploadProgress(0);
      const proofResult = await submitPaymentProofWithProgress({
        registrationId: reg.registrationId,
        registrationType: 'AUDIENCE',
        entryType: 'individual',
        utr,
        proofFile,
        idempotencyKey: `${idempotencyKeyRef.current}_proof`,
        onProgress: (pct) => setUploadProgress(pct),
      });

      setProofSubmission(proofResult);
      setFlowStatus('submitted_pending');
    } catch (err) {
      const message =
        err instanceof RegistrationApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Unable to submit your Audience registration right now.';
      setFlowStatus('error');
      setFlowError(message);
    }
  };

  const handleRefreshStatus = async () => {
    if (!registrationRecord?.registrationId) return;
    setFlowError(null);
    try {
      const result = await checkPaymentStatus({
        registrationId: registrationRecord.registrationId,
      });
      setVerificationResult(result);
      if (result.status === 'verified' || result.status === 'confirmed') {
        setFlowStatus('success');
      } else if (result.status === 'failed') {
        setFlowStatus('failed');
      } else {
        setFlowStatus('submitted_pending');
      }
    } catch (err) {
      const message =
        err instanceof RegistrationApiError
          ? err.message
          : 'Unable to check verification status right now.';
      setFlowError(message);
    }
  };

  const renderStatusCard = () => {
    const regRef =
      verificationResult?.referenceId ||
      proofSubmission?.referenceId ||
      registrationRecord?.referenceId ||
      registrationRecord?.registrationId ||
      '—';

    if (flowStatus === 'success' && verificationResult) {
      return (
        <div className="space-y-5 border border-[#00E5FF]/55 bg-[#051015] p-6">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#EAE7E0]/15 pb-4">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-7 w-7 text-[#00E5FF] shrink-0" aria-hidden="true" />
              <div>
                <p className="font-mono-num text-[11px] font-bold tracking-widest text-[#00E5FF] uppercase">
                  AUDIENCE PASS · WATCH ONLY
                </p>
                <h3 className="font-display text-3xl font-black text-[#EAE7E0] uppercase">
                  Payment Verified &amp; Pass Confirmed
                </h3>
              </div>
            </div>
            <span className="border border-[#00E5FF]/55 bg-[#041820] px-3 py-1 font-mono-num text-xs font-bold text-[#00E5FF] uppercase">
              ₹{verificationResult.amountPaid || AUDIENCE_PASS_FEE_INR} Verified
            </span>
          </div>

          <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            <div className="border border-[#EAE7E0]/12 bg-[#050505] p-3">
              <dt className="font-mono-num text-[10px] tracking-widest text-[#EAE7E0]/60 uppercase">
                Registration Code
              </dt>
              <dd className="mt-1 font-mono-num font-bold text-[#C8F36B]">{regRef}</dd>
            </div>
            <div className="border border-[#EAE7E0]/12 bg-[#050505] p-3">
              <dt className="font-mono-num text-[10px] tracking-widest text-[#EAE7E0]/60 uppercase">
                Attendee Name
              </dt>
              <dd className="mt-1 font-semibold text-[#EAE7E0]">{formData.fullName}</dd>
            </div>
            <div className="border border-[#EAE7E0]/12 bg-[#050505] p-3">
              <dt className="font-mono-num text-[10px] tracking-widest text-[#EAE7E0]/60 uppercase">
                Pass Type
              </dt>
              <dd className="mt-1 font-mono-num font-semibold text-[#00E5FF]">
                AUDIENCE PASS (WATCH ONLY)
              </dd>
            </div>
            <div className="border border-[#EAE7E0]/12 bg-[#050505] p-3">
              <dt className="font-mono-num text-[10px] tracking-widest text-[#EAE7E0]/60 uppercase">
                Access Scope
              </dt>
              <dd className="mt-1 text-[#EAE7E0]/85">1 Person · No Performance Rights</dd>
            </div>
          </dl>

          <p className="text-xs leading-relaxed text-[#EAE7E0]/80">
            Visit <span className="font-semibold text-[#C8F36B]">My Tickets</span> using your
            registered email (<span className="font-mono-num">{formData.email}</span>) to download
            your official Audience Pass QR PDF for gate check-in.
          </p>

          <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
            <a
              href="/my-tickets"
              className="inline-flex min-h-[44px] items-center justify-center border border-[#00E5FF] bg-[#00E5FF] px-6 py-2.5 font-display text-base font-extrabold tracking-wider text-[#050505] uppercase whitespace-nowrap"
            >
              Open My Tickets
            </a>
            <button
              type="button"
              onClick={handleRequestClose}
              className="inline-flex min-h-[44px] cursor-pointer items-center justify-center border border-[#EAE7E0]/25 px-5 py-2.5 text-xs font-semibold tracking-wider text-[#EAE7E0] uppercase hover:border-[#EAE7E0]"
            >
              Done
            </button>
          </div>
        </div>
      );
    }

    if (flowStatus === 'failed') {
      return (
        <div className="space-y-4 border border-[#FF1744]/55 bg-[#120609] p-6">
          <div className="flex items-center gap-3">
            <XCircle className="h-7 w-7 text-[#FF1744] shrink-0" aria-hidden="true" />
            <div>
              <p className="font-mono-num text-[11px] font-bold tracking-widest text-[#FF1744] uppercase">
                Verification Rejected
              </p>
              <h3 className="font-display text-3xl font-black text-[#EAE7E0] uppercase">
                Payment Proof Needs Review
              </h3>
            </div>
          </div>
          <p className="text-sm text-[#EAE7E0]/85">
            {verificationResult?.message ||
              'Please check your UTR and upload a clearer screenshot via My Tickets.'}
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <a
              href="/my-tickets"
              className="inline-flex min-h-[44px] items-center justify-center border border-[#FF1744] bg-[#FF1744] px-5 py-2.5 font-display text-base font-extrabold tracking-wider text-[#EAE7E0] uppercase"
            >
              Resubmit via My Tickets
            </a>
            <button
              type="button"
              onClick={() => setFlowStatus('upi_payment')}
              className="inline-flex min-h-[44px] cursor-pointer items-center justify-center border border-[#EAE7E0]/25 px-5 py-2.5 text-xs font-semibold tracking-wider text-[#EAE7E0] uppercase"
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-5 border border-[#00E5FF]/45 bg-[#060E12] p-6">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#EAE7E0]/15 pb-4">
          <div className="flex items-center gap-3">
            <Clock className="h-7 w-7 text-[#C8F36B] shrink-0" aria-hidden="true" />
            <div>
              <p className="font-mono-num text-[11px] font-bold tracking-widest text-[#00E5FF] uppercase">
                AUDIENCE REGISTRATION · PENDING VERIFICATION
              </p>
              <h3 className="font-display text-3xl font-black text-[#EAE7E0] uppercase">
                Payment Proof Submitted
              </h3>
            </div>
          </div>
          <span className="border border-[#C8F36B]/50 bg-[#121608] px-3 py-1 font-mono-num text-xs font-bold text-[#C8F36B] uppercase">
            ₹{AUDIENCE_PASS_FEE_INR} · Pending Verification
          </span>
        </div>

        <p className="text-sm leading-relaxed text-[#EAE7E0]/85">
          {proofSubmission?.message ||
            'Your Audience Pass registration, UTR, and payment screenshot have been saved with Pending Verification status. Once verified by an ALFAAZ organizer, your Audience Pass QR ticket will be unlocked.'}
        </p>

        <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
          <div className="border border-[#EAE7E0]/12 bg-[#050505] p-3">
            <dt className="font-mono-num text-[10px] tracking-widest text-[#EAE7E0]/60 uppercase">
              Reference Code
            </dt>
            <dd className="mt-1 font-mono-num font-bold text-[#C8F36B]">{regRef}</dd>
          </div>
          <div className="border border-[#EAE7E0]/12 bg-[#050505] p-3">
            <dt className="font-mono-num text-[10px] tracking-widest text-[#EAE7E0]/60 uppercase">
              Registration Type
            </dt>
            <dd className="mt-1 font-mono-num font-semibold text-[#00E5FF]">
              AUDIENCE (WATCH ONLY)
            </dd>
          </div>
          <div className="border border-[#EAE7E0]/12 bg-[#050505] p-3">
            <dt className="font-mono-num text-[10px] tracking-widest text-[#EAE7E0]/60 uppercase">
              Submitted UTR
            </dt>
            <dd className="mt-1 font-mono-num text-[#EAE7E0]">{proofSubmission?.utr || utr}</dd>
          </div>
        </dl>

        {flowError && (
          <div className="border border-[#FF1744]/50 bg-[#1A080C] p-3 text-xs text-[#FF8A9E]">
            {flowError}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <button
            type="button"
            onClick={handleRefreshStatus}
            className="inline-flex min-h-[42px] cursor-pointer items-center gap-2 border border-[#00E5FF]/50 bg-[#050505] px-4 py-2 text-xs font-semibold tracking-wider text-[#00E5FF] uppercase transition-colors hover:border-[#00E5FF]"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            Refresh Verification Status
          </button>

          <div className="flex flex-wrap items-center gap-3">
            <a
              href="/my-tickets"
              className="inline-flex min-h-[42px] items-center justify-center border border-[#C8F36B]/55 px-4 py-2 text-xs font-semibold tracking-wider text-[#C8F36B] uppercase hover:bg-[#C8F36B]/10"
            >
              Track in My Tickets
            </a>
            <button
              type="button"
              onClick={handleRequestClose}
              className="inline-flex min-h-[42px] cursor-pointer items-center justify-center border border-[#EAE7E0]/25 bg-[#EAE7E0] px-5 py-2 text-xs font-bold tracking-wider text-[#050505] uppercase"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-labelledby="audience-modal-title"
          initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0 }}
          transition={shouldReduceMotion ? { duration: 0.01 } : { duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[#050505]/92 p-4 backdrop-blur-md sm:items-center sm:p-6"
          onClick={handleRequestClose}
        >
          <motion.div
            initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 18, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.985 }}
            transition={shouldReduceMotion ? { duration: 0.01 } : { duration: 0.28, ease: EDITORIAL_EASE }}
            onClick={(e) => e.stopPropagation()}
            className="relative my-auto w-full max-w-4xl border border-[#00E5FF]/40 bg-[#070709] p-5 shadow-[0_24px_80px_rgba(0,229,255,0.16)] sm:p-8"
          >
            {/* Header */}
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#EAE7E0]/15 pb-5">
              <div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="border border-[#00E5FF]/55 bg-[#051820] px-2.5 py-0.5 font-mono-num text-[10px] font-bold tracking-widest text-[#00E5FF] uppercase">
                    AUDIENCE REGISTRATION · WATCH ONLY
                  </span>
                  <span className="font-mono-num text-xs text-[#C8F36B]">
                    ₹{AUDIENCE_PASS_FEE_INR} FIXED / PERSON
                  </span>
                </div>
                <h2
                  id="audience-modal-title"
                  className="mt-2 font-display text-3xl font-black tracking-tight text-[#EAE7E0] uppercase sm:text-4xl"
                >
                  ALFAAZ — UNFILTERED <span className="text-[#00E5FF]">Audience Pass</span>
                </h2>
              </div>

              <div className="flex items-center gap-3">
                {onSwitchToParticipant && step === 1 && flowStatus === 'idle' && (
                  <button
                    type="button"
                    onClick={onSwitchToParticipant}
                    className="cursor-pointer border border-[#FF1744]/50 bg-[#14070B] px-3 py-2 font-mono-num text-[11px] font-semibold tracking-wider text-[#FF8A9E] uppercase transition-colors hover:border-[#FF1744] hover:text-[#EAE7E0]"
                  >
                    Want to Perform? Switch
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleRequestClose}
                  disabled={isBusy}
                  aria-label="Close audience registration modal"
                  className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center border border-[#EAE7E0]/25 bg-[#050505] text-[#EAE7E0] transition-colors hover:border-[#00E5FF] hover:text-[#00E5FF] disabled:opacity-40"
                >
                  <X className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>
            </div>

            {/* Step Indicator */}
            <div className="mt-5 grid grid-cols-2 gap-2 text-xs">
              <div
                className={`border px-3 py-2 font-mono-num uppercase ${
                  step === 1
                    ? 'border-[#00E5FF] bg-[#061820] text-[#00E5FF]'
                    : 'border-[#EAE7E0]/15 bg-[#050505] text-[#EAE7E0]/60'
                }`}
              >
                01. Attendee Details &amp; Watch-Only Terms
              </div>
              <div
                className={`border px-3 py-2 font-mono-num uppercase ${
                  step === 2
                    ? 'border-[#00E5FF] bg-[#061820] text-[#00E5FF]'
                    : 'border-[#EAE7E0]/15 bg-[#050505] text-[#EAE7E0]/60'
                }`}
              >
                02. Pay ₹{AUDIENCE_PASS_FEE_INR} via Official UPI &amp; Upload Proof
              </div>
            </div>

            {/* Body */}
            <div className="mt-6">
              {flowStatus === 'submitted_pending' ||
              flowStatus === 'success' ||
              flowStatus === 'failed' ? (
                renderStatusCard()
              ) : step === 1 ? (
                <form onSubmit={handleProceedToPayment} noValidate className="space-y-5">
                  {/* Clear Watch-Only Notice */}
                  <div className="flex items-start gap-3 border border-[#00E5FF]/40 bg-[#05141A] p-4">
                    <Eye className="mt-0.5 h-5 w-5 shrink-0 text-[#00E5FF]" aria-hidden="true" />
                    <div className="text-xs leading-relaxed text-[#EAE7E0]/85">
                      <p className="font-mono-num font-bold tracking-wider text-[#00E5FF] uppercase">
                        Watch-Only Entry Notice · ₹{AUDIENCE_PASS_FEE_INR} Per Person
                      </p>
                      <p className="mt-1">{AUDIENCE_PASS_OPTION.watchOnlyNotice}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label
                        htmlFor="aud-full-name"
                        className="block font-mono-num text-[11px] font-semibold tracking-widest text-[#EAE7E0]/75 uppercase"
                      >
                        Attendee Full Name *
                      </label>
                      <input
                        id="aud-full-name"
                        type="text"
                        value={formData.fullName}
                        onChange={(e) => updateField('fullName', e.target.value)}
                        placeholder="e.g. Aarav Sharma"
                        className="mt-1.5 min-h-[44px] w-full border border-[#EAE7E0]/20 bg-[#050505] px-3.5 py-2.5 text-sm text-[#EAE7E0] placeholder:text-[#EAE7E0]/35 focus:border-[#00E5FF] focus:outline-none"
                      />
                      {fieldErrors.fullName && (
                        <p className="mt-1 text-xs text-[#FF6B81]">{fieldErrors.fullName}</p>
                      )}
                    </div>

                    <div>
                      <label
                        htmlFor="aud-email"
                        className="block font-mono-num text-[11px] font-semibold tracking-widest text-[#EAE7E0]/75 uppercase"
                      >
                        Email Address (For Ticket Access) *
                      </label>
                      <input
                        id="aud-email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => updateField('email', e.target.value)}
                        placeholder="you@college.edu"
                        className="mt-1.5 min-h-[44px] w-full border border-[#EAE7E0]/20 bg-[#050505] px-3.5 py-2.5 text-sm text-[#EAE7E0] placeholder:text-[#EAE7E0]/35 focus:border-[#00E5FF] focus:outline-none"
                      />
                      {fieldErrors.email && (
                        <p className="mt-1 text-xs text-[#FF6B81]">{fieldErrors.email}</p>
                      )}
                    </div>

                    <div>
                      <label
                        htmlFor="aud-mobile"
                        className="block font-mono-num text-[11px] font-semibold tracking-widest text-[#EAE7E0]/75 uppercase"
                      >
                        10-Digit Mobile Number *
                      </label>
                      <input
                        id="aud-mobile"
                        type="tel"
                        inputMode="numeric"
                        value={formData.mobileNumber}
                        onChange={(e) => updateField('mobileNumber', e.target.value)}
                        placeholder="9876543210"
                        className="mt-1.5 min-h-[44px] w-full border border-[#EAE7E0]/20 bg-[#050505] px-3.5 py-2.5 font-mono-num text-sm text-[#EAE7E0] placeholder:text-[#EAE7E0]/35 focus:border-[#00E5FF] focus:outline-none"
                      />
                      {fieldErrors.mobileNumber && (
                        <p className="mt-1 text-xs text-[#FF6B81]">{fieldErrors.mobileNumber}</p>
                      )}
                    </div>

                    <div>
                      <label
                        htmlFor="aud-college"
                        className="block font-mono-num text-[11px] font-semibold tracking-widest text-[#EAE7E0]/75 uppercase"
                      >
                        College / Institution *
                      </label>
                      <input
                        id="aud-college"
                        type="text"
                        value={formData.collegeName}
                        onChange={(e) => updateField('collegeName', e.target.value)}
                        placeholder="e.g. Quad AI / RVCE Bengaluru"
                        className="mt-1.5 min-h-[44px] w-full border border-[#EAE7E0]/20 bg-[#050505] px-3.5 py-2.5 text-sm text-[#EAE7E0] placeholder:text-[#EAE7E0]/35 focus:border-[#00E5FF] focus:outline-none"
                      />
                      {fieldErrors.collegeName && (
                        <p className="mt-1 text-xs text-[#FF6B81]">{fieldErrors.collegeName}</p>
                      )}
                    </div>

                    <div className="sm:col-span-2">
                      <label
                        htmlFor="aud-city"
                        className="block font-mono-num text-[11px] font-semibold tracking-widest text-[#EAE7E0]/75 uppercase"
                      >
                        City *
                      </label>
                      <input
                        id="aud-city"
                        type="text"
                        value={formData.city}
                        onChange={(e) => updateField('city', e.target.value)}
                        placeholder="Bengaluru"
                        className="mt-1.5 min-h-[44px] w-full border border-[#EAE7E0]/20 bg-[#050505] px-3.5 py-2.5 text-sm text-[#EAE7E0] placeholder:text-[#EAE7E0]/35 focus:border-[#00E5FF] focus:outline-none"
                      />
                      {fieldErrors.city && (
                        <p className="mt-1 text-xs text-[#FF6B81]">{fieldErrors.city}</p>
                      )}
                    </div>
                  </div>

                  {/* Watch-Only Acknowledgment Checkbox */}
                  <div className="border border-[#EAE7E0]/15 bg-[#050505] p-4">
                    <label className="flex cursor-pointer items-start gap-3">
                      <input
                        type="checkbox"
                        checked={formData.acknowledgedWatchOnly}
                        onChange={(e) => updateField('acknowledgedWatchOnly', e.target.checked)}
                        className="mt-0.5 h-4 w-4 accent-[#00E5FF]"
                      />
                      <span className="text-xs leading-relaxed text-[#EAE7E0]/85">
                        I understand that this <strong className="text-[#00E5FF]">₹59 Audience Pass</strong>{' '}
                        is for <strong>watching the event only</strong> and does not include stage
                        participation or performance rights.
                      </span>
                    </label>
                    {fieldErrors.acknowledgedWatchOnly && (
                      <p className="mt-2 text-xs text-[#FF6B81]">
                        {fieldErrors.acknowledgedWatchOnly}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[#EAE7E0]/12 pt-5">
                    <div>
                      <p className="font-mono-num text-[10px] tracking-widest text-[#EAE7E0]/60 uppercase">
                        Fixed Audience Entry Fee
                      </p>
                      <p className="font-display text-3xl font-black text-[#C8F36B] tabular-nums">
                        ₹{AUDIENCE_PASS_FEE_INR}{' '}
                        <span className="font-mono-num text-xs font-medium text-[#EAE7E0]/70">
                          / 1 Person · Watch Only
                        </span>
                      </p>
                    </div>

                    <button
                      type="submit"
                      className="inline-flex min-h-[46px] cursor-pointer items-center gap-2 border border-[#00E5FF] bg-[#00E5FF] px-6 py-3 font-display text-lg font-extrabold tracking-wider text-[#050505] uppercase transition-all hover:bg-[#33ebff] whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EAE7E0]"
                    >
                      <span>Continue to UPI Payment</span>
                      <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
                    </button>
                  </div>
                </form>
              ) : (
                <div className="space-y-6">
                  {/* Attendee Summary Header */}
                  <div className="flex flex-wrap items-center justify-between gap-3 border border-[#EAE7E0]/15 bg-[#050505] p-4">
                    <div>
                      <p className="font-mono-num text-[10px] tracking-widest text-[#00E5FF] uppercase">
                        AUDIENCE PASS (WATCH ONLY) · 1 PERSON
                      </p>
                      <p className="mt-0.5 text-sm font-semibold text-[#EAE7E0]">
                        {formData.fullName} · {formData.email} · {formData.mobileNumber}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-display text-3xl font-black text-[#C8F36B] tabular-nums">
                        ₹{AUDIENCE_PASS_FEE_INR}
                      </span>
                      {!registrationRecord && (
                        <button
                          type="button"
                          onClick={() => setStep(1)}
                          disabled={isBusy}
                          className="inline-flex cursor-pointer items-center gap-1 border border-[#EAE7E0]/25 px-3 py-1.5 text-[11px] font-semibold tracking-wider text-[#EAE7E0]/85 uppercase hover:border-[#00E5FF] hover:text-[#00E5FF]"
                        >
                          <Edit3 className="h-3.5 w-3.5" aria-hidden="true" />
                          Edit
                        </button>
                      )}
                    </div>
                  </div>

                  {/* QR Code + Payment Instructions Split */}
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-12">
                    <div className="md:col-span-5">
                      <div className="flex h-full flex-col items-center justify-between border border-[#00E5FF]/45 bg-[#050B0E] p-5 text-center">
                        <div className="w-full">
                          <p className="font-mono-num text-[10px] font-bold tracking-[0.25em] text-[#FF6D00] uppercase">
                            Scan &amp; Pay via any UPI App
                          </p>
                          <p className="mt-1 font-display text-3xl font-black tracking-wider text-[#EAE7E0] uppercase">
                            ALFAAZ
                          </p>
                          <p className="font-mono-num text-[11px] font-semibold tracking-widest text-[#00E5FF] uppercase">
                            Amount: ₹{AUDIENCE_PASS_FEE_INR} · AUDIENCE PASS
                          </p>
                        </div>

                        <div className="my-4 w-full max-w-[235px] border-2 border-[#FF6D00]/80 bg-white p-2.5 shadow-[0_0_28px_rgba(255,109,0,0.22)]">
                          <div className="relative aspect-square w-full overflow-hidden bg-[#DFDFDF]">
                            <img
                              src={OFFICIAL_ALFAAZ_QR_URL}
                              alt="Official ALFAAZ UPI Payment QR Code"
                              className="pointer-events-none absolute max-w-none select-none"
                              style={{
                                width: '128.32%',
                                height: 'auto',
                                left: '-14.16%',
                                top: '-87.76%',
                              }}
                            />
                          </div>
                        </div>

                        <p className="text-[11px] leading-relaxed text-[#EAE7E0]/65">
                          Pay exactly ₹{AUDIENCE_PASS_FEE_INR} using any UPI app before entering your
                          UTR below.
                        </p>
                      </div>
                    </div>

                    <div className="md:col-span-7">
                      <div className="flex h-full flex-col justify-between border border-[#EAE7E0]/15 bg-[#08080A] p-5">
                        <div>
                          <div className="flex items-center gap-2 border-b border-[#EAE7E0]/12 pb-3">
                            <QrCode className="h-4 w-4 text-[#FF6D00]" aria-hidden="true" />
                            <p className="font-mono-num text-xs font-bold tracking-widest text-[#C8F36B] uppercase">
                              Audience Payment Instructions
                            </p>
                          </div>

                          <ol className="mt-4 space-y-3">
                            {AUDIENCE_PAYMENT_INSTRUCTIONS.map((instruction, idx) => (
                              <li
                                key={instruction}
                                className="flex items-start gap-3 text-sm text-[#EAE7E0]/85"
                              >
                                <span className="font-mono-num mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center border border-[#00E5FF]/55 bg-[#051820] text-[11px] font-bold text-[#00E5FF]">
                                  {idx + 1}
                                </span>
                                <span className="leading-snug">{instruction}</span>
                              </li>
                            ))}
                          </ol>
                        </div>

                        <div className="mt-5 border-t border-[#EAE7E0]/12 pt-4 text-xs">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[#EAE7E0]/65">Pass Type:</span>
                            <span className="font-mono-num font-bold text-[#00E5FF]">
                              AUDIENCE PASS (WATCH ONLY)
                            </span>
                          </div>
                          <div className="mt-1 flex items-center justify-between gap-2">
                            <span className="text-[#EAE7E0]/65">Authoritative Fee:</span>
                            <span className="font-mono-num font-bold text-[#C8F36B]">
                              ₹{AUDIENCE_PASS_FEE_INR}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* UTR + Proof Upload Form */}
                  <form
                    onSubmit={handlePaymentProofSubmit}
                    noValidate
                    className="space-y-4 border border-[#EAE7E0]/18 bg-[#08080A] p-5"
                  >
                    <div>
                      <label
                        htmlFor="aud-utr-input"
                        className="block font-mono-num text-[11px] font-semibold tracking-widest text-[#EAE7E0]/80 uppercase"
                      >
                        UPI Transaction ID / UTR *
                      </label>
                      <input
                        id="aud-utr-input"
                        type="text"
                        value={utr}
                        disabled={isBusy}
                        onChange={(e) => {
                          setUtr(e.target.value);
                          if (paymentFormError) setPaymentFormError(null);
                        }}
                        placeholder="e.g. 432819402819"
                        className="mt-1.5 min-h-[44px] w-full border border-[#EAE7E0]/20 bg-[#050505] px-3.5 py-2.5 font-mono-num text-sm text-[#EAE7E0] placeholder:text-[#EAE7E0]/35 focus:border-[#00E5FF] focus:outline-none"
                      />
                    </div>

                    <div>
                      <span className="block font-mono-num text-[11px] font-semibold tracking-widest text-[#EAE7E0]/80 uppercase">
                        Upload Payment Screenshot / PDF ({ALLOWED_PROOF_EXTENSIONS.join(', ')}, max 10 MB) *
                      </span>
                      <input
                        ref={proofInputRef}
                        type="file"
                        accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
                        onChange={handleProofFileChange}
                        disabled={isBusy}
                        className="sr-only"
                      />

                      {!proofFile ? (
                        <button
                          type="button"
                          onClick={() => proofInputRef.current?.click()}
                          disabled={isBusy}
                          className="mt-2 flex min-h-[92px] w-full cursor-pointer flex-col items-center justify-center gap-2 border border-dashed border-[#00E5FF]/45 bg-[#050505] px-4 py-4 text-center transition-colors hover:border-[#00E5FF]"
                        >
                          <Upload className="h-5 w-5 text-[#00E5FF]" aria-hidden="true" />
                          <span className="text-xs font-medium text-[#EAE7E0]/85">
                            Click to attach your ₹{AUDIENCE_PASS_FEE_INR} UPI payment screenshot or PDF
                          </span>
                        </button>
                      ) : (
                        <div className="mt-2 flex items-center justify-between gap-3 border border-[#00E5FF]/40 bg-[#050505] p-3">
                          <div className="flex min-w-0 items-center gap-3">
                            {proofPreviewUrl ? (
                              <img
                                src={proofPreviewUrl}
                                alt="Uploaded proof preview"
                                className="h-12 w-12 shrink-0 border border-[#EAE7E0]/20 object-cover"
                              />
                            ) : proofFile.type === 'application/pdf' ? (
                              <FileText className="h-8 w-8 shrink-0 text-[#00E5FF]" aria-hidden="true" />
                            ) : (
                              <ImageIcon className="h-8 w-8 shrink-0 text-[#00E5FF]" aria-hidden="true" />
                            )}
                            <div className="min-w-0">
                              <p className="truncate text-xs font-semibold text-[#EAE7E0]">
                                {proofFile.name}
                              </p>
                              <p className="font-mono-num text-[11px] text-[#EAE7E0]/60">
                                {(proofFile.size / 1024 / 1024).toFixed(2)} MB
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setProofFile(null);
                              if (proofInputRef.current) proofInputRef.current.value = '';
                            }}
                            disabled={isBusy}
                            aria-label="Remove uploaded file"
                            className="cursor-pointer border border-[#EAE7E0]/20 p-2 text-[#EAE7E0]/75 hover:border-[#FF1744] hover:text-[#FF1744]"
                          >
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                          </button>
                        </div>
                      )}
                    </div>

                    {flowStatus === 'uploading_proof' && (
                      <div className="space-y-1.5">
                        <div className="flex justify-between font-mono-num text-[11px] text-[#00E5FF]">
                          <span>Uploading payment proof...</span>
                          <span>{uploadProgress}%</span>
                        </div>
                        <div className="h-1.5 w-full bg-[#EAE7E0]/15">
                          <div
                            className="h-full bg-[#00E5FF] transition-all"
                            style={{ width: `${uploadProgress}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {(paymentFormError || flowError) && (
                      <div className="flex items-start gap-2.5 border border-[#FF1744]/55 bg-[#1B070C] p-3 text-xs text-[#FF99AA]">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#FF1744]" aria-hidden="true" />
                        <span>{paymentFormError || flowError}</span>
                      </div>
                    )}

                    <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                      {!registrationRecord ? (
                        <button
                          type="button"
                          onClick={() => setStep(1)}
                          disabled={isBusy}
                          className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 border border-[#EAE7E0]/25 px-4 py-2 text-xs font-semibold tracking-wider text-[#EAE7E0] uppercase hover:border-[#EAE7E0]"
                        >
                          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                          Back
                        </button>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-[11px] text-[#EAE7E0]/60">
                          <ShieldCheck className="h-3.5 w-3.5 text-[#00E5FF]" aria-hidden="true" />
                          Server-verified ₹{AUDIENCE_PASS_FEE_INR} Audience Pass
                        </span>
                      )}

                      <button
                        type="submit"
                        disabled={isBusy}
                        className="inline-flex min-h-[46px] cursor-pointer items-center gap-2 border border-[#00E5FF] bg-[#00E5FF] px-6 py-3 font-display text-lg font-extrabold tracking-wider text-[#050505] uppercase transition-all hover:bg-[#33ebff] disabled:opacity-60 whitespace-nowrap"
                      >
                        {isBusy ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                            <span>
                              {flowStatus === 'preparing_registration'
                                ? 'Saving Details...'
                                : 'Uploading Proof...'}
                            </span>
                          </>
                        ) : (
                          <>
                            <Lock className="h-4 w-4" aria-hidden="true" />
                            <span>Submit Audience Registration · ₹{AUDIENCE_PASS_FEE_INR}</span>
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
