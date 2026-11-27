import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ArrowRight, X } from 'lucide-react';
import { EDITORIAL_EASE, useIsCompactOrTouch } from './MotionPrimitives';

export const DEFAULT_POSTER_SRC =
  '/assets/aistudio/WhatsApp_Image_2026-11-26_at_22.31.51_c0257602.jpeg';
export const DEFAULT_STORAGE_KEY = 'alfaaz_intro_poster_seen';

const CINEMATIC_EASE = EDITORIAL_EASE;
const EXIT_EASE = [0.4, 0, 0.2, 1] as const;
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
  const isCompactOrTouch = useIsCompactOrTouch();
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
    }, 380);
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
    }, 60);

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
              : {
                  duration: 0.46,
                  ease: CINEMATIC_EASE,
                }
          }
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              finalizeClose();
            }
          }}
          className="fixed inset-0 z-50 flex h-[100dvh] w-screen items-center justify-center overflow-y-auto overflow-x-hidden bg-[#050505]/94 px-3.5 py-4 md:backdrop-blur-sm sm:p-6 md:p-8"
        >
          {/* Layer 1: Gradual Crimson-Obsidian Atmospheric Lighting Reveal */}
          <motion.div
            aria-hidden="true"
            initial={
              shouldReduceMotion
                ? { opacity: 0.9 }
                : { opacity: 0, scale: 0.92 }
            }
            animate={
              shouldReduceMotion
                ? { opacity: 0.9 }
                : { opacity: isEnteringSweep ? 1 : 0.95, scale: 1 }
            }
            exit={{ opacity: 0 }}
            transition={
              shouldReduceMotion
                ? { duration: 0.01 }
                : { duration: 0.95, ease: CINEMATIC_EASE }
            }
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                'radial-gradient(circle at 50% 42%, rgba(164, 16, 52, 0.28) 0%, rgba(255, 23, 68, 0.11) 28%, rgba(12, 12, 14, 0.72) 58%, rgba(5, 5, 5, 0.98) 84%)',
            }}
          />

          {/* Layer 2: Subtle 35mm grain texture matching the main editorial canvas */}
          <div
            aria-hidden="true"
            className="grain-overlay grain-animated pointer-events-none absolute -inset-6 opacity-[0.04]"
          />

          {/* Layer 3: Refined crimson light sweep when ENTER THE EXPERIENCE is clicked */}
          <AnimatePresence>
            {isEnteringSweep && !shouldReduceMotion && (
              <motion.div
                aria-hidden="true"
                initial={{ x: '-115%', opacity: 0.15 }}
                animate={{ x: '115%', opacity: 0.9 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.42, ease: CINEMATIC_EASE }}
                className="pointer-events-none fixed inset-y-0 left-0 z-30 w-[70vw]"
                style={{
                  background:
                    'linear-gradient(105deg, transparent 0%, rgba(164, 16, 52, 0.22) 34%, rgba(255, 23, 68, 0.54) 50%, rgba(234, 231, 224, 0.14) 54%, transparent 100%)',
                }}
              />
            )}
          </AnimatePresence>

          {/* Main Framed Editorial Reveal Container */}
          <motion.div
            initial={
              shouldReduceMotion
                ? { opacity: 0 }
                : { opacity: 0, y: 20, scale: 0.94 }
            }
            animate={
              shouldReduceMotion
                ? { opacity: 1 }
                : isEnteringSweep
                  ? { opacity: 0.85, y: 0, scale: 0.985 }
                  : { opacity: 1, y: 0, scale: 1 }
            }
            exit={
              shouldReduceMotion
                ? { opacity: 0 }
                : {
                    opacity: 0,
                    y: 12,
                    scale: 0.95,
                    transition: { duration: 0.34, ease: EXIT_EASE },
                  }
            }
            transition={
              shouldReduceMotion
                ? { duration: 0.01 }
                : { duration: 0.58, ease: CINEMATIC_EASE }
            }
            onClick={(e) => e.stopPropagation()}
            className="underground-surface relative z-10 my-auto flex w-full max-w-[600px] flex-col overflow-hidden border border-[#EAE7E0]/16 bg-gradient-to-b from-[#0C0C0E]/96 via-[#08080A]/98 to-[#050505] shadow-[0_36px_100px_rgba(0,0,0,0.96),0_0_56px_rgba(164,16,52,0.22)] ring-1 ring-inset ring-[#FF1744]/12"
          >
            {/* Top Crimson Lighting Reveal Hairline */}
            <motion.div
              aria-hidden="true"
              initial={shouldReduceMotion ? { scaleX: 1 } : { scaleX: 0, opacity: 0.4 }}
              animate={{ scaleX: 1, opacity: 1 }}
              transition={
                shouldReduceMotion
                  ? { duration: 0.01 }
                  : { duration: 0.72, delay: 0.06, ease: CINEMATIC_EASE }
              }
              className="h-[2px] w-full origin-center bg-gradient-to-r from-[#A41034]/20 via-[#FF1744] to-[#A41034]/20 shadow-[0_0_12px_rgba(255,23,68,0.55)]"
            />

            {/* Stagger 1: Modal Editorial Header Bar with Minimal Accessible Close Button */}
            <motion.div
              initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={
                shouldReduceMotion
                  ? { duration: 0.01 }
                  : { duration: 0.42, delay: 0.1, ease: CINEMATIC_EASE }
              }
              className="flex items-center justify-between gap-3 border-b border-[#EAE7E0]/12 bg-[#070709]/92 px-4 py-2.5 sm:px-5 sm:py-3"
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <span
                  aria-hidden="true"
                  className="h-2 w-2 shrink-0 rounded-full bg-[#FF1744] shadow-[0_0_8px_rgba(255,23,68,0.85)]"
                />
                <p className="truncate font-mono-num text-[10px] font-medium tracking-[0.2em] text-[#EAE7E0]/85 uppercase sm:text-[11px]">
                  ALFAAZ — UNFILTERED
                  <span className="hidden text-[#EAE7E0]/45 sm:inline"> · </span>
                  <span className="hidden text-[#C8F36B] sm:inline">18 DEC 2026</span>
                </p>
              </div>

              <motion.button
                ref={closeButtonRef}
                type="button"
                onClick={finalizeClose}
                aria-label="Close introductory poster"
                whileHover={
                  shouldReduceMotion ? undefined : { y: -1, scale: 1.03 }
                }
                whileTap={shouldReduceMotion ? undefined : { scale: 0.94 }}
                transition={{ duration: 0.18, ease: CINEMATIC_EASE }}
                className="group inline-flex h-9 min-h-[36px] shrink-0 cursor-pointer items-center gap-1.5 border border-[#EAE7E0]/18 bg-[#050505] px-2.5 font-mono-num text-[10px] font-semibold tracking-[0.18em] text-[#EAE7E0]/85 uppercase transition-all duration-200 hover:border-[#FF1744]/85 hover:bg-[#FF1744] hover:text-[#EAE7E0] hover:shadow-[0_0_18px_rgba(255,23,68,0.45)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF1744] sm:h-10 sm:min-h-[40px] sm:px-3"
              >
                <span className="hidden sm:inline">Close</span>
                <X
                  className="h-4 w-4 transition-transform duration-200 group-hover:rotate-90"
                  aria-hidden="true"
                />
              </motion.button>
            </motion.div>

            {/* Stagger 2: Center Stage Chamber — Poster Harmonized Within Dark Crimson Frame */}
            <div className="relative flex flex-col items-center justify-center bg-[#060608]/85 px-4 pt-4 pb-3.5 sm:px-6 sm:pt-5 sm:pb-4">
              {/* Soft gradual crimson rim-light behind the poster */}
              <motion.div
                aria-hidden="true"
                initial={shouldReduceMotion ? { opacity: 0.7 } : { opacity: 0, scale: 0.9 }}
                animate={{ opacity: 0.78, scale: 1 }}
                transition={
                  shouldReduceMotion
                    ? { duration: 0.01 }
                    : { duration: 0.9, delay: 0.16, ease: CINEMATIC_EASE }
                }
                className="pointer-events-none absolute inset-x-10 top-6 bottom-6 hidden rounded-full blur-3xl md:block"
                style={{
                  background:
                    'radial-gradient(circle at 50% 48%, rgba(255, 23, 68, 0.22) 0%, rgba(164, 16, 52, 0.14) 48%, transparent 75%)',
                }}
              />

              <motion.div
                initial={
                  shouldReduceMotion
                    ? { opacity: 1 }
                    : { opacity: 0, y: 10, scale: 0.97 }
                }
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={
                  shouldReduceMotion
                    ? { duration: 0.01 }
                    : { duration: 0.54, delay: 0.16, ease: CINEMATIC_EASE }
                }
                className="relative flex items-center justify-center"
              >
                <motion.div
                  animate={
                    shouldReduceMotion || isEnteringSweep || isCompactOrTouch
                      ? { y: 0 }
                      : { y: [0, -3, 0] }
                  }
                  whileHover={
                    shouldReduceMotion || isEnteringSweep || isCompactOrTouch
                      ? undefined
                      : { scale: 1.012 }
                  }
                  transition={
                    shouldReduceMotion || isEnteringSweep || isCompactOrTouch
                      ? { duration: 0.25, ease: CINEMATIC_EASE }
                      : {
                          y: {
                            duration: 6.5,
                            repeat: Infinity,
                            ease: 'easeInOut',
                            delay: 0.7,
                          },
                          scale: { duration: 0.35, ease: CINEMATIC_EASE },
                        }
                  }
                  className="relative flex items-center justify-center"
                >
                  {/* Restrained Uniform Editorial Corner Hairlines */}
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute -top-2 -left-2 h-3.5 w-3.5 border-t border-l border-[#FF1744]/65"
                  />
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute -top-2 -right-2 h-3.5 w-3.5 border-t border-r border-[#EAE7E0]/35"
                  />
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute -bottom-2 -left-2 h-3.5 w-3.5 border-b border-l border-[#EAE7E0]/35"
                  />
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute -bottom-2 -right-2 h-3.5 w-3.5 border-b border-r border-[#FF1744]/65"
                  />

                  {!imageError ? (
                    <div className="relative overflow-hidden border border-[#EAE7E0]/16 bg-[#050505] shadow-[0_24px_64px_rgba(0,0,0,0.94),0_0_32px_rgba(164,16,52,0.2)]">
                      <img
                        src={posterSrc}
                        alt={posterAlt}
                        referrerPolicy="no-referrer"
                        onError={() => setImageError(true)}
                        className="relative block h-auto w-auto max-h-[44dvh] max-w-[82vw] object-contain select-none sm:max-h-[48dvh] sm:max-w-[460px] md:max-h-[52dvh] md:max-w-[480px]"
                      />
                      {/* Subtle perimeter edge shadow only — keeps artwork crisp, legible, and unaltered */}
                      <div
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-0 shadow-[inset_0_0_24px_rgba(5,5,5,0.45)] ring-1 ring-inset ring-white/10"
                      />
                    </div>
                  ) : (
                    <div className="relative flex aspect-[4/5] w-[min(78vw,340px)] flex-col items-center justify-center border border-[#EAE7E0]/20 bg-[#050505] p-8 text-center text-[#EAE7E0]">
                      <p className="font-display text-4xl font-black tracking-tight uppercase">
                        ALFAAZ — UNFILTERED
                      </p>
                      <p className="mt-2 text-sm text-[#EAE7E0]/75">
                        18 Dec 2026 · Quad AI, Bengaluru
                      </p>
                    </div>
                  )}
                </motion.div>
              </motion.div>
            </div>

            {/* Stagger 3: Interactive Artistic Trio: SING · POETRY · DANCE */}
            <motion.div
              initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={
                shouldReduceMotion
                  ? { duration: 0.01 }
                  : { duration: 0.45, delay: 0.25, ease: CINEMATIC_EASE }
              }
              aria-label="Interactive artistic discipline previews"
              className="grid w-full grid-cols-3 divide-x divide-[#EAE7E0]/12 border-t border-b border-[#EAE7E0]/12 bg-[#070709]/95"
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
                          ? 'bg-[#C8F36B] shadow-[0_0_8px_rgba(200,243,107,0.65)]'
                          : 'bg-[#FF1744] shadow-[0_0_6px_rgba(255,23,68,0.5)]'
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
                <span className="font-mono-num text-[10px] tracking-[0.22em] text-[#EAE7E0]/80 uppercase transition-colors group-hover:text-[#EAE7E0]">
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
                <span className="font-mono-num text-[10px] tracking-[0.22em] text-[#EAE7E0]/80 uppercase transition-colors group-hover:text-[#EAE7E0]">
                  Poetry
                </span>
              </button>

              {/* 3. DANCE: Abstract Motion Trails / Kinetic Visual */}
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
                <span className="font-mono-num text-[10px] tracking-[0.22em] text-[#EAE7E0]/80 uppercase transition-colors group-hover:text-[#EAE7E0]">
                  Dance
                </span>
              </button>
            </motion.div>

            {/* Stagger 4: Modal Footer Action Bar */}
            <motion.div
              initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={
                shouldReduceMotion
                  ? { duration: 0.01 }
                  : { duration: 0.45, delay: 0.32, ease: CINEMATIC_EASE }
              }
              className="flex flex-col items-center justify-between gap-3 bg-[#050505] px-4 py-3.5 sm:flex-row sm:px-5 sm:py-4"
            >
              <div className="hidden text-left sm:block">
                <p className="font-mono-num text-[10px] font-medium tracking-[0.2em] text-[#C8F36B] uppercase">
                  Quad AI, Bengaluru
                </p>
                <p className="mt-0.5 text-xs text-[#EAE7E0]/75">
                  4:00 PM – 9:00 PM IST · No Rules. Just Raw Talent.
                </p>
              </div>

              <motion.button
                type="button"
                disabled={isEnteringSweep}
                onClick={handleEnterExperience}
                onMouseEnter={() => setIsButtonHovered(true)}
                onMouseLeave={() => setIsButtonHovered(false)}
                whileHover={
                  shouldReduceMotion
                    ? undefined
                    : { y: -2, scale: 1.015 }
                }
                whileTap={shouldReduceMotion ? undefined : { scale: 0.98 }}
                transition={{ duration: 0.2, ease: CINEMATIC_EASE }}
                aria-label="Enter the ALFAAZ — UNFILTERED experience"
                className="neon-cta-breathe group relative inline-flex min-h-[46px] w-full shrink-0 cursor-pointer items-center justify-center gap-3 border border-[#FF1744] bg-[#FF1744] px-6 py-2.5 font-display text-lg font-extrabold tracking-[0.16em] text-[#EAE7E0] uppercase transition-all duration-200 hover:bg-[#ff2b54] hover:shadow-[0_10px_28px_rgba(255,23,68,0.48)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EAE7E0] focus-visible:ring-offset-2 focus-visible:ring-offset-[#050505] disabled:pointer-events-none whitespace-nowrap sm:w-auto sm:px-7 sm:text-xl"
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
                  className="inline-flex items-center text-[#EAE7E0]"
                >
                  <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5" />
                </motion.span>
              </motion.button>
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
