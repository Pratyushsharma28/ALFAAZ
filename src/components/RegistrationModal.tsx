import { ChangeEvent, FormEvent, ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Clock,
  CreditCard,
  Edit3,
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
  BackendPaymentProofSubmissionResult,
  BackendPaymentVerificationResult,
  BackendRazorpayOrderResult,
  BackendRegistrationResult,
  ENTRY_PASS_LIST,
  ENTRY_PASS_OPTIONS,
  EntryPassTierId,
  PARTICIPATION_CATEGORIES,
  ParticipationCategory,
  PaymentFlowStatus,
  RegistrationFieldErrors,
  RegistrationFormData,
  validatePaymentProofFile,
  validatePerformanceDetailsStep,
  validatePersonalDetailsStep,
  validateUtr,
} from '../types/registration';
import {
  checkPaymentStatus,
  createRazorpayOrder,
  isBackendConfigured,
  RegistrationApiError,
  submitPaymentProofWithProgress,
  submitRegistration,
  verifyRazorpayPayment,
} from '../services/registrationApi';
import { openRazorpayCheckout } from '../services/razorpayCheckout';

const OFFICIAL_ALFAAZ_QR_URL =
  '/assets/aistudio/WhatsApp_Image_2026-11-27_at_16.07.15_8695a728.jpeg';

export interface RegistrationModalProps {
  isOpen: boolean;
  initialPassTier?: EntryPassTierId;
  initialCategory?: ParticipationCategory;
  onClose: () => void;
}

type WizardStep = 1 | 2 | 3 | 4;

const STEP_LABELS: { step: WizardStep; title: string; shortTitle: string }[] = [
  { step: 1, title: 'Select Entry Type', shortTitle: 'Entry' },
  { step: 2, title: 'Personal Details', shortTitle: 'Personal' },
  { step: 3, title: 'Performance & Team', shortTitle: 'Performance' },
  { step: 4, title: 'Review & Payment', shortTitle: 'Review' },
];

function createInitialFormData(
  initialPassTier: EntryPassTierId = 'individual',
  initialCategory?: ParticipationCategory
): RegistrationFormData {
  const pass = ENTRY_PASS_OPTIONS[initialPassTier];
  return {
    entryType: initialPassTier,
    fullName: '',
    email: '',
    mobileNumber: '',
    collegeName: '',
    city: '',
    categories: initialCategory ? [initialCategory] : [],
    teamOrIndividualName: '',
    participantCount: pass.fixedParticipantCount ? String(pass.fixedParticipantCount) : '3',
    participantNames: '',
    teamLeaderName: '',
    emergencyContactNumber: '',
  };
}

function generateIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `alfaaz_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function RegistrationModal({
  isOpen,
  initialPassTier = 'individual',
  initialCategory,
  onClose,
}: RegistrationModalProps) {
  const shouldReduceMotion = useReducedMotion();

  const [step, setStep] = useState<WizardStep>(1);
  const [formData, setFormData] = useState<RegistrationFormData>(() =>
    createInitialFormData(initialPassTier, initialCategory)
  );
  const [errors, setErrors] = useState<RegistrationFieldErrors>({});

  // Payment flow state & duplicate-order prevention cache
  const [paymentStatus, setPaymentStatus] = useState<PaymentFlowStatus>('idle');
  const [paymentMessage, setPaymentMessage] = useState<string>('');
  const [verificationResult, setVerificationResult] =
    useState<BackendPaymentVerificationResult | null>(null);
  const [proofResult, setProofResult] =
    useState<BackendPaymentProofSubmissionResult | null>(null);

  // UPI QR Payment Proof state
  const [utr, setUtr] = useState<string>('');
  const [utrError, setUtrError] = useState<string | null>(null);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofFileError, setProofFileError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);

  const [idempotencyKey, setIdempotencyKey] = useState<string>(() => generateIdempotencyKey());
  const [cachedRegistration, setCachedRegistration] =
    useState<BackendRegistrationResult | null>(null);
  const [cachedOrder, setCachedOrder] = useState<BackendRazorpayOrderResult | null>(null);

  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const wasOpenRef = useRef(false);

  const selectedPass = ENTRY_PASS_OPTIONS[formData.entryType];
  const backendReady = isBackendConfigured();

  const isBusyPaymentState =
    paymentStatus === 'preparing_registration' ||
    paymentStatus === 'uploading_proof' ||
    paymentStatus === 'creating_order' ||
    paymentStatus === 'opening_checkout' ||
    paymentStatus === 'processing';

  // Sync incoming trigger preset when opening the modal fresh (or after a completed registration)
  useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      if (paymentStatus === 'success') {
        setFormData(createInitialFormData(initialPassTier, initialCategory));
        setStep(1);
        setPaymentStatus('idle');
        setPaymentMessage('');
        setVerificationResult(null);
        setProofResult(null);
        setUtr('');
        setUtrError(null);
        setProofFile(null);
        setProofFileError(null);
        setUploadProgress(0);
        setCachedRegistration(null);
        setCachedOrder(null);
        setIdempotencyKey(generateIdempotencyKey());
      } else {
        setFormData((prev) => {
          const pass = ENTRY_PASS_OPTIONS[initialPassTier];
          const nextCategories =
            initialCategory && !prev.categories.includes(initialCategory)
              ? [...prev.categories, initialCategory]
              : prev.categories;
          return {
            ...prev,
            entryType: initialPassTier,
            participantCount: pass.fixedParticipantCount
              ? String(pass.fixedParticipantCount)
              : Number(prev.participantCount) >= 2
                ? prev.participantCount
                : '3',
            categories: nextCategories,
          };
        });
        if (paymentStatus !== 'submitted_pending' && paymentStatus !== 'pending') {
          setStep(1);
          setErrors({});
          setPaymentStatus('idle');
          setPaymentMessage('');
        }
      }
    }
    wasOpenRef.current = isOpen;
  }, [isOpen, initialPassTier, initialCategory, paymentStatus]);

  // Prevent background scrolling while modal is open
  useEffect(() => {
    if (!isOpen) return;
    const prevBodyOverflow = document.body.style.overflow;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevBodyOverflow;
      document.documentElement.style.overflow = prevHtmlOverflow;
    };
  }, [isOpen]);

  const handleSafeClose = useCallback(() => {
    if (isBusyPaymentState) return;
    onClose();
  }, [isBusyPaymentState, onClose]);

  // Keyboard Escape + focus restoration
  useEffect(() => {
    if (!isOpen) return;
    previousFocusRef.current = document.activeElement as HTMLElement | null;

    const timer = window.setTimeout(() => {
      closeButtonRef.current?.focus();
    }, 50);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        handleSafeClose();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('keydown', onKeyDown);
      previousFocusRef.current?.focus?.();
    };
  }, [isOpen, handleSafeClose]);

  // Scroll modal body to top smoothly on step change
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ top: 0, behavior: 'auto' });
    }
  }, [step, paymentStatus]);

  // Invalidate cached registration/order whenever registration form fields are edited
  const invalidateOrderCache = useCallback(() => {
    setCachedRegistration(null);
    setCachedOrder(null);
    setProofResult(null);
    setIdempotencyKey(generateIdempotencyKey());
  }, []);

  const updateField = <K extends keyof RegistrationFormData>(
    key: K,
    value: RegistrationFormData[K]
  ) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const copy = { ...prev };
      delete copy[key];
      return copy;
    });
    invalidateOrderCache();
  };

  const handleSelectEntryType = (tierId: EntryPassTierId) => {
    const pass = ENTRY_PASS_OPTIONS[tierId];
    setFormData((prev) => ({
      ...prev,
      entryType: tierId,
      participantCount: pass.fixedParticipantCount
        ? String(pass.fixedParticipantCount)
        : Number(prev.participantCount) >= 2
          ? prev.participantCount
          : '3',
    }));
    setErrors({});
    invalidateOrderCache();
  };

  const handleToggleCategory = (category: ParticipationCategory) => {
    setFormData((prev) => {
      const exists = prev.categories.includes(category);
      const nextCategories = exists
        ? prev.categories.filter((c) => c !== category)
        : [...prev.categories, category];
      return { ...prev, categories: nextCategories };
    });
    setErrors((prev) => {
      if (!prev.categories) return prev;
      const copy = { ...prev };
      delete copy.categories;
      return copy;
    });
    invalidateOrderCache();
  };

  // Pre-seed Step 3 fields intelligently for Individual / Couple when entering Step 3
  const prepareStep3Defaults = useCallback((current: RegistrationFormData): RegistrationFormData => {
    const fullNameTrimmed = current.fullName.trim();
    if (!fullNameTrimmed) return current;

    if (current.entryType === 'individual') {
      return {
        ...current,
        participantCount: '1',
        teamOrIndividualName: current.teamOrIndividualName || fullNameTrimmed,
        participantNames: current.participantNames || fullNameTrimmed,
        teamLeaderName: current.teamLeaderName || fullNameTrimmed,
      };
    }

    if (current.entryType === 'couple') {
      return {
        ...current,
        participantCount: '2',
        teamLeaderName: current.teamLeaderName || fullNameTrimmed,
      };
    }

    return {
      ...current,
      teamLeaderName: current.teamLeaderName || fullNameTrimmed,
    };
  }, []);

  const handleContinue = (event?: FormEvent) => {
    event?.preventDefault();

    if (step === 1) {
      setErrors({});
      setStep(2);
      return;
    }

    if (step === 2) {
      const stepErrors = validatePersonalDetailsStep(formData);
      if (Object.keys(stepErrors).length > 0) {
        setErrors(stepErrors);
        return;
      }
      setErrors({});
      setFormData((prev) => prepareStep3Defaults(prev));
      setStep(3);
      return;
    }

    if (step === 3) {
      const stepErrors = validatePerformanceDetailsStep(formData);
      if (Object.keys(stepErrors).length > 0) {
        setErrors(stepErrors);
        return;
      }
      setErrors({});
      setStep(4);
    }
  };

  const handleBack = () => {
    setErrors({});
    if (paymentStatus !== 'idle' && !isBusyPaymentState) {
      setPaymentStatus('idle');
      setPaymentMessage('');
    }
    if (step > 1) {
      setStep((prev) => (prev - 1) as WizardStep);
    }
  };

  const handleJumpToStep = (targetStep: WizardStep) => {
    if (isBusyPaymentState) return;
    if (targetStep === step) return;
    if (targetStep < step) {
      setErrors({});
      if (paymentStatus !== 'idle') {
        setPaymentStatus('idle');
        setPaymentMessage('');
      }
      setStep(targetStep);
      return;
    }

    // Validate intermediate steps when jumping forward via progress bar
    if (step <= 2 && targetStep >= 3) {
      const personalErrors = validatePersonalDetailsStep(formData);
      if (Object.keys(personalErrors).length > 0) {
        setErrors(personalErrors);
        setStep(2);
        return;
      }
    }
    if (step <= 3 && targetStep === 4) {
      const perfErrors = validatePerformanceDetailsStep(formData);
      if (Object.keys(perfErrors).length > 0) {
        setErrors(perfErrors);
        setStep(3);
        return;
      }
    }
    setErrors({});
    setStep(targetStep);
  };

  /**
   * Opens the PAY TO ALFAAZ payment step after final client-side guard.
   */
  const handleProceedToPayment = () => {
    if (isBusyPaymentState) return;

    const personalErrors = validatePersonalDetailsStep(formData);
    if (Object.keys(personalErrors).length > 0) {
      setErrors(personalErrors);
      setStep(2);
      return;
    }
    const perfErrors = validatePerformanceDetailsStep(formData);
    if (Object.keys(perfErrors).length > 0) {
      setErrors(perfErrors);
      setStep(3);
      return;
    }

    setPaymentMessage('');
    setUtrError(null);
    setProofFileError(null);
    setPaymentStatus('upi_payment');
  };

  /**
   * Submits registration (reusing cachedRegistration on retry) and uploads
   * UPI Transaction ID / UTR + payment screenshot securely to the backend.
   * Never claims upload or submission succeeded if backend fails.
   */
  const handleSubmitUpiPaymentProof = async () => {
    if (isBusyPaymentState) return;

    const nextUtrError = validateUtr(utr);
    const nextFileError = validatePaymentProofFile(proofFile);
    setUtrError(nextUtrError);
    setProofFileError(nextFileError);

    if (nextUtrError || nextFileError || !proofFile) {
      return;
    }

    setPaymentMessage('');
    setUploadProgress(0);

    try {
      let registration = cachedRegistration;
      if (!registration) {
        setPaymentStatus('preparing_registration');
        registration = await submitRegistration(formData, idempotencyKey);
        setCachedRegistration(registration);
      }

      setPaymentStatus('uploading_proof');
      const submitted = await submitPaymentProofWithProgress({
        registrationId: registration.registrationId,
        entryType: formData.entryType,
        utr: utr.trim(),
        proofFile,
        idempotencyKey,
        onProgress: (percent) => setUploadProgress(percent),
      });

      setProofResult(submitted);

      if (submitted.status === 'confirmed' || submitted.status === 'verified') {
        setVerificationResult({
          status: submitted.status,
          registrationId: submitted.registrationId,
          referenceId: submitted.referenceId || submitted.registrationId,
          participantOrTeamName: formData.teamOrIndividualName || formData.fullName,
          entryType: formData.entryType,
          amountPaid: selectedPass.price,
          utr: submitted.utr || utr.trim(),
          proofStatus: submitted.proofStatus || 'Verified',
          verifiedStatusLabel: 'Verified & Paid',
          message: submitted.message,
        });
        setPaymentStatus('success');
        setPaymentMessage('');
      } else {
        setPaymentStatus('submitted_pending');
        setPaymentMessage(submitted.message || '');
      }
    } catch (err) {
      setUploadProgress(0);
      setPaymentStatus('upi_payment');
      if (err instanceof RegistrationApiError) {
        setPaymentMessage(err.message);
      } else {
        setPaymentMessage(
          err instanceof Error
            ? err.message
            : 'Unable to submit payment proof right now. Please try again.'
        );
      }
    }
  };

  /**
   * Razorpay Checkout flow — preserved ready for Razorpay payment gateway integration.
   */
  const handleProceedWithRazorpay = async () => {
    if (isBusyPaymentState) return;

    const personalErrors = validatePersonalDetailsStep(formData);
    if (Object.keys(personalErrors).length > 0) {
      setErrors(personalErrors);
      setStep(2);
      return;
    }
    const perfErrors = validatePerformanceDetailsStep(formData);
    if (Object.keys(perfErrors).length > 0) {
      setErrors(perfErrors);
      setStep(3);
      return;
    }

    setPaymentMessage('');

    try {
      let registration = cachedRegistration;
      if (!registration) {
        setPaymentStatus('preparing_registration');
        registration = await submitRegistration(formData, idempotencyKey);
        setCachedRegistration(registration);
      }

      let order = cachedOrder;
      if (!order) {
        setPaymentStatus('creating_order');
        order = await createRazorpayOrder({
          registrationId: registration.registrationId,
          entryType: formData.entryType,
          idempotencyKey,
        });
        setCachedOrder(order);
      }

      setPaymentStatus('opening_checkout');

      await openRazorpayCheckout({
        order,
        formData,
        onCancelled: () => {
          setPaymentStatus('cancelled');
          setPaymentMessage(
            'Payment was cancelled before completion. Your registration details are preserved—you can retry payment anytime.'
          );
        },
        onPaymentFailed: (reason) => {
          setPaymentStatus('failed');
          setPaymentMessage(reason);
        },
        onSuccessCallback: async (razorpayResponse) => {
          setPaymentStatus('processing');
          setPaymentMessage('Verifying payment signature with the server...');
          try {
            const verification = await verifyRazorpayPayment({
              registrationId: registration.registrationId,
              payment: razorpayResponse,
            });
            setVerificationResult(verification);

            if (verification.status === 'confirmed' || verification.status === 'verified') {
              setPaymentStatus('success');
              setPaymentMessage('');
            } else if (
              verification.status === 'pending' ||
              verification.status === 'pending_verification'
            ) {
              setPaymentStatus('pending');
              setPaymentMessage(
                verification.message ||
                  'Your payment is awaiting confirmation from Razorpay and our backend webhook.'
              );
            } else {
              setPaymentStatus('failed');
              setPaymentMessage(
                verification.message ||
                  'Payment verification did not succeed. Please retry payment.'
              );
            }
          } catch (verifyErr) {
            const msg =
              verifyErr instanceof Error
                ? verifyErr.message
                : 'Unable to verify payment with the backend.';
            setPaymentStatus('error');
            setPaymentMessage(msg);
          }
        },
      });
    } catch (err) {
      if (err instanceof RegistrationApiError) {
        setPaymentStatus('error');
        setPaymentMessage(err.message);
      } else {
        setPaymentStatus('error');
        setPaymentMessage(
          err instanceof Error
            ? err.message
            : 'An unexpected error occurred while starting payment.'
        );
      }
    }
  };

  // Expose Razorpay trigger cleanly on module reference so gateway integration remains ready
  void handleProceedWithRazorpay;

  const handleCheckPendingStatus = async () => {
    const registrationId = proofResult?.registrationId || cachedRegistration?.registrationId;
    if (!registrationId || isBusyPaymentState) return;
    const previousStatus = paymentStatus;
    setPaymentStatus('processing');
    setPaymentMessage('Checking latest payment verification status...');
    try {
      const result = await checkPaymentStatus({
        registrationId,
        orderId: cachedOrder?.orderId,
      });
      setVerificationResult(result);
      if (result.status === 'confirmed' || result.status === 'verified') {
        setPaymentStatus('success');
        setPaymentMessage('');
      } else if (result.status === 'pending' || result.status === 'pending_verification') {
        setPaymentStatus(previousStatus === 'submitted_pending' ? 'submitted_pending' : 'pending');
        setPaymentMessage(
          result.message ||
            'Payment is still pending organizer verification. Please check again shortly.'
        );
      } else {
        setPaymentStatus('failed');
        setPaymentMessage(
          result.message ||
            'Payment verification was not approved. Please check your UTR or upload a clearer proof.'
        );
      }
    } catch (err) {
      setPaymentStatus(previousStatus === 'submitted_pending' ? 'submitted_pending' : 'error');
      setPaymentMessage(
        err instanceof Error ? err.message : 'Unable to check payment status right now.'
      );
    }
  };

  const showPaymentOverlayView = useMemo(
    () => paymentStatus !== 'idle',
    [paymentStatus]
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="alfaaz-registration-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="registration-modal-title"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={shouldReduceMotion ? { duration: 0.01 } : { duration: 0.28, ease: EDITORIAL_EASE }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              handleSafeClose();
            }
          }}
          className="fixed inset-0 z-50 flex h-[100dvh] w-screen items-center justify-center overflow-hidden bg-[#050505]/92 px-3 py-3 md:backdrop-blur-md sm:p-6"
        >
          <motion.div
            initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 18, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.97 }}
            transition={
              shouldReduceMotion ? { duration: 0.01 } : { duration: 0.36, ease: EDITORIAL_EASE }
            }
            onClick={(e) => e.stopPropagation()}
            className="underground-surface relative flex max-h-[94dvh] w-full max-w-[780px] flex-col overflow-hidden border border-[#FF1744]/40 bg-[#050505] text-[#EAE7E0] shadow-[0_32px_90px_rgba(0,0,0,0.95),0_0_48px_rgba(255,23,68,0.18)]"
          >
            {/* Top Crimson Accent Hairline */}
            <div
              aria-hidden="true"
              className="h-[2px] w-full shrink-0 bg-gradient-to-r from-[#A41034]/30 via-[#FF1744] to-[#C8F36B]/50"
            />

            {/* Modal Header */}
            <div className="flex shrink-0 items-center justify-between gap-4 border-b border-[#EAE7E0]/15 bg-[#070709]/95 px-5 py-4 sm:px-7">
              <div className="min-w-0">
                <p className="font-mono-num text-[10px] font-semibold tracking-[0.22em] text-[#C8F36B] uppercase sm:text-xs">
                  ALFAAZ — UNFILTERED · 18 DEC 2026
                </p>
                <h2
                  id="registration-modal-title"
                  className="mt-1 truncate font-display text-2xl font-black tracking-tight text-[#EAE7E0] uppercase sm:text-3xl"
                >
                  Official Event <span className="text-[#FF1744]">Registration</span>
                </h2>
              </div>

              <button
                ref={closeButtonRef}
                type="button"
                disabled={isBusyPaymentState}
                onClick={handleSafeClose}
                aria-label="Close registration modal"
                className="inline-flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center border border-[#EAE7E0]/20 bg-[#050505] text-[#EAE7E0]/85 transition-colors hover:border-[#FF1744] hover:bg-[#FF1744] hover:text-[#EAE7E0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF1744] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            {/* Step Progress Indicator */}
            {!showPaymentOverlayView && (
              <div className="shrink-0 border-b border-[#EAE7E0]/12 bg-[#060608] px-5 py-3.5 sm:px-7">
                <div className="flex items-center justify-between gap-2">
                  {STEP_LABELS.map((item, idx) => {
                    const isCurrent = step === item.step;
                    const isCompleted = step > item.step;
                    return (
                      <div key={item.step} className="flex flex-1 items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleJumpToStep(item.step)}
                          aria-current={isCurrent ? 'step' : undefined}
                          className={`group flex cursor-pointer items-center gap-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF1744] ${
                            isCurrent
                              ? 'text-[#EAE7E0]'
                              : isCompleted
                                ? 'text-[#C8F36B] hover:text-[#EAE7E0]'
                                : 'text-[#EAE7E0]/45 hover:text-[#EAE7E0]/75'
                          }`}
                        >
                          <span
                            className={`font-mono-num flex h-6 w-6 shrink-0 items-center justify-center border text-[11px] font-bold transition-colors ${
                              isCurrent
                                ? 'border-[#FF1744] bg-[#FF1744] text-[#EAE7E0] shadow-[0_0_12px_rgba(255,23,68,0.55)]'
                                : isCompleted
                                  ? 'border-[#C8F36B]/70 bg-[#C8F36B]/15 text-[#C8F36B]'
                                  : 'border-[#EAE7E0]/20 bg-[#050505] text-[#EAE7E0]/55'
                            }`}
                          >
                            {isCompleted ? <Check className="h-3.5 w-3.5" /> : item.step}
                          </span>
                          <span className="hidden text-xs font-semibold tracking-wider uppercase sm:inline">
                            {item.shortTitle}
                          </span>
                        </button>

                        {idx < STEP_LABELS.length - 1 && (
                          <div
                            aria-hidden="true"
                            className={`h-px flex-1 transition-colors ${
                              step > item.step ? 'bg-[#C8F36B]/55' : 'bg-[#EAE7E0]/12'
                            }`}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="mt-2.5 flex items-center justify-between text-xs text-[#EAE7E0]/70 sm:hidden">
                  <span className="font-mono-num uppercase">
                    Step {step} of 4 · {STEP_LABELS[step - 1].title}
                  </span>
                  <span className="font-mono-num font-semibold text-[#C8F36B]">
                    {selectedPass.priceDisplay}
                  </span>
                </div>
              </div>
            )}

            {/* Scrollable Body */}
            <div
              ref={scrollContainerRef}
              className="flex-1 overflow-y-auto px-5 py-6 sm:px-7 sm:py-7"
            >
              {showPaymentOverlayView ? (
                <PaymentStatusPanel
                  status={paymentStatus}
                  message={paymentMessage}
                  formData={formData}
                  verificationResult={verificationResult}
                  proofResult={proofResult}
                  cachedOrder={cachedOrder}
                  cachedRegistration={cachedRegistration}
                  backendReady={backendReady}
                  utr={utr}
                  utrError={utrError}
                  proofFile={proofFile}
                  proofFileError={proofFileError}
                  uploadProgress={uploadProgress}
                  onUtrChange={(val) => {
                    setUtr(val);
                    if (utrError) setUtrError(null);
                    if (paymentMessage) setPaymentMessage('');
                  }}
                  onUtrBlur={() => {
                    if (utr.trim()) {
                      setUtrError(validateUtr(utr));
                    }
                  }}
                  onProofFileSelect={(file) => {
                    if (!file) return;
                    const err = validatePaymentProofFile(file);
                    if (err) {
                      setProofFileError(err);
                      return;
                    }
                    setProofFile(file);
                    setProofFileError(null);
                    setUploadProgress(0);
                    if (paymentMessage) setPaymentMessage('');
                  }}
                  onProofFileRemove={() => {
                    setProofFile(null);
                    setProofFileError(null);
                    setUploadProgress(0);
                  }}
                  onSubmitUpiProof={handleSubmitUpiPaymentProof}
                  onRetry={() => {
                    setPaymentMessage('');
                    setPaymentStatus('upi_payment');
                  }}
                  onCheckPending={handleCheckPendingStatus}
                  onBackToReview={() => {
                    setPaymentStatus('idle');
                    setPaymentMessage('');
                    setStep(4);
                  }}
                  onClose={handleSafeClose}
                />
              ) : (
                <AnimatePresence mode="wait">
                  {step === 1 && (
                    <motion.div
                      key="step-1"
                      initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, x: 14 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, x: -14 }}
                      transition={
                        shouldReduceMotion
                          ? { duration: 0.01 }
                          : { duration: 0.24, ease: EDITORIAL_EASE }
                      }
                    >
                      <p className="font-mono-num text-xs font-semibold tracking-widest text-[#FF1744] uppercase">
                        Step 01 · Entry Pass Selection
                      </p>
                      <h3 className="mt-1 font-display text-3xl font-black tracking-tight text-[#EAE7E0] uppercase">
                        Choose Your Entry Type
                      </h3>
                      <p className="mt-1.5 text-sm text-[#EAE7E0]/75">
                        Select your entry category below. Your payable fee is calculated
                        automatically and cannot be altered manually.
                      </p>

                      <div
                        role="radiogroup"
                        aria-label="Entry Pass Type"
                        className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3"
                      >
                        {ENTRY_PASS_LIST.map((option) => {
                          const isSelected = formData.entryType === option.id;
                          return (
                            <button
                              key={option.id}
                              type="button"
                              role="radio"
                              aria-checked={isSelected}
                              onClick={() => handleSelectEntryType(option.id)}
                              className={`relative flex cursor-pointer flex-col justify-between border p-5 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF1744] ${
                                isSelected
                                  ? 'border-[#FF1744] bg-[#12060A] shadow-[0_0_24px_rgba(255,23,68,0.24)]'
                                  : 'border-[#EAE7E0]/20 bg-[#08080A] hover:border-[#FF1744]/60'
                              }`}
                            >
                              {isSelected && (
                                <span className="absolute top-0 right-0 bg-[#FF1744] px-2.5 py-0.5 font-mono-num text-[10px] font-bold tracking-widest text-[#EAE7E0] uppercase">
                                  Selected
                                </span>
                              )}
                              <div>
                                <p className="font-mono-num text-xs font-semibold tracking-widest text-[#EAE7E0]/70 uppercase">
                                  {option.participantSummary}
                                </p>
                                <p className="mt-2 font-display text-3xl font-black tracking-tight text-[#EAE7E0] uppercase">
                                  {option.label}
                                </p>
                              </div>
                              <div className="mt-5 flex items-baseline justify-between border-t border-[#EAE7E0]/12 pt-4">
                                <span className="font-display text-5xl font-black text-[#C8F36B] tabular-nums">
                                  {option.priceDisplay}
                                </span>
                                <span
                                  aria-hidden="true"
                                  className={`flex h-5 w-5 items-center justify-center rounded-full border ${
                                    isSelected
                                      ? 'border-[#FF1744] bg-[#FF1744] text-[#EAE7E0]'
                                      : 'border-[#EAE7E0]/30'
                                  }`}
                                >
                                  {isSelected && <Check className="h-3 w-3" />}
                                </span>
                              </div>
                            </button>
                          );
                        })}
                      </div>

                      <div className="mt-6 flex items-center justify-between border border-[#EAE7E0]/15 bg-[#08080A] px-4 py-3.5">
                        <div>
                          <p className="font-mono-num text-[11px] tracking-widest text-[#EAE7E0]/65 uppercase">
                            Selected Pass Amount
                          </p>
                          <p className="font-display text-2xl font-black text-[#EAE7E0] uppercase">
                            {selectedPass.label} — {selectedPass.participantSummary}
                          </p>
                        </div>
                        <p className="font-display text-4xl font-black text-[#C8F36B] tabular-nums">
                          {selectedPass.priceDisplay}
                        </p>
                      </div>
                    </motion.div>
                  )}

                  {step === 2 && (
                    <motion.form
                      key="step-2"
                      noValidate
                      onSubmit={handleContinue}
                      initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, x: 14 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, x: -14 }}
                      transition={
                        shouldReduceMotion
                          ? { duration: 0.01 }
                          : { duration: 0.24, ease: EDITORIAL_EASE }
                      }
                    >
                      <p className="font-mono-num text-xs font-semibold tracking-widest text-[#FF1744] uppercase">
                        Step 02 · Personal Details
                      </p>
                      <h3 className="mt-1 font-display text-3xl font-black tracking-tight text-[#EAE7E0] uppercase">
                        Participant Contact Information
                      </h3>
                      <p className="mt-1.5 text-sm text-[#EAE7E0]/75">
                        All fields below are required for event check-in and registration updates.
                      </p>

                      <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2">
                        <div className="sm:col-span-2">
                          <FormField
                            id="reg-full-name"
                            label="Full name"
                            required
                            type="text"
                            autoComplete="name"
                            placeholder="Enter your full name"
                            value={formData.fullName}
                            onChange={(val) => updateField('fullName', val)}
                            error={errors.fullName}
                          />
                        </div>

                        <FormField
                          id="reg-email"
                          label="Email address"
                          required
                          type="email"
                          autoComplete="email"
                          placeholder="you@example.com"
                          value={formData.email}
                          onChange={(val) => updateField('email', val)}
                          error={errors.email}
                        />

                        <FormField
                          id="reg-mobile"
                          label="Mobile number"
                          required
                          type="tel"
                          inputMode="tel"
                          autoComplete="tel"
                          placeholder="10-digit mobile number"
                          value={formData.mobileNumber}
                          onChange={(val) => updateField('mobileNumber', val)}
                          error={errors.mobileNumber}
                        />

                        <FormField
                          id="reg-college"
                          label="College name"
                          required
                          type="text"
                          autoComplete="organization"
                          placeholder="e.g. Quad AI / Your College Name"
                          value={formData.collegeName}
                          onChange={(val) => updateField('collegeName', val)}
                          error={errors.collegeName}
                        />

                        <FormField
                          id="reg-city"
                          label="City"
                          required
                          type="text"
                          autoComplete="address-level2"
                          placeholder="e.g. Bengaluru"
                          value={formData.city}
                          onChange={(val) => updateField('city', val)}
                          error={errors.city}
                        />
                      </div>
                    </motion.form>
                  )}

                  {step === 3 && (
                    <motion.form
                      key="step-3"
                      noValidate
                      onSubmit={handleContinue}
                      initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, x: 14 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, x: -14 }}
                      transition={
                        shouldReduceMotion
                          ? { duration: 0.01 }
                          : { duration: 0.24, ease: EDITORIAL_EASE }
                      }
                    >
                      <p className="font-mono-num text-xs font-semibold tracking-widest text-[#FF1744] uppercase">
                        Step 03 · Performance &amp; Participant Details
                      </p>
                      <h3 className="mt-1 font-display text-3xl font-black tracking-tight text-[#EAE7E0] uppercase">
                        Category &amp; Team Information
                      </h3>

                      {/* Participation Category — Checkboxes (multiple selection) */}
                      <div className="mt-6">
                        <span className="block text-sm font-semibold text-[#EAE7E0]">
                          Participation Category <span className="text-[#FF1744]">*</span>
                        </span>
                        <p className="mt-1 text-xs text-[#EAE7E0]/65">
                          Select one or more performance categories.
                        </p>

                        <div
                          role="group"
                          aria-label="Participation Category"
                          className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3"
                        >
                          {PARTICIPATION_CATEGORIES.map((cat) => {
                            const checked = formData.categories.includes(cat.id);
                            return (
                              <label
                                key={cat.id}
                                className={`flex cursor-pointer items-start gap-3 border p-3.5 transition-colors focus-within:ring-2 focus-within:ring-[#FF1744] ${
                                  checked
                                    ? 'border-[#FF1744] bg-[#12060A]'
                                    : 'border-[#EAE7E0]/20 bg-[#08080A] hover:border-[#EAE7E0]/45'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => handleToggleCategory(cat.id)}
                                  className="mt-0.5 h-4 w-4 shrink-0 accent-[#FF1744]"
                                />
                                <div>
                                  <span
                                    className="block font-display text-xl font-extrabold tracking-wide uppercase"
                                    style={{ color: checked ? cat.accentHex : '#EAE7E0' }}
                                  >
                                    {cat.label}
                                  </span>
                                  <span className="mt-0.5 block text-[11px] text-[#EAE7E0]/65">
                                    {cat.subtitle}
                                  </span>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                        {errors.categories && (
                          <p role="alert" className="mt-2 text-xs font-medium text-[#FF1744]">
                            {errors.categories}
                          </p>
                        )}
                      </div>

                      {/* Participation Type Notice Box */}
                      <div className="mt-6 border border-[#FF1744]/35 bg-[#0C0609] p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="font-mono-num text-[11px] font-semibold tracking-widest text-[#FF1744] uppercase">
                              Participation Type · {selectedPass.label} ({selectedPass.priceDisplay})
                            </p>
                            <p className="mt-1 text-xs font-medium text-[#EAE7E0]/85">
                              Select your participation type carefully. Current pass:{' '}
                              <span className="text-[#C8F36B]">
                                {selectedPass.label} — {selectedPass.participationNote} (
                                {selectedPass.priceDisplay})
                              </span>
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleJumpToStep(1)}
                            className="cursor-pointer border border-[#EAE7E0]/25 px-3 py-1.5 font-mono-num text-[10px] font-semibold tracking-widest text-[#EAE7E0]/85 uppercase transition-colors hover:border-[#FF1744] hover:text-[#FF1744]"
                          >
                            Change Pass
                          </button>
                        </div>

                        {formData.entryType === 'group' && (
                          <div className="mt-3 space-y-1 border-t border-[#EAE7E0]/12 pt-3 text-xs leading-relaxed text-[#EAE7E0]/80">
                            <p>
                              Please provide the name and contact details of the team leader along
                              with the names of all team members.
                            </p>
                            <p className="font-medium text-[#C8F36B]">
                              Please note that the maximum group size will be announced by the
                              organising team.
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Required Fields 6–10 */}
                      <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2">
                        <FormField
                          id="reg-team-or-individual-name"
                          label={
                            formData.entryType === 'individual'
                              ? 'Individual / Stage name'
                              : formData.entryType === 'couple'
                                ? 'Couple / Team name'
                                : 'Team name'
                          }
                          required
                          type="text"
                          placeholder={
                            formData.entryType === 'individual'
                              ? 'Your name or stage name'
                              : formData.entryType === 'couple'
                                ? 'Duo / pair name'
                                : 'Enter your team or crew name'
                          }
                          value={formData.teamOrIndividualName}
                          onChange={(val) => updateField('teamOrIndividualName', val)}
                          error={errors.teamOrIndividualName}
                        />

                        <FormField
                          id="reg-participant-count"
                          label="Number of participants"
                          required
                          type="number"
                          min={formData.entryType === 'group' ? 2 : 1}
                          max={formData.entryType === 'group' ? 50 : 2}
                          readOnly={selectedPass.fixedParticipantCount !== null}
                          helperText={
                            formData.entryType === 'individual'
                              ? 'Fixed to 1 for Individual pass.'
                              : formData.entryType === 'couple'
                                ? 'Fixed to 2 for Couple pass.'
                                : 'Enter total number of members in your team.'
                          }
                          value={formData.participantCount}
                          onChange={(val) => updateField('participantCount', val)}
                          error={errors.participantCount}
                        />

                        <div className="sm:col-span-2">
                          <label
                            htmlFor="reg-participant-names"
                            className="block text-sm font-semibold text-[#EAE7E0]"
                          >
                            {formData.entryType === 'couple'
                              ? 'Names of all participants (Both partners)'
                              : 'Names of all participants'}{' '}
                            <span className="text-[#FF1744]">*</span>
                          </label>
                          <p className="mt-1 text-xs text-[#EAE7E0]/65">
                            {formData.entryType === 'individual'
                              ? 'Confirm the full name of the performing participant.'
                              : formData.entryType === 'couple'
                                ? 'Enter the full names of both participants (one per line or comma-separated).'
                                : 'List the full names of all team members (one per line or comma-separated).'}
                          </p>
                          <textarea
                            id="reg-participant-names"
                            rows={formData.entryType === 'individual' ? 2 : 3}
                            placeholder={
                              formData.entryType === 'individual'
                                ? 'Participant full name'
                                : formData.entryType === 'couple'
                                  ? '1. First participant name\n2. Second participant name'
                                  : '1. Team leader name\n2. Member 2\n3. Member 3...'
                            }
                            value={formData.participantNames}
                            onChange={(e) => updateField('participantNames', e.target.value)}
                            aria-invalid={Boolean(errors.participantNames)}
                            aria-describedby={
                              errors.participantNames ? 'reg-participant-names-error' : undefined
                            }
                            className={`mt-2 w-full border bg-[#08080A] px-3.5 py-2.5 text-sm text-[#EAE7E0] placeholder:text-[#EAE7E0]/35 focus:border-[#FF1744] focus:outline-none ${
                              errors.participantNames
                                ? 'border-[#FF1744]'
                                : 'border-[#EAE7E0]/20'
                            }`}
                          />
                          {errors.participantNames && (
                            <p
                              id="reg-participant-names-error"
                              role="alert"
                              className="mt-1.5 text-xs font-medium text-[#FF1744]"
                            >
                              {errors.participantNames}
                            </p>
                          )}
                        </div>

                        <FormField
                          id="reg-team-leader"
                          label={
                            formData.entryType === 'group'
                              ? 'Team leader name'
                              : 'Team leader / Primary contact name'
                          }
                          required
                          type="text"
                          placeholder={
                            formData.entryType === 'group'
                              ? 'Full name of team leader'
                              : 'Primary contact full name'
                          }
                          value={formData.teamLeaderName}
                          onChange={(val) => updateField('teamLeaderName', val)}
                          error={errors.teamLeaderName}
                        />

                        <FormField
                          id="reg-emergency-contact"
                          label="Emergency contact number"
                          required
                          type="tel"
                          inputMode="tel"
                          placeholder="10-digit emergency mobile number"
                          value={formData.emergencyContactNumber}
                          onChange={(val) => updateField('emergencyContactNumber', val)}
                          error={errors.emergencyContactNumber}
                        />
                      </div>
                    </motion.form>
                  )}

                  {step === 4 && (
                    <motion.div
                      key="step-4"
                      initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, x: 14 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, x: -14 }}
                      transition={
                        shouldReduceMotion
                          ? { duration: 0.01 }
                          : { duration: 0.24, ease: EDITORIAL_EASE }
                      }
                    >
                      <p className="font-mono-num text-xs font-semibold tracking-widest text-[#FF1744] uppercase">
                        Step 04 · Review Registration
                      </p>
                      <h3 className="mt-1 font-display text-3xl font-black tracking-tight text-[#EAE7E0] uppercase">
                        Verify Your Details Before Payment
                      </h3>
                      <p className="mt-1.5 text-sm text-[#EAE7E0]/75">
                        Double-check all information below. You can jump back to edit any section
                        before proceeding to payment.
                      </p>

                      {/* Summary Sections */}
                      <div className="mt-6 space-y-4">
                        <ReviewSectionCard
                          title="Entry Pass"
                          onEdit={() => handleJumpToStep(1)}
                        >
                          <ReviewRow label="Selected Entry Type" value={selectedPass.label} />
                          <ReviewRow
                            label="Registration Fee"
                            value={selectedPass.priceDisplay}
                            highlightLime
                          />
                        </ReviewSectionCard>

                        <ReviewSectionCard
                          title="Personal Details"
                          onEdit={() => handleJumpToStep(2)}
                        >
                          <ReviewRow label="Full Name" value={formData.fullName} />
                          <ReviewRow label="Email" value={formData.email} />
                          <ReviewRow label="Mobile Number" value={formData.mobileNumber} />
                          <ReviewRow label="College Name" value={formData.collegeName} />
                          <ReviewRow label="City" value={formData.city} />
                        </ReviewSectionCard>

                        <ReviewSectionCard
                          title="Performance & Participant Details"
                          onEdit={() => handleJumpToStep(3)}
                        >
                          <ReviewRow
                            label="Participation Categories"
                            value={formData.categories.join(', ')}
                          />
                          <ReviewRow
                            label={
                              formData.entryType === 'individual'
                                ? 'Individual / Stage Name'
                                : 'Team Name'
                            }
                            value={formData.teamOrIndividualName}
                          />
                          <ReviewRow
                            label="Number of Participants"
                            value={formData.participantCount}
                          />
                          <ReviewRow
                            label="Names of All Participants"
                            value={formData.participantNames}
                            multiline
                          />
                          <ReviewRow label="Team Leader" value={formData.teamLeaderName} />
                          <ReviewRow
                            label="Emergency Contact Number"
                            value={formData.emergencyContactNumber}
                          />
                        </ReviewSectionCard>
                      </div>

                      {/* Payable Amount Summary Card */}
                      <div className="mt-6 border border-[#FF1744]/55 bg-[#0C0508] p-5 shadow-[0_0_24px_rgba(255,23,68,0.14)]">
                        <p className="font-mono-num text-xs font-bold tracking-widest text-[#FF1744] uppercase">
                          {selectedPass.heading}
                        </p>
                        <div className="mt-3 flex items-center justify-between text-sm text-[#EAE7E0]/80">
                          <span>Registration Fee:</span>
                          <span className="font-mono-num font-semibold text-[#EAE7E0]">
                            {selectedPass.priceDisplay}
                          </span>
                        </div>
                        <div className="mt-2 flex items-baseline justify-between border-t border-[#EAE7E0]/15 pt-3">
                          <span className="font-display text-2xl font-black tracking-wide text-[#EAE7E0] uppercase">
                            Amount Payable:
                          </span>
                          <span className="font-display text-4xl font-black text-[#C8F36B] tabular-nums">
                            {selectedPass.priceDisplay}
                          </span>
                        </div>
                        <p className="mt-3 flex items-center gap-2 text-xs text-[#EAE7E0]/65">
                          <Lock className="h-3.5 w-3.5 shrink-0 text-[#C8F36B]" aria-hidden="true" />
                          <span>
                            Payments are confirmed only after backend payment verification.
                          </span>
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              )}
            </div>

            {/* Footer Controls */}
            {!showPaymentOverlayView && (
              <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-[#EAE7E0]/15 bg-[#070709] px-5 py-4 sm:px-7">
                {step > 1 ? (
                  <button
                    type="button"
                    onClick={handleBack}
                    className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 border border-[#EAE7E0]/25 bg-[#050505] px-5 py-2.5 font-display text-base font-extrabold tracking-wider text-[#EAE7E0] uppercase transition-colors hover:border-[#EAE7E0]/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EAE7E0]"
                  >
                    <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                    <span>Back</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleSafeClose}
                    className="inline-flex min-h-[44px] cursor-pointer items-center border border-[#EAE7E0]/20 bg-[#050505] px-4 py-2.5 font-mono-num text-xs font-semibold tracking-widest text-[#EAE7E0]/75 uppercase transition-colors hover:border-[#EAE7E0]/50 hover:text-[#EAE7E0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EAE7E0]"
                  >
                    Cancel
                  </button>
                )}

                {step < 4 ? (
                  <button
                    type="button"
                    onClick={() => handleContinue()}
                    className="neon-cta-breathe inline-flex min-h-[44px] cursor-pointer items-center gap-2 border border-[#FF1744] bg-[#FF1744] px-6 py-2.5 font-display text-lg font-extrabold tracking-wider text-[#EAE7E0] uppercase transition-all duration-200 hover:bg-[#ff2b54] hover:shadow-[0_0_28px_rgba(255,23,68,0.7)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EAE7E0]"
                  >
                    <span>Continue</span>
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={isBusyPaymentState}
                    onClick={handleProceedToPayment}
                    className="neon-cta-breathe inline-flex min-h-[44px] cursor-pointer items-center gap-2.5 border border-[#FF1744] bg-[#FF1744] px-6 py-2.5 font-display text-lg font-extrabold tracking-wider text-[#EAE7E0] uppercase transition-all duration-200 hover:bg-[#ff2b54] hover:shadow-[0_0_30px_rgba(255,23,68,0.75)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EAE7E0] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <CreditCard className="h-4 w-4" aria-hidden="true" />
                    <span>Proceed to Payment · {selectedPass.priceDisplay}</span>
                  </button>
                )}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

interface FormFieldProps {
  id: string;
  label: string;
  required?: boolean;
  type: 'text' | 'email' | 'tel' | 'number';
  inputMode?: 'text' | 'email' | 'tel' | 'numeric';
  autoComplete?: string;
  placeholder?: string;
  helperText?: string;
  value: string;
  min?: number;
  max?: number;
  readOnly?: boolean;
  error?: string;
  onChange: (value: string) => void;
}

function FormField({
  id,
  label,
  required,
  type,
  inputMode,
  autoComplete,
  placeholder,
  helperText,
  value,
  min,
  max,
  readOnly,
  error,
  onChange,
}: FormFieldProps) {
  const errorId = `${id}-error`;
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-semibold text-[#EAE7E0]">
        {label} {required && <span className="text-[#FF1744]">*</span>}
      </label>
      <input
        id={id}
        type={type}
        inputMode={inputMode}
        autoComplete={autoComplete}
        placeholder={placeholder}
        value={value}
        min={min}
        max={max}
        readOnly={readOnly}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        className={`mt-2 min-h-[44px] w-full border px-3.5 py-2.5 text-sm text-[#EAE7E0] placeholder:text-[#EAE7E0]/35 focus:border-[#FF1744] focus:outline-none ${
          readOnly ? 'cursor-not-allowed bg-[#0C0C10] text-[#EAE7E0]/75' : 'bg-[#08080A]'
        } ${error ? 'border-[#FF1744]' : 'border-[#EAE7E0]/20'}`}
      />
      {helperText && !error && <p className="mt-1.5 text-xs text-[#EAE7E0]/60">{helperText}</p>}
      {error && (
        <p id={errorId} role="alert" className="mt-1.5 text-xs font-medium text-[#FF1744]">
          {error}
        </p>
      )}
    </div>
  );
}

function ReviewSectionCard({
  title,
  onEdit,
  children,
}: {
  title: string;
  onEdit: () => void;
  children: ReactNode;
}) {
  return (
    <div className="border border-[#EAE7E0]/15 bg-[#08080A] p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2 border-b border-[#EAE7E0]/12 pb-3">
        <p className="font-mono-num text-xs font-semibold tracking-widest text-[#C8F36B] uppercase">
          {title}
        </p>
        <button
          type="button"
          onClick={onEdit}
          className="inline-flex cursor-pointer items-center gap-1.5 font-mono-num text-[11px] font-semibold tracking-wider text-[#EAE7E0]/75 uppercase transition-colors hover:text-[#FF1744] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF1744]"
        >
          <Edit3 className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Edit</span>
        </button>
      </div>
      <dl className="mt-3 divide-y divide-[#EAE7E0]/8">{children}</dl>
    </div>
  );
}

function ReviewRow({
  label,
  value,
  highlightLime,
  multiline,
}: {
  label: string;
  value: string;
  highlightLime?: boolean;
  multiline?: boolean;
}) {
  return (
    <div className="grid grid-cols-1 gap-1 py-2 sm:grid-cols-12 sm:gap-4">
      <dt className="text-xs font-medium text-[#EAE7E0]/60 sm:col-span-5">{label}</dt>
      <dd
        className={`text-sm font-medium sm:col-span-7 ${
          highlightLime ? 'font-mono-num font-bold text-[#C8F36B]' : 'text-[#EAE7E0]'
        } ${multiline ? 'whitespace-pre-line' : 'break-words'}`}
      >
        {value}
      </dd>
    </div>
  );
}

interface PaymentStatusPanelProps {
  status: PaymentFlowStatus;
  message: string;
  formData: RegistrationFormData;
  verificationResult: BackendPaymentVerificationResult | null;
  proofResult: BackendPaymentProofSubmissionResult | null;
  cachedOrder: BackendRazorpayOrderResult | null;
  cachedRegistration: BackendRegistrationResult | null;
  backendReady: boolean;
  utr: string;
  utrError: string | null;
  proofFile: File | null;
  proofFileError: string | null;
  uploadProgress: number;
  onUtrChange: (value: string) => void;
  onUtrBlur: () => void;
  onProofFileSelect: (file: File | null) => void;
  onProofFileRemove: () => void;
  onSubmitUpiProof: () => void;
  onRetry: () => void;
  onCheckPending: () => void;
  onBackToReview: () => void;
  onClose: () => void;
}

const PAYMENT_INSTRUCTIONS = [
  'Scan the official ALFAAZ payment QR code.',
  'Pay the exact amount displayed for your selected registration.',
  'Verify the payment details in your UPI app before paying.',
  'Enter your UPI Transaction ID / UTR.',
  'Upload your payment screenshot.',
  'Submit your registration for payment verification.',
] as const;

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function PaymentStatusPanel({
  status,
  message,
  formData,
  verificationResult,
  proofResult,
  cachedOrder,
  cachedRegistration,
  backendReady,
  utr,
  utrError,
  proofFile,
  proofFileError,
  uploadProgress,
  onUtrChange,
  onUtrBlur,
  onProofFileSelect,
  onProofFileRemove,
  onSubmitUpiProof,
  onRetry,
  onCheckPending,
  onBackToReview,
  onClose,
}: PaymentStatusPanelProps) {
  const pass = ENTRY_PASS_OPTIONS[formData.entryType];
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Create and safely revoke object URL for image screenshot previews
  const previewUrl = useMemo(() => {
    if (!proofFile) return null;
    if (!proofFile.type.startsWith('image/')) return null;
    return URL.createObjectURL(proofFile);
  }, [proofFile]);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const handleFileInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0] ?? null;
    onProofFileSelect(selected);
    event.target.value = '';
  };

  if (
    status === 'upi_payment' ||
    status === 'preparing_registration' ||
    status === 'uploading_proof'
  ) {
    const isSubmitting = status === 'preparing_registration' || status === 'uploading_proof';
    const isPdf = proofFile?.type === 'application/pdf' || proofFile?.name.toLowerCase().endsWith('.pdf');

    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.24, ease: EDITORIAL_EASE }}
        className="space-y-6"
      >
        {/* Top PAY TO ALFAAZ Hero Banner */}
        <div className="border border-[#FF6D00]/45 bg-gradient-to-br from-[#120608] via-[#0B0608] to-[#070709] p-5 shadow-[0_0_32px_rgba(255,23,68,0.16)]">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="font-mono-num text-[11px] font-bold tracking-[0.24em] text-[#FF6D00] uppercase">
                ALFAAZ — UNFILTERED · Official Event Payment
              </p>
              <h3 className="mt-1 font-display text-4xl font-black tracking-tight text-[#EAE7E0] uppercase sm:text-5xl">
                PAY TO <span className="text-[#FF1744]">ALFAAZ</span>
              </h3>
            </div>

            <div className="border border-[#FF1744]/50 bg-[#050505] px-4 py-3 text-right">
              <p className="font-mono-num text-[10px] font-semibold tracking-widest text-[#EAE7E0]/65 uppercase">
                {pass.label} PASS ({pass.participantSummary})
              </p>
              <p className="mt-0.5 font-display text-4xl font-black text-[#C8F36B] tabular-nums">
                {pass.priceDisplay}
              </p>
            </div>
          </div>
        </div>

        {/* QR Code + Payment Instructions Split */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-12">
          {/* Left: Official ALFAAZ Branded QR Card */}
          <div className="md:col-span-5">
            <div className="flex h-full flex-col items-center justify-between border border-[#FF1744]/45 bg-[#090608] p-5 text-center shadow-[0_0_28px_rgba(255,23,68,0.14)]">
              <div className="w-full">
                <p className="font-mono-num text-[10px] font-bold tracking-[0.25em] text-[#FF6D00] uppercase">
                  Scan &amp; Pay via any UPI App
                </p>
                <p className="mt-1 font-display text-4xl font-black tracking-wider text-[#EAE7E0] uppercase">
                  ALFAAZ
                </p>
                <p className="font-mono-num text-[11px] font-semibold tracking-widest text-[#C8F36B] uppercase">
                  Amount: {pass.priceDisplay} · {pass.label}
                </p>
              </div>

              {/* Unmodified Official QR Image Framed Cleanly */}
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
                Verify the payment details in your UPI app before paying. The payee name displayed
                inside your UPI application is controlled by the UPI provider.
              </p>
            </div>
          </div>

          {/* Right: 6 Clear Payment Instructions */}
          <div className="md:col-span-7">
            <div className="flex h-full flex-col justify-between border border-[#EAE7E0]/15 bg-[#08080A] p-5">
              <div>
                <div className="flex items-center gap-2 border-b border-[#EAE7E0]/12 pb-3">
                  <QrCode className="h-4 w-4 text-[#FF6D00]" aria-hidden="true" />
                  <p className="font-mono-num text-xs font-bold tracking-widest text-[#C8F36B] uppercase">
                    Payment Instructions
                  </p>
                </div>

                <ol className="mt-4 space-y-3">
                  {PAYMENT_INSTRUCTIONS.map((instruction, index) => (
                    <li key={instruction} className="flex items-start gap-3 text-sm text-[#EAE7E0]/85">
                      <span className="font-mono-num mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center border border-[#FF1744]/55 bg-[#16070B] text-[11px] font-bold text-[#FF6D00]">
                        {index + 1}
                      </span>
                      <span className="leading-snug">{instruction}</span>
                    </li>
                  ))}
                </ol>
              </div>

              <div className="mt-5 border-t border-[#EAE7E0]/12 pt-4">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="text-[#EAE7E0]/65">Selected Registration:</span>
                  <span className="font-mono-num font-bold text-[#EAE7E0]">
                    {pass.label} ({pass.priceDisplay})
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="text-[#EAE7E0]/65">Participant / Team:</span>
                  <span className="font-medium text-[#EAE7E0]">
                    {formData.teamOrIndividualName || formData.fullName}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Payment Proof Form (UTR + Screenshot/PDF Upload) */}
        <div className="border border-[#EAE7E0]/18 bg-[#08080A] p-5">
          <div className="border-b border-[#EAE7E0]/12 pb-3">
            <p className="font-mono-num text-xs font-bold tracking-widest text-[#FF1744] uppercase">
              Payment Proof Submission
            </p>
            <p className="mt-1 text-xs text-[#EAE7E0]/70">
              Both your UPI Transaction ID / UTR and payment screenshot (or PDF receipt) are
              required for verification.
            </p>
          </div>

          <div className="mt-5 space-y-5">
            {/* UTR / UPI Transaction ID Input */}
            <div>
              <label htmlFor="reg-upi-utr" className="block text-sm font-semibold text-[#EAE7E0]">
                UPI Transaction ID / UTR <span className="text-[#FF1744]">*</span>
              </label>
              <input
                id="reg-upi-utr"
                type="text"
                autoComplete="off"
                disabled={isSubmitting}
                placeholder="e.g. 433189402512 or T261127..."
                value={utr}
                onChange={(e) => onUtrChange(e.target.value)}
                onBlur={onUtrBlur}
                aria-invalid={Boolean(utrError)}
                aria-describedby={utrError ? 'reg-upi-utr-error' : undefined}
                className={`mt-2 min-h-[44px] w-full border bg-[#050505] px-3.5 py-2.5 font-mono-num text-sm text-[#EAE7E0] placeholder:font-sans placeholder:text-[#EAE7E0]/35 focus:border-[#FF6D00] focus:outline-none disabled:cursor-not-allowed disabled:opacity-60 ${
                  utrError ? 'border-[#FF1744]' : 'border-[#EAE7E0]/20'
                }`}
              />
              {!utrError && (
                <p className="mt-1.5 text-xs text-[#EAE7E0]/55">
                  Copy the 12-digit UTR / Transaction ID shown in GPay, PhonePe, Paytm, or your
                  bank UPI app.
                </p>
              )}
              {utrError && (
                <p id="reg-upi-utr-error" role="alert" className="mt-1.5 text-xs font-medium text-[#FF1744]">
                  {utrError}
                </p>
              )}
            </div>

            {/* Payment Screenshot Upload */}
            <div>
              <span className="block text-sm font-semibold text-[#EAE7E0]">
                Payment Screenshot / Receipt <span className="text-[#FF1744]">*</span>
              </span>
              <p className="mt-1 text-xs text-[#EAE7E0]/60">
                Accepted formats: JPG, JPEG, PNG, or PDF (max 10 MB).
              </p>

              <input
                ref={fileInputRef}
                id="reg-payment-proof-file"
                type="file"
                disabled={isSubmitting}
                accept={`${ALLOWED_PROOF_EXTENSIONS.join(',')},image/jpeg,image/png,application/pdf`}
                onChange={handleFileInputChange}
                className="sr-only"
              />

              {!proofFile ? (
                <label
                  htmlFor="reg-payment-proof-file"
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (!isSubmitting) setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    if (isSubmitting) return;
                    const dropped = e.dataTransfer.files?.[0] ?? null;
                    onProofFileSelect(dropped);
                  }}
                  className={`mt-2 flex cursor-pointer flex-col items-center justify-center border border-dashed px-4 py-6 text-center transition-colors ${
                    isDragging
                      ? 'border-[#FF6D00] bg-[#160A06]'
                      : proofFileError
                        ? 'border-[#FF1744] bg-[#12060A]'
                        : 'border-[#EAE7E0]/25 bg-[#050505] hover:border-[#FF6D00]/75'
                  }`}
                >
                  <Upload className="h-6 w-6 text-[#FF6D00]" aria-hidden="true" />
                  <p className="mt-2 text-sm font-semibold text-[#EAE7E0]">
                    Click to upload payment screenshot or drag &amp; drop
                  </p>
                  <p className="mt-1 font-mono-num text-[11px] text-[#EAE7E0]/55 uppercase">
                    JPG · JPEG · PNG · PDF · Up to 10 MB
                  </p>
                </label>
              ) : (
                <div className="mt-2 border border-[#EAE7E0]/20 bg-[#050505] p-3.5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-center gap-3">
                      {previewUrl ? (
                        <img
                          src={previewUrl}
                          alt={`Payment proof preview: ${proofFile.name}`}
                          className="h-16 w-16 shrink-0 border border-[#EAE7E0]/20 bg-[#0B0B0E] object-cover"
                        />
                      ) : (
                        <div className="flex h-16 w-16 shrink-0 flex-col items-center justify-center border border-[#FF6D00]/45 bg-[#120806] text-[#FF6D00]">
                          {isPdf ? (
                            <FileText className="h-6 w-6" aria-hidden="true" />
                          ) : (
                            <ImageIcon className="h-6 w-6" aria-hidden="true" />
                          )}
                          <span className="mt-1 font-mono-num text-[9px] font-bold uppercase">
                            {isPdf ? 'PDF' : 'FILE'}
                          </span>
                        </div>
                      )}

                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-[#EAE7E0]">
                          {proofFile.name}
                        </p>
                        <p className="mt-0.5 font-mono-num text-xs text-[#C8F36B]">
                          {formatFileSize(proofFile.size)} · Ready to upload
                        </p>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        disabled={isSubmitting}
                        onClick={() => fileInputRef.current?.click()}
                        className="inline-flex min-h-[36px] cursor-pointer items-center gap-1.5 border border-[#EAE7E0]/25 bg-[#0A0A0D] px-3 py-1.5 font-mono-num text-[11px] font-semibold tracking-wider text-[#EAE7E0] uppercase transition-colors hover:border-[#FF6D00] hover:text-[#FF6D00] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Replace</span>
                      </button>

                      <button
                        type="button"
                        disabled={isSubmitting}
                        onClick={onProofFileRemove}
                        aria-label="Remove uploaded payment proof"
                        className="inline-flex min-h-[36px] cursor-pointer items-center gap-1.5 border border-[#FF1744]/40 bg-[#12060A] px-3 py-1.5 font-mono-num text-[11px] font-semibold tracking-wider text-[#FF1744] uppercase transition-colors hover:bg-[#FF1744] hover:text-[#EAE7E0] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Remove</span>
                      </button>
                    </div>
                  </div>

                  {/* Real Upload Progress Indicator */}
                  {isSubmitting && (
                    <div className="mt-3 border-t border-[#EAE7E0]/12 pt-3">
                      <div className="flex items-center justify-between font-mono-num text-[11px] text-[#EAE7E0]/80">
                        <span>
                          {status === 'preparing_registration'
                            ? 'Creating registration record...'
                            : `Uploading payment proof... ${uploadProgress}%`}
                        </span>
                        <span className="text-[#C8F36B]">{uploadProgress}%</span>
                      </div>
                      <div className="mt-1.5 h-1.5 w-full overflow-hidden bg-[#EAE7E0]/12">
                        <div
                          className="h-full bg-gradient-to-r from-[#FF1744] via-[#FF6D00] to-[#C8F36B] transition-all duration-200"
                          style={{
                            width: `${status === 'preparing_registration' ? 15 : Math.max(uploadProgress, 8)}%`,
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {proofFileError && (
                <p role="alert" className="mt-1.5 text-xs font-medium text-[#FF1744]">
                  {proofFileError}
                </p>
              )}
            </div>
          </div>

          {/* Backend / Submission Error Banner (never claims success on failure) */}
          {message && (
            <div
              role="alert"
              className="mt-4 flex items-start gap-2.5 border border-[#FF1744]/60 bg-[#15060A] px-4 py-3 text-xs leading-relaxed text-[#EAE7E0]"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#FF1744]" aria-hidden="true" />
              <div>
                <p className="font-mono-num font-bold tracking-wider text-[#FF1744] uppercase">
                  Submission Not Completed
                </p>
                <p className="mt-0.5 text-[#EAE7E0]/85">{message}</p>
              </div>
            </div>
          )}

          {!backendReady && !message && (
            <p className="mt-4 border border-[#00E5FF]/35 bg-[#050505] px-3.5 py-2.5 text-xs text-[#00E5FF]">
              Backend API pending: set <code className="font-mono-num">VITE_API_BASE_URL</code> to
              save registrations, store payment screenshots, and verify payments via the admin
              dashboard.
            </p>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#EAE7E0]/15 pt-4">
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onBackToReview}
            className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 border border-[#EAE7E0]/25 bg-[#050505] px-5 py-2.5 font-display text-base font-extrabold tracking-wider text-[#EAE7E0] uppercase transition-colors hover:border-[#EAE7E0]/60 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            <span>Back to Review</span>
          </button>

          <button
            type="button"
            disabled={isSubmitting}
            onClick={onSubmitUpiProof}
            className="neon-cta-breathe inline-flex min-h-[44px] cursor-pointer items-center gap-2.5 border border-[#FF1744] bg-[#FF1744] px-6 py-2.5 font-display text-lg font-extrabold tracking-wider text-[#EAE7E0] uppercase transition-all duration-200 hover:bg-[#ff2b54] hover:shadow-[0_0_30px_rgba(255,23,68,0.75)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                <span>
                  {status === 'preparing_registration'
                    ? 'Saving Registration...'
                    : `Uploading Proof (${uploadProgress}%)`}
                </span>
              </>
            ) : (
              <>
                <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                <span>Submit Registration &amp; Proof</span>
              </>
            )}
          </button>
        </div>
      </motion.div>
    );
  }

  if (status === 'creating_order' || status === 'opening_checkout' || status === 'processing') {
    const statusHeadline =
      status === 'creating_order'
        ? 'Creating Razorpay Order'
        : status === 'opening_checkout'
          ? 'Opening Razorpay Checkout'
          : 'Checking Verification Status';

    const statusDescription =
      status === 'creating_order'
        ? 'Generating a secure Razorpay order ID from the backend...'
        : status === 'opening_checkout'
          ? 'Launching official Razorpay Checkout. Complete your payment in the popup window...'
          : message || 'Checking payment verification status with the backend...';

    return (
      <div className="flex min-h-[320px] flex-col items-center justify-center px-4 py-10 text-center">
        <div className="flex h-16 w-16 items-center justify-center border border-[#FF1744]/50 bg-[#12060A] shadow-[0_0_28px_rgba(255,23,68,0.28)]">
          <Loader2 className="h-8 w-8 animate-spin text-[#FF1744]" aria-hidden="true" />
        </div>
        <p className="mt-6 font-mono-num text-xs font-semibold tracking-[0.22em] text-[#C8F36B] uppercase">
          Please Wait · Do Not Refresh
        </p>
        <h3 className="mt-2 font-display text-4xl font-black tracking-tight text-[#EAE7E0] uppercase">
          {statusHeadline}
        </h3>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-[#EAE7E0]/75">
          {statusDescription}
        </p>
      </div>
    );
  }

  if (status === 'submitted_pending') {
    const displayRegId =
      proofResult?.registrationId || cachedRegistration?.registrationId || 'Pending ID';
    const displayUtr = proofResult?.utr || utr.trim();
    const displayProofStatus =
      proofResult?.proofStatus ||
      (proofFile ? `Submitted (${proofFile.name})` : 'Submitted for Verification');

    return (
      <div className="py-2">
        <div className="border border-[#FF6D00]/55 bg-[#0C0706] p-6 shadow-[0_0_32px_rgba(255,109,0,0.16)] sm:p-8">
          <div className="flex items-start gap-3">
            <Clock className="mt-0.5 h-8 w-8 shrink-0 text-[#FF6D00]" aria-hidden="true" />
            <div>
              <h3 className="font-display text-4xl font-black tracking-tight text-[#EAE7E0] uppercase">
                REGISTRATION SUBMITTED
              </h3>
              <p className="mt-1 font-mono-num text-xs font-bold tracking-[0.2em] text-[#FF6D00] uppercase">
                Payment Status: PENDING VERIFICATION
              </p>
            </div>
          </div>

          <p className="mt-4 text-sm leading-relaxed text-[#EAE7E0]/80">
            Your registration details, UTR, and payment proof have been received. An ALFAAZ
            organizer will verify your payment from the admin dashboard shortly.
          </p>

          <dl className="mt-6 divide-y divide-[#EAE7E0]/12 border-t border-b border-[#EAE7E0]/15">
            <ReviewRow label="Registration ID" value={displayRegId} highlightLime />
            <ReviewRow
              label="Name / Team Name"
              value={formData.teamOrIndividualName || formData.fullName}
            />
            <ReviewRow label="Category" value={formData.categories.join(', ')} />
            <ReviewRow label="Entry Type" value={pass.label} />
            <ReviewRow label="Amount Paid / Expected" value={pass.priceDisplay} highlightLime />
            <ReviewRow label="UTR" value={displayUtr} />
            <ReviewRow label="Submitted Payment Proof Status" value={displayProofStatus} />
          </dl>

          {message && (
            <p className="mt-4 border border-[#00E5FF]/35 bg-[#050A0D] px-3.5 py-2.5 text-xs text-[#00E5FF]">
              {message}
            </p>
          )}

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={onCheckPending}
              className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 border border-[#FF6D00] bg-[#FF6D00] px-5 py-2.5 font-display text-lg font-extrabold tracking-wider text-[#050505] uppercase transition-colors hover:bg-[#ff8529]"
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              <span>Check Verification Status</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 border border-[#EAE7E0]/25 bg-[#050505] px-5 py-2.5 font-display text-base font-extrabold tracking-wider text-[#EAE7E0] uppercase transition-colors hover:border-[#EAE7E0]/60"
            >
              <span>Close</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'success' && verificationResult) {
    const confirmedPass = ENTRY_PASS_OPTIONS[verificationResult.entryType] ?? pass;
    return (
      <div className="py-4">
        <div className="border border-[#C8F36B]/55 bg-[#081009] p-6 shadow-[0_0_32px_rgba(200,243,107,0.16)] sm:p-8">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-8 w-8 shrink-0 text-[#C8F36B]" aria-hidden="true" />
            <div>
              <p className="font-mono-num text-xs font-bold tracking-[0.22em] text-[#C8F36B] uppercase">
                Backend Payment Verified
              </p>
              <h3 className="font-display text-4xl font-black tracking-tight text-[#EAE7E0] uppercase">
                PAYMENT SUCCESSFUL!
              </h3>
            </div>
          </div>

          <p className="mt-4 text-base font-medium leading-relaxed text-[#C8F36B]">
            Your entry pass will be delivered to your registered email within 24 hours.
          </p>

          <dl className="mt-6 divide-y divide-[#EAE7E0]/12 border-t border-b border-[#EAE7E0]/15">
            <ReviewRow
              label="Registration / Reference ID"
              value={verificationResult.referenceId || verificationResult.registrationId}
              highlightLime
            />
            <ReviewRow
              label="Name / Team Name"
              value={verificationResult.participantOrTeamName || formData.teamOrIndividualName}
            />
            <ReviewRow label="Category" value={formData.categories.join(', ')} />
            <ReviewRow label="Entry Type" value={confirmedPass.label} />
            <ReviewRow
              label="Amount Paid"
              value={`₹${verificationResult.amountPaid}`}
              highlightLime
            />
            {(verificationResult.utr || utr.trim()) && (
              <ReviewRow label="UTR" value={verificationResult.utr || utr.trim()} />
            )}
            <ReviewRow
              label="Payment Status"
              value={verificationResult.verifiedStatusLabel || 'Verified & Paid'}
            />
          </dl>

          <div className="mt-6 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 border border-[#C8F36B] bg-[#C8F36B] px-6 py-2.5 font-display text-lg font-extrabold tracking-wider text-[#050505] uppercase transition-colors hover:bg-[#d6f88c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EAE7E0]"
            >
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              <span>Done</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'pending') {
    return (
      <div className="py-4">
        <div className="border border-[#00E5FF]/50 bg-[#050A0D] p-6 sm:p-8">
          <div className="flex items-center gap-3">
            <Clock className="h-8 w-8 shrink-0 text-[#00E5FF]" aria-hidden="true" />
            <div>
              <p className="font-mono-num text-xs font-bold tracking-[0.22em] text-[#00E5FF] uppercase">
                Awaiting Final Verification
              </p>
              <h3 className="font-display text-4xl font-black tracking-tight text-[#EAE7E0] uppercase">
                PAYMENT PENDING
              </h3>
            </div>
          </div>

          <p className="mt-4 text-sm leading-relaxed text-[#EAE7E0]/80">
            {message ||
              'Your payment has not yet been marked as confirmed by our backend. Your registration details are saved—do not pay twice before checking status.'}
          </p>

          {(cachedRegistration || cachedOrder) && (
            <div className="mt-4 border border-[#EAE7E0]/15 bg-[#050505] p-3.5 font-mono-num text-xs text-[#EAE7E0]/75">
              {cachedRegistration && (
                <p>Registration ID: {cachedRegistration.registrationId}</p>
              )}
              {cachedOrder && <p className="mt-1">Order ID: {cachedOrder.orderId}</p>}
            </div>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onCheckPending}
              className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 border border-[#00E5FF] bg-[#00E5FF] px-5 py-2.5 font-display text-lg font-extrabold tracking-wider text-[#050505] uppercase transition-colors hover:bg-[#33ecff]"
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              <span>Check Payment Status</span>
            </button>
            <button
              type="button"
              onClick={onBackToReview}
              className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 border border-[#EAE7E0]/25 bg-[#050505] px-5 py-2.5 font-display text-base font-extrabold tracking-wider text-[#EAE7E0] uppercase transition-colors hover:border-[#EAE7E0]/60"
            >
              <span>Back to Review</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Failed, Cancelled, or Network/API Error — preserve all registration data and allow immediate retry
  const isCancelled = status === 'cancelled';
  const isError = status === 'error';
  const headline = isCancelled
    ? 'PAYMENT CANCELLED'
    : isError
      ? 'PAYMENT CONNECTION ERROR'
      : 'PAYMENT FAILED';

  return (
    <div className="py-4">
      <div className="border border-[#FF1744]/55 bg-[#110609] p-6 sm:p-8">
        <div className="flex items-center gap-3">
          {isCancelled || isError ? (
            <AlertTriangle className="h-8 w-8 shrink-0 text-[#FF1744]" aria-hidden="true" />
          ) : (
            <XCircle className="h-8 w-8 shrink-0 text-[#FF1744]" aria-hidden="true" />
          )}
          <div>
            <p className="font-mono-num text-xs font-bold tracking-[0.22em] text-[#FF1744] uppercase">
              {isCancelled
                ? 'Checkout Dismissed'
                : isError
                  ? backendReady
                    ? 'Backend / Network Issue'
                    : 'Backend Setup Required'
                  : 'Transaction Unsuccessful'}
            </p>
            <h3 className="font-display text-4xl font-black tracking-tight text-[#EAE7E0] uppercase">
              {headline}
            </h3>
          </div>
        </div>

        <p className="mt-4 text-sm leading-relaxed text-[#EAE7E0]/80">
          {message ||
            'Payment was not completed. All of your entered registration details are still saved—you can retry payment without re-entering your information.'}
        </p>

        <div className="mt-5 border border-[#EAE7E0]/12 bg-[#050505] p-3.5 text-xs text-[#EAE7E0]/75">
          <span className="font-mono-num uppercase text-[#C8F36B]">Saved Entry:</span>{' '}
          {pass.label} ({pass.priceDisplay}) · {formData.teamOrIndividualName || formData.fullName}
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onRetry}
            className="neon-cta-breathe inline-flex min-h-[44px] cursor-pointer items-center gap-2 border border-[#FF1744] bg-[#FF1744] px-6 py-2.5 font-display text-lg font-extrabold tracking-wider text-[#EAE7E0] uppercase transition-colors hover:bg-[#ff2b54]"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            <span>Retry Payment</span>
          </button>

          <button
            type="button"
            onClick={onBackToReview}
            className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 border border-[#EAE7E0]/25 bg-[#050505] px-5 py-2.5 font-display text-base font-extrabold tracking-wider text-[#EAE7E0] uppercase transition-colors hover:border-[#EAE7E0]/60"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            <span>Edit / Review Details</span>
          </button>
        </div>
      </div>
    </div>
  );
}
