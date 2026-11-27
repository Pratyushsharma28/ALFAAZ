import { KeyboardEvent as ReactKeyboardEvent, useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ArrowRight, X } from 'lucide-react';
import { EDITORIAL_EASE } from './MotionPrimitives';

export const DEFAULT_POSTER_SRC =
  '/assets/aistudio/WhatsApp_Image_2026-11-27_at_17.46.32_332ca6ed.jpeg';
export const DEFAULT_STORAGE_KEY = 'alfaaz_intro_poster_seen';

const ENTRANCE_EASE = EDITORIAL_EASE;
const EXIT_EASE = [0.4, 0, 0.2, 1] as const;

export interface IntroPopupProps {
  /** Path to the exact uploaded event poster asset */
  posterSrc?: string;
  /** Accessible description of the event poster */
  posterAlt?: string;
  /** sessionStorage key used to auto-show the popup once per browser session */
  storageKey?: string;
  /** Optional controlled open state (e.g., when triggered from Hero/Footer) */
  isOpen?: boolean;
  /** Called when the popup requests to close */
  onClose?: () => void;
}

function hasSeenIntroInSession(storageKey: string): boolean {
  try {
    return window.sessionStorage.getItem(storageKey) === 'true';
  } catch {
    return false;
  }
}

function markIntroSeenInSession(storageKey: string): void {
  try {
    window.sessionStorage.setItem(storageKey, 'true');
  } catch {
    // Ignore storage errors in restricted browsing modes
  }
}

export function IntroPopup({
  posterSrc = DEFAULT_POSTER_SRC,
  posterAlt = 'ALFAAZ — UNFILTERED Inter-College Cultural Event official poster. 18 Dec 2026, 4:00 PM to 9:00 PM at Quad AI, 27th Main HSR, Bangalore. Categories: Dance, Singing, Poetry. Prizes: ₹5,000, ₹3,000, ₹2,000. Early Bird Entry: ₹99 Solo, ₹149 Couple, ₹199 Group. Certificate, Goodies and Cash Prize.',
  storageKey = DEFAULT_STORAGE_KEY,
  isOpen,
  onClose,
}: IntroPopupProps) {
  const isControlled = typeof isOpen === 'boolean';
  const [internalOpen, setInternalOpen] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return !hasSeenIntroInSession(storageKey);
  });
  const [imageError, setImageError] = useState(false);

  const shouldReduceMotion = useReducedMotion();
  const modalCardRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const visible = isControlled ? isOpen : internalOpen;

  const handleClose = useCallback(() => {
    markIntroSeenInSession(storageKey);
    if (!isControlled) {
      setInternalOpen(false);
    }
    onClose?.();
  }, [isControlled, onClose, storageKey]);

  // Mark session as seen as soon as the popup opens so reloads in the same session do not repeat it
  useEffect(() => {
    if (visible) {
      markIntroSeenInSession(storageKey);
      setImageError(false);
    }
  }, [visible, storageKey]);

  // Prevent background page scroll while modal is open
  useEffect(() => {
    if (!visible) return;

    const prevBodyOverflow = document.body.style.overflow;
    const prevHtmlOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = prevBodyOverflow;
      document.documentElement.style.overflow = prevHtmlOverflow;
    };
  }, [visible]);

  // Accessible focus management and Escape key dismissal
  useEffect(() => {
    if (!visible) return;

    previousFocusRef.current = document.activeElement as HTMLElement | null;

    const focusTimer = window.setTimeout(() => {
      closeButtonRef.current?.focus();
    }, 50);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        handleClose();
      }
    };

    window.addEventListener('keydown', onKeyDown);

    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener('keydown', onKeyDown);
      previousFocusRef.current?.focus?.();
    };
  }, [visible, handleClose]);

  // Trap keyboard Tab focus inside the active modal dialog
  const handleModalKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Tab' || !modalCardRef.current) return;

    const focusable = Array.from(
      modalCardRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
    );

    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <AnimatePresence mode="wait">
      {visible && (
        <motion.div
          key="alfaaz-poster-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="ALFAAZ — UNFILTERED official event poster"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{
            opacity: 0,
            transition: shouldReduceMotion
              ? { duration: 0.01 }
              : { duration: 0.28, ease: EXIT_EASE },
          }}
          transition={
            shouldReduceMotion
              ? { duration: 0.01 }
              : { duration: 0.36, ease: ENTRANCE_EASE }
          }
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              handleClose();
            }
          }}
          style={{
            paddingTop: 'max(0.75rem, env(safe-area-inset-top))',
            paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))',
            paddingLeft: 'max(0.75rem, env(safe-area-inset-left))',
            paddingRight: 'max(0.75rem, env(safe-area-inset-right))',
          }}
          className="fixed inset-0 z-50 flex h-[100dvh] w-screen items-center justify-center overflow-x-hidden overflow-y-auto bg-[#050505]/86 backdrop-blur-md sm:p-6"
        >
          {/* Ambient radial stage vignette on backdrop */}
          <motion.div
            aria-hidden="true"
            initial={shouldReduceMotion ? { opacity: 0.85 } : { opacity: 0 }}
            animate={{ opacity: 0.9 }}
            exit={{ opacity: 0 }}
            transition={
              shouldReduceMotion
                ? { duration: 0.01 }
                : { duration: 0.55, ease: ENTRANCE_EASE }
            }
            className="pointer-events-none fixed inset-0"
            style={{
              background:
                'radial-gradient(circle at 50% 48%, rgba(255, 23, 68, 0.14) 0%, rgba(200, 243, 107, 0.05) 34%, rgba(5, 5, 5, 0.96) 76%)',
            }}
          />

          {/* Centered Modal Wrapper (hosts GPU-friendly delayed neon pink + lime perimeter glow) */}
          <motion.div
            ref={modalCardRef}
            onKeyDown={handleModalKeyDown}
            onClick={(e) => e.stopPropagation()}
            initial={
              shouldReduceMotion
                ? { opacity: 0 }
                : { opacity: 0, scale: 0.94, y: 18 }
            }
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={
              shouldReduceMotion
                ? { opacity: 0 }
                : {
                    opacity: 0,
                    scale: 0.95,
                    y: 12,
                    transition: { duration: 0.26, ease: EXIT_EASE },
                  }
            }
            transition={
              shouldReduceMotion
                ? { duration: 0.01 }
                : { duration: 0.48, ease: ENTRANCE_EASE }
            }
            className="relative z-10 my-auto flex w-auto max-w-[calc(100vw-1.5rem)] flex-col will-change-transform sm:max-w-[min(90vw,560px)]"
          >
            {/* Subtle neon pink & lime glow that animates gently AFTER the popup settles */}
            <motion.div
              aria-hidden="true"
              initial={shouldReduceMotion ? { opacity: 0.45 } : { opacity: 0, scale: 0.97 }}
              animate={
                shouldReduceMotion
                  ? { opacity: 0.45 }
                  : { opacity: [0, 0.72, 0.56], scale: 1 }
              }
              exit={{
                opacity: 0,
                transition: shouldReduceMotion ? { duration: 0.01 } : { duration: 0.2 },
              }}
              transition={
                shouldReduceMotion
                  ? { duration: 0.01 }
                  : { duration: 1.1, delay: 0.34, ease: ENTRANCE_EASE }
              }
              className="pointer-events-none absolute -inset-3 -z-10 rounded-[24px] will-change-[transform,opacity]"
              style={{
                background:
                  'radial-gradient(circle at 22% 18%, rgba(255, 23, 68, 0.38), transparent 56%), radial-gradient(circle at 80% 82%, rgba(200, 243, 107, 0.28), transparent 58%), radial-gradient(circle at 82% 20%, rgba(0, 229, 255, 0.16), transparent 50%)',
                filter: 'blur(22px)',
              }}
            />

            {/* Main Cinematic Modal Frame */}
            <div className="relative flex flex-col overflow-hidden rounded-2xl border border-[#EAE7E0]/16 bg-[#070709] shadow-[0_28px_80px_rgba(0,0,0,0.92),0_0_32px_rgba(255,23,68,0.16),0_0_24px_rgba(200,243,107,0.1)]">
              {/* Top Neon Accent Hairline */}
              <div
                aria-hidden="true"
                className="h-[2px] w-full shrink-0 bg-gradient-to-r from-[#FF1744] via-[#C8F36B] to-[#00E5FF]"
              />

              {/* Compact Header Bar with High-Contrast Accessible Close Button */}
              <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[#EAE7E0]/10 bg-[#0A0A0D]/95 px-3.5 py-2.5 sm:px-4 sm:py-3">
                <div className="min-w-0">
                  <p className="truncate font-mono-num text-[11px] font-medium tracking-[0.16em] text-[#EAE7E0]/90 uppercase">
                    ALFAAZ — UNFILTERED
                    <span className="text-[#EAE7E0]/40"> · </span>
                    <span className="text-[#C8F36B]">18 DEC 2026</span>
                  </p>
                </div>

                <button
                  ref={closeButtonRef}
                  type="button"
                  onClick={handleClose}
                  aria-label="Close event poster popup"
                  className="group inline-flex min-h-[44px] min-w-[44px] shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-[#EAE7E0]/20 bg-[#050505] px-2.5 font-mono-num text-[11px] font-semibold tracking-wider text-[#EAE7E0] uppercase transition-colors duration-150 hover:border-[#FF1744] hover:bg-[#FF1744] hover:text-[#EAE7E0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8F36B] sm:min-h-[40px] sm:min-w-[40px] sm:px-3"
                >
                  <span className="hidden sm:inline">Close</span>
                  <X
                    className="h-4 w-4 transition-transform duration-200 group-hover:rotate-90"
                    aria-hidden="true"
                  />
                </button>
              </div>

              {/* Unaltered Event Poster Stage (object-fit: contain keeps 100% of artwork & bottom event details visible) */}
              <div className="flex min-h-0 flex-1 items-center justify-center bg-[#050505] p-2.5 sm:p-3.5">
                {!imageError ? (
                  <img
                    src={posterSrc}
                    alt={posterAlt}
                    width={1086}
                    height={1448}
                    loading="lazy"
                    decoding="async"
                    referrerPolicy="no-referrer"
                    onError={() => setImageError(true)}
                    className="block h-auto w-auto max-h-[calc(100dvh-10.25rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))] max-w-full rounded-xl object-contain select-none sm:max-h-[min(74dvh,700px)]"
                  />
                ) : (
                  <div className="flex aspect-[3/4] w-[min(76vw,340px)] flex-col items-center justify-center rounded-xl border border-[#EAE7E0]/15 bg-[#08080A] p-6 text-center text-[#EAE7E0]">
                    <p className="font-display text-3xl font-black tracking-tight uppercase">
                      ALFAAZ — UNFILTERED
                    </p>
                    <p className="mt-2 font-mono-num text-xs text-[#C8F36B] uppercase">
                      18 Dec 2026 · 4:00 PM – 9:00 PM
                    </p>
                    <p className="mt-1 text-xs text-[#EAE7E0]/75">
                      Quad AI, 27th Main HSR, Bangalore
                    </p>
                  </div>
                )}
              </div>

              {/* Clean Footer Strip */}
              <div className="flex shrink-0 items-center justify-between gap-3 border-t border-[#EAE7E0]/10 bg-[#0A0A0D]/95 px-3.5 py-2.5 sm:px-4 sm:py-3">
                <p className="min-w-0 truncate text-xs text-[#EAE7E0]/70">
                  Quad AI, HSR Bangalore
                  <span className="text-[#EAE7E0]/35"> · </span>
                  <span className="text-[#00E5FF]">Dance · Singing · Poetry</span>
                </p>

                <button
                  type="button"
                  onClick={handleClose}
                  className="inline-flex min-h-[40px] shrink-0 cursor-pointer items-center gap-2 rounded-lg border border-[#C8F36B]/60 bg-[#C8F36B]/12 px-4 py-2 font-mono-num text-[11px] font-bold tracking-wider whitespace-nowrap text-[#C8F36B] uppercase transition-colors duration-150 hover:bg-[#C8F36B] hover:text-[#050505] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00E5FF]"
                >
                  <span>Enter Site</span>
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
