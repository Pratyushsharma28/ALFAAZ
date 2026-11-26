import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ArrowRight, X } from 'lucide-react';

export const DEFAULT_POSTER_SRC =
  '/assets/aistudio/WhatsApp_Image_2026-11-26_at_22.31.51_c0257602.jpeg';
export const DEFAULT_STORAGE_KEY = 'alfaaz_intro_poster_seen';

const CINEMATIC_EASE = [0.22, 1, 0.36, 1] as const;
const POETRY_WORDS = ['WORDS', 'SOUL', 'FEEL', 'EXPRESS'] as const;
const EQUALIZER_BARS = [0.42, 0.85, 0.58, 1, 0.66, 0.9, 0.48];

export interface IntroPopupProps {
  /** Path to the exact uploaded poster asset */
  posterSrc?: string;
  /** Accessible description of the poster */
  posterAlt?: string;
  /** sessionStorage key used to show the popup once per tab session */
  storageKey?: string;
  /** Optional controlled open state (e.g., when re-opening manually) */
  isOpen?: boolean;
  /** Called when the popup closes */
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
    // Ignore storage errors in restricted browsing contexts
  }
}

export function IntroPopup({
  posterSrc = DEFAULT_POSTER_SRC,
  posterAlt = 'ALFAAZ — UNFILTERED official event poster: 18 Dec, 4 to 9 PM at Quad AI Bengaluru. Dance, Sing, Poetry. Hosted by Social & Cultural Team.',
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
  const [isEnteringSweep, setIsEnteringSweep] = useState(false);
  const [isButtonHovered, setIsButtonHovered] = useState(false);

  // Interactive artistic elements state
  const [singActive, setSingActive] = useState(false);
  const [poetryHovered, setPoetryHovered] = useState(false);
  const [poetryIndex, setPoetryIndex] = useState(0);
  const [danceActive, setDanceActive] = useState(false);

  const shouldReduceMotion = useReducedMotion();
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const sweepTimeoutRef = useRef<number | null>(null);

  const visible = isControlled ? isOpen : internalOpen;

  const finalizeClose = useCallback(() => {
    if (sweepTimeoutRef.current) {
      window.clearTimeout(sweepTimeoutRef.current);
      sweepTimeoutRef.current = null;
    }
    setIsEnteringSweep(false);
    markIntroSeenInSession(storageKey);
    if (!isControlled) {
      setInternalOpen(false);
    }
    onClose?.();
  }, [isControlled, onClose, storageKey]);

  const handleEnterExperience = useCallback(() => {
    if (isEnteringSweep) return;
    if (shouldReduceMotion) {
      finalizeClose();
      return;
    }
    setIsEnteringSweep(true);
    sweepTimeoutRef.current = window.setTimeout(() => {
      finalizeClose();
    }, 460);
  }, [finalizeClose, isEnteringSweep, shouldReduceMotion]);

  // Reset sweep state cleanly when reopened
  useEffect(() => {
    if (visible) {
      setIsEnteringSweep(false);
    }
    return () => {
      if (sweepTimeoutRef.current) {
        window.clearTimeout(sweepTimeoutRef.current);
      }
    };
  }, [visible]);

  // Subtle restrained poetry word cycle while popup is open
  useEffect(() => {
    if (!visible || shouldReduceMotion) return;
    const interval = window.setInterval(() => {
      setPoetryIndex((prev) => (prev + 1) % POETRY_WORDS.length);
    }, 2800);
    return () => window.clearInterval(interval);
  }, [visible, shouldReduceMotion]);

  // Prevent background scrolling while popup is open
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

  // Keyboard Escape support and accessible focus management
  useEffect(() => {
    if (!visible) return;

    previousFocusRef.current = document.activeElement as HTMLElement | null;

    const focusTimer = window.setTimeout(() => {
      closeButtonRef.current?.focus();
    }, 40);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        finalizeClose();
      }
    };

    window.addEventListener('keydown', onKeyDown);

    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener('keydown', onKeyDown);
      previousFocusRef.current?.focus?.();
    };
  }, [visible, finalizeClose]);

  const currentWord = POETRY_WORDS[poetryIndex];

  return (
    <AnimatePresence mode="wait">
      {visible && (
        <motion.div
          key="alfaaz-intro-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="ALFAAZ — UNFILTERED introductory event poster"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={
            shouldReduceMotion
              ? { duration: 0.01 }
              : { duration: 0.45, ease: CINEMATIC_EASE }
          }
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              finalizeClose();
            }
          }}
          className="fixed inset-0 z-50 flex h-[100dvh] w-screen items-center justify-center overflow-y-auto overflow-x-hidden bg-black px-4 py-5 sm:p-6 md:p-8"
        >
          {/* Layer 1: Background fade from pure black into deep crimson ambient glow */}
          <motion.div
            aria-hidden="true"
            initial={{ opacity: 0 }}
            animate={{ opacity: isEnteringSweep ? 1 : 0.9 }}
            exit={{ opacity: 0 }}
            transition={
              shouldReduceMotion
                ? { duration: 0.01 }
                : { duration: 1.0, ease: CINEMATIC_EASE }
            }
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                'radial-gradient(circle at 50% 42%, rgba(164, 16, 52, 0.36) 0%, rgba(164, 16, 52, 0.12) 38%, rgba(0, 0, 0, 0) 72%)',
            }}
          />

          {/* Layer 2: Very subtle animated 35mm grain texture */}
          <div
            aria-hidden="true"
            className="grain-overlay grain-animated pointer-events-none absolute -inset-6 opacity-[0.055]"
          />

          {/* Layer 3: Subtle crimson light sweep when ENTER THE EXPERIENCE is clicked */}
          <AnimatePresence>
            {isEnteringSweep && !shouldReduceMotion && (
              <motion.div
                aria-hidden="true"
                initial={{ x: '-110%', opacity: 0.2 }}
                animate={{ x: '110%', opacity: 0.95 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.46, ease: CINEMATIC_EASE }}
                className="pointer-events-none fixed inset-y-0 left-0 z-20 w-[75vw]"
                style={{
                  background:
                    'linear-gradient(105deg, transparent 0%, rgba(164, 16, 52, 0.25) 35%, rgba(164, 16, 52, 0.65) 50%, rgba(234, 231, 224, 0.16) 54%, transparent 100%)',
                }}
              />
            )}
          </AnimatePresence>

          {/* Minimal Top-Right Close (X) Button */}
          <motion.button
            ref={closeButtonRef}
            type="button"
            onClick={finalizeClose}
            aria-label="Close introductory poster"
            whileHover={shouldReduceMotion ? undefined : { scale: 1.08, rotate: 90 }}
            whileTap={shouldReduceMotion ? undefined : { scale: 0.92 }}
            transition={{ duration: 0.2, ease: CINEMATIC_EASE }}
            className="fixed top-4 right-4 z-30 flex h-11 w-11 min-h-[44px] min-w-[44px] cursor-pointer items-center justify-center rounded-full border border-[#EAE7E0]/20 bg-black/75 text-[#EAE7E0]/85 backdrop-blur-sm transition-all duration-200 hover:border-[#FF1744] hover:bg-[#FF1744] hover:text-[#EAE7E0] hover:shadow-[0_0_18px_rgba(255,23,68,0.65)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF1744] focus-visible:ring-offset-2 focus-visible:ring-offset-black sm:top-6 sm:right-6"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </motion.button>

          {/* Main Centered Poster + Interactive Trio + CTA Stack */}
          <motion.div
            initial={
              shouldReduceMotion
                ? { opacity: 0 }
                : { opacity: 0, scale: 0.94, filter: 'blur(8px)' }
            }
            animate={
              shouldReduceMotion
                ? { opacity: 1 }
                : isEnteringSweep
                  ? { opacity: 0.35, scale: 0.97, filter: 'blur(2px)' }
                  : { opacity: 1, scale: 1, filter: 'blur(0px)' }
            }
            exit={
              shouldReduceMotion
                ? { opacity: 0 }
                : { opacity: 0, scale: 0.96, filter: 'blur(4px)' }
            }
            transition={
              shouldReduceMotion
                ? { duration: 0.01 }
                : { duration: 0.72, ease: CINEMATIC_EASE }
            }
            onClick={(e) => e.stopPropagation()}
            className="relative z-10 my-auto flex w-full max-w-[660px] flex-col items-center justify-center gap-4 sm:gap-5"
          >
            {/* Centered Poster with Subtle Floating Effect after appearing */}
            <motion.div
              animate={
                shouldReduceMotion || isEnteringSweep
                  ? { y: 0 }
                  : { y: [0, -4, 0] }
              }
              transition={
                shouldReduceMotion || isEnteringSweep
                  ? { duration: 0.2 }
                  : {
                      duration: 6,
                      repeat: Infinity,
                      ease: 'easeInOut',
                      delay: 0.8,
                    }
              }
              className="relative flex items-center justify-center"
            >
              {/* Soft crimson halo strictly behind poster on desktop */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -inset-4 hidden rounded-sm bg-[#A41034]/20 blur-2xl md:block"
              />

              {!imageError ? (
                <img
                  src={posterSrc}
                  alt={posterAlt}
                  referrerPolicy="no-referrer"
                  onError={() => setImageError(true)}
                  className="relative block h-auto w-auto max-h-[50dvh] max-w-[90vw] object-contain select-none sm:max-h-[54dvh] md:max-h-[58dvh] md:max-w-[540px] md:shadow-[0_24px_80px_rgba(164,16,52,0.38),0_12px_36px_rgba(0,0,0,0.9)]"
                />
              ) : (
                <div className="relative flex aspect-[4/5] w-[min(82vw,380px)] flex-col items-center justify-center border border-[#EAE7E0]/20 bg-black p-8 text-center text-[#EAE7E0]">
                  <p className="font-display text-4xl font-black tracking-tight uppercase">
                    ALFAAZ — UNFILTERED
                  </p>
                  <p className="mt-2 text-sm text-[#EAE7E0]/75">
                    18 Dec 2026 · Quad AI, Bengaluru
                  </p>
                </div>
              )}
            </motion.div>

            {/* Interactive Artistic Trio: SING · POETRY · DANCE */}
            <div
              aria-label="Interactive artistic discipline previews"
              className="grid w-full max-w-[min(92vw,540px)] grid-cols-3 divide-x divide-[#EAE7E0]/12 border-t border-b border-[#EAE7E0]/12 bg-black/55 backdrop-blur-xs"
            >
              {/* 1. SING: Minimal Soundwave / Equalizer */}
              <button
                type="button"
                onMouseEnter={() => setSingActive(true)}
                onMouseLeave={() => setSingActive(false)}
                onFocus={() => setSingActive(true)}
                onBlur={() => setSingActive(false)}
                onClick={() => setSingActive((prev) => !prev)}
                aria-label="Singing discipline soundwave preview"
                className="group flex cursor-pointer flex-col items-center justify-center gap-1.5 px-2 py-2.5 transition-colors duration-200 hover:bg-[#FF1744]/10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#FF1744] sm:py-3"
              >
                <div className="flex h-5 items-end justify-center gap-[3px]" aria-hidden="true">
                  {EQUALIZER_BARS.map((peak, index) => (
                    <motion.span
                      key={index}
                      className={`w-[2px] origin-bottom transition-all duration-200 ${
                        singActive
                          ? 'bg-[#C8F36B] shadow-[0_0_8px_rgba(200,243,107,0.7)]'
                          : 'bg-[#FF1744] shadow-[0_0_6px_rgba(255,23,68,0.55)]'
                      }`}
                      style={{ height: '18px' }}
                      animate={
                        shouldReduceMotion
                          ? { scaleY: peak * 0.7 }
                          : {
                              scaleY: singActive
                                ? [peak * 0.45, Math.min(1, peak * 1.1), peak * 0.35]
                                : [peak * 0.3, peak * 0.8, peak * 0.35],
                            }
                      }
                      transition={
                        shouldReduceMotion
                          ? { duration: 0 }
                          : {
                              duration: singActive ? 0.65 + index * 0.08 : 1.3 + index * 0.14,
                              repeat: Infinity,
                              ease: 'easeInOut',
                            }
                      }
                    />
                  ))}
                </div>
                <span className="font-mono-num text-[10px] tracking-[0.22em] text-[#EAE7E0]/75 uppercase transition-colors group-hover:text-[#EAE7E0]">
                  Sing
                </span>
              </button>

              {/* 2. POETRY: Floating / Restrained Word Reveal */}
              <button
                type="button"
                onMouseEnter={() => {
                  setPoetryHovered(true);
                  setPoetryIndex((prev) => (prev + 1) % POETRY_WORDS.length);
                }}
                onMouseLeave={() => setPoetryHovered(false)}
                onFocus={() => setPoetryHovered(true)}
                onBlur={() => setPoetryHovered(false)}
                onClick={() => setPoetryIndex((prev) => (prev + 1) % POETRY_WORDS.length)}
                aria-label={`Poetry discipline word reveal: ${currentWord}`}
                className="group flex cursor-pointer flex-col items-center justify-center gap-1.5 px-2 py-2.5 transition-colors duration-200 hover:bg-[#D500F9]/10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#D500F9] sm:py-3"
              >
                <div className="flex h-5 items-center justify-center overflow-hidden">
                  <AnimatePresence mode="wait">
                    <motion.span
                      key={currentWord}
                      initial={
                        shouldReduceMotion
                          ? { opacity: 1 }
                          : { opacity: 0, y: 6, letterSpacing: '0.32em' }
                      }
                      animate={{
                        opacity: 1,
                        y: 0,
                        letterSpacing: poetryHovered ? '0.28em' : '0.2em',
                      }}
                      exit={
                        shouldReduceMotion
                          ? { opacity: 0 }
                          : { opacity: 0, y: -6 }
                      }
                      transition={
                        shouldReduceMotion
                          ? { duration: 0.01 }
                          : { duration: 0.32, ease: CINEMATIC_EASE }
                      }
                      className={`font-mono-num text-[11px] font-medium uppercase transition-colors ${
                        poetryHovered ? 'text-[#D500F9] neon-text-purple' : 'text-[#EAE7E0]'
                      }`}
                    >
                      {currentWord}
                    </motion.span>
                  </AnimatePresence>
                </div>
                <span className="font-mono-num text-[10px] tracking-[0.22em] text-[#EAE7E0]/75 uppercase transition-colors group-hover:text-[#EAE7E0]">
                  Poetry
                </span>
              </button>

              {/* 3. DANCE: Abstract Crimson Motion Trails / Kinetic Visual */}
              <button
                type="button"
                onMouseEnter={() => setDanceActive(true)}
                onMouseLeave={() => setDanceActive(false)}
                onFocus={() => setDanceActive(true)}
                onBlur={() => setDanceActive(false)}
                onClick={() => setDanceActive((prev) => !prev)}
                aria-label="Dance discipline kinetic motion preview"
                className="group flex cursor-pointer flex-col items-center justify-center gap-1.5 px-2 py-2.5 transition-colors duration-200 hover:bg-[#00E5FF]/10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#00E5FF] sm:py-3"
              >
                <div className="relative flex h-5 w-16 items-center justify-center" aria-hidden="true">
                  <svg
                    viewBox="0 0 64 20"
                    className="h-5 w-16 overflow-visible"
                    fill="none"
                  >
                    <motion.path
                      d="M4 13 C 16 2, 26 18, 38 7 C 46 0, 54 14, 60 6"
                      stroke={danceActive ? '#C8F36B' : '#00E5FF'}
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      animate={
                        shouldReduceMotion
                          ? undefined
                          : {
                              d: danceActive
                                ? [
                                    'M4 13 C 16 2, 26 18, 38 7 C 46 0, 54 14, 60 6',
                                    'M4 7 C 16 18, 28 2, 38 13 C 48 18, 54 3, 60 12',
                                    'M4 13 C 16 2, 26 18, 38 7 C 46 0, 54 14, 60 6',
                                  ]
                                : [
                                    'M4 11 C 18 5, 28 15, 40 9 C 48 5, 54 12, 60 8',
                                    'M4 9 C 18 14, 28 6, 40 11 C 48 15, 54 7, 60 10',
                                    'M4 11 C 18 5, 28 15, 40 9 C 48 5, 54 12, 60 8',
                                  ],
                            }
                      }
                      transition={
                        shouldReduceMotion
                          ? undefined
                          : {
                              duration: danceActive ? 1.1 : 2.8,
                              repeat: Infinity,
                              ease: 'easeInOut',
                            }
                      }
                    />
                    <motion.circle
                      r={danceActive ? 2.2 : 1.7}
                      fill="#EAE7E0"
                      animate={
                        shouldReduceMotion
                          ? { cx: 32, cy: 10 }
                          : {
                              cx: danceActive ? [6, 32, 58, 32, 6] : [10, 32, 54, 32, 10],
                              cy: danceActive ? [12, 5, 9, 14, 12] : [10, 8, 10, 12, 10],
                            }
                      }
                      transition={
                        shouldReduceMotion
                          ? undefined
                          : {
                              duration: danceActive ? 1.5 : 3.4,
                              repeat: Infinity,
                              ease: 'easeInOut',
                            }
                      }
                    />
                  </svg>
                </div>
                <span className="font-mono-num text-[10px] tracking-[0.22em] text-[#EAE7E0]/75 uppercase transition-colors group-hover:text-[#EAE7E0]">
                  Dance
                </span>
              </button>
            </div>

            {/* Elegant ENTER THE EXPERIENCE Button */}
            <motion.button
              type="button"
              disabled={isEnteringSweep}
              onClick={handleEnterExperience}
              onMouseEnter={() => setIsButtonHovered(true)}
              onMouseLeave={() => setIsButtonHovered(false)}
              whileHover={shouldReduceMotion ? undefined : { y: -1 }}
              whileTap={shouldReduceMotion ? undefined : { scale: 0.985 }}
              transition={{ duration: 0.2, ease: CINEMATIC_EASE }}
              aria-label="Enter the ALFAAZ — UNFILTERED experience"
              className="group relative inline-flex min-h-[48px] shrink-0 cursor-pointer items-center gap-3 border border-[#FF1744] bg-[#050505] px-7 py-3 font-display text-lg font-extrabold tracking-[0.18em] text-[#EAE7E0] uppercase shadow-[0_0_20px_rgba(255,23,68,0.28)] transition-all duration-200 hover:border-[#FF1744] hover:bg-[#FF1744] hover:shadow-[0_0_32px_rgba(255,23,68,0.75)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF1744] focus-visible:ring-offset-2 focus-visible:ring-offset-black disabled:pointer-events-none whitespace-nowrap sm:px-8 sm:text-xl"
            >
              <span>ENTER THE EXPERIENCE</span>
              <motion.span
                aria-hidden="true"
                animate={
                  shouldReduceMotion
                    ? undefined
                    : { x: isButtonHovered ? 4 : 0 }
                }
                transition={{ duration: 0.2, ease: CINEMATIC_EASE }}
                className="inline-flex items-center text-[#C8F36B] transition-colors group-hover:text-[#EAE7E0]"
              >
                <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5" />
              </motion.span>
            </motion.button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
