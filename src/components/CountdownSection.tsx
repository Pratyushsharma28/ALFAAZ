import { Fragment, useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  AmbientNeonParticles,
  EDITORIAL_EASE,
  InteractiveNeonCard,
  RevealBlock,
  SectionDividerLine,
  staggerContainerVariants,
  staggerItemVariants,
} from './MotionPrimitives';

// 18 December 2026, 4:00 PM IST (Bengaluru, India Standard Time: UTC+05:30)
const EVENT_TARGET_MS = Date.parse('2026-12-18T16:00:00+05:30');

interface CountdownState {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  isLive: boolean;
}

function getCountdownState(): CountdownState {
  const diff = EVENT_TARGET_MS - Date.now();
  if (diff <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, isLive: true };
  }

  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((diff / (1000 * 60)) % 60),
    seconds: Math.floor((diff / 1000) % 60),
    isLive: false,
  };
}

function padTwo(value: number): string {
  return String(value).padStart(2, '0');
}

interface UnitConfig {
  key: 'days' | 'hours' | 'minutes' | 'seconds';
  label: string;
  accent: string;
  borderClass: string;
  floatAmp: number;
  floatDuration: number;
  floatDelay: number;
}

const COUNTDOWN_UNITS: UnitConfig[] = [
  {
    key: 'days',
    label: 'Days',
    accent: '#FF1744',
    borderClass: 'border-[#FF1744]/55 bg-[#090406]',
    floatAmp: 4.5,
    floatDuration: 5.2,
    floatDelay: 0,
  },
  {
    key: 'hours',
    label: 'Hours',
    accent: '#D500F9',
    borderClass: 'border-[#D500F9]/55 bg-[#08040B]',
    floatAmp: 4.5,
    floatDuration: 5.8,
    floatDelay: 0.35,
  },
  {
    key: 'minutes',
    label: 'Minutes',
    accent: '#00E5FF',
    borderClass: 'border-[#00E5FF]/55 bg-[#04090B]',
    floatAmp: 4.5,
    floatDuration: 6.2,
    floatDelay: 0.7,
  },
  {
    key: 'seconds',
    label: 'Seconds',
    accent: '#C8F36B',
    borderClass: 'border-[#C8F36B]/55 bg-[#070904]',
    floatAmp: 4.5,
    floatDuration: 5.5,
    floatDelay: 1.05,
  },
];

export function CountdownSection() {
  const shouldReduceMotion = useReducedMotion();
  const [countdown, setCountdown] = useState<CountdownState>(getCountdownState);

  useEffect(() => {
    setCountdown(getCountdownState());
    const interval = window.setInterval(() => {
      setCountdown(getCountdownState());
    }, 1000);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <section
      id="countdown"
      aria-label="Event Countdown to 18 December 2026"
      className="underground-surface relative scroll-mt-20 overflow-hidden border-b border-[#EAE7E0]/15 pb-16 lg:pb-24"
    >
      {/* Seamless Left-to-Right Moving Text Ticker immediately above the Countdown */}
      <div
        aria-label="ALFAAZ countdown announcement ticker"
        className="relative z-10 border-b border-[#FF1744]/25 bg-[#070509]/95 py-3"
      >
        <div className="marquee-mask w-full overflow-hidden">
          <div className="marquee-ltr-countdown font-mono-num text-xs font-semibold tracking-[0.24em] uppercase whitespace-nowrap sm:text-[13px]">
            {[0, 1].map((copyIdx) => (
              <div
                key={copyIdx}
                aria-hidden={copyIdx === 1}
                className="flex shrink-0 items-center"
              >
                {[0, 1, 2].map((repIdx) => (
                  <span key={repIdx} className="inline-flex items-center gap-4 pr-8">
                    <span className="text-[#C8F36B]" style={{ textShadow: '0 0 12px rgba(200,243,107,0.35)' }}>
                      NO RULES. JUST RAW TALENT.
                    </span>
                    <span className="text-[#FF1744]">•</span>
                    <span className="neon-text-crimson text-[#FF1744]">ALFAAZ UNFILTERED</span>
                    <span className="text-[#D500F9]">•</span>
                    <span className="neon-text-cyan text-[#00E5FF]">18 DECEMBER 2026</span>
                    <span className="text-[#C8F36B]">•</span>
                    <span className="neon-text-purple text-[#D500F9]">REGISTRATIONS OPEN</span>
                    <span className="text-[#00E5FF]">•</span>
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Floating Neon Ambient Blobs & Subtle Particles */}
      <motion.div
        aria-hidden="true"
        animate={
          shouldReduceMotion
            ? undefined
            : { x: [0, 28, 0], y: [0, -18, 0], scale: [1, 1.14, 1], opacity: [0.08, 0.16, 0.08] }
        }
        transition={
          shouldReduceMotion
            ? undefined
            : { duration: 12.5, repeat: Infinity, ease: 'easeInOut' }
        }
        className="pointer-events-none absolute -top-12 left-[14%] h-72 w-72 rounded-full bg-[#FF1744]/16 blur-3xl"
      />
      <motion.div
        aria-hidden="true"
        animate={
          shouldReduceMotion
            ? undefined
            : { x: [0, -24, 0], y: [0, 20, 0], scale: [1, 1.12, 1], opacity: [0.06, 0.14, 0.06] }
        }
        transition={
          shouldReduceMotion
            ? undefined
            : { duration: 14.5, repeat: Infinity, ease: 'easeInOut', delay: 1.2 }
        }
        className="pointer-events-none absolute -bottom-16 right-[12%] h-72 w-72 rounded-full bg-[#00E5FF]/14 blur-3xl"
      />
      <motion.div
        aria-hidden="true"
        animate={
          shouldReduceMotion
            ? undefined
            : { opacity: [0.05, 0.12, 0.05], scale: [0.98, 1.06, 0.98] }
        }
        transition={
          shouldReduceMotion
            ? undefined
            : { duration: 9, repeat: Infinity, ease: 'easeInOut' }
        }
        className="pointer-events-none absolute top-1/2 left-1/2 h-64 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#D500F9]/14 blur-3xl"
      />
      <AmbientNeonParticles />

      <div className="relative mx-auto max-w-[1440px] px-6 pt-14 lg:px-10 lg:pt-20">
        <RevealBlock className="flex flex-col justify-between gap-4 pb-6 md:flex-row md:items-end">
          <div>
            <p className="font-mono-num text-xs font-medium tracking-widest text-[#C8F36B] uppercase">
              Live Countdown · 18 December 2026 · IST
            </p>
            <h2 className="mt-2 font-display text-[clamp(2.75rem,5.5vw,4.75rem)] leading-[0.88] font-black tracking-tight text-[#EAE7E0] uppercase">
              THE <span className="neon-text-crimson text-[#FF1744]">COUNTDOWN</span> BEGINS
            </h2>
          </div>

          <p className="text-sm leading-relaxed text-[#EAE7E0]/75 md:text-right">
            Until the stage becomes yours.
            <span className="font-mono-num mt-1 block text-xs tracking-widest text-[#00E5FF] uppercase">
              Quad AI, Bengaluru · 4:00 PM IST
            </span>
          </p>
        </RevealBlock>
        <SectionDividerLine />

        {countdown.isLive ? (
          <RevealBlock delay={0.1} className="mt-10">
            <InteractiveNeonCard
              accentColor="#FF1744"
              hoverLift={-8}
              hoverScale={1.015}
              maxTilt={3}
              className="border border-[#FF1744] bg-[#090406] p-8 text-center shadow-[0_0_36px_rgba(255,23,68,0.28)] sm:p-12"
            >
              <p className="neon-badge-pulse font-mono-num text-xs tracking-[0.26em] text-[#C8F36B] uppercase">
                18 December 2026 · Quad AI, Bengaluru
              </p>
              <p className="neon-text-crimson mt-3 font-display text-[clamp(2.75rem,6vw,5rem)] leading-none font-black tracking-tight text-[#EAE7E0] uppercase">
                ALFAAZ — UNFILTERED IS LIVE
              </p>
              <p className="mt-3 text-sm text-[#EAE7E0]/80 sm:text-base">
                The floor is open. No Rules. Just Raw Talent.
              </p>
            </InteractiveNeonCard>
          </RevealBlock>
        ) : (
          <motion.div
            variants={shouldReduceMotion ? undefined : staggerContainerVariants}
            initial={shouldReduceMotion ? false : 'hidden'}
            whileInView="visible"
            viewport={{ once: true, amount: 0.15 }}
            className="mt-10 grid grid-cols-2 items-stretch gap-4 sm:gap-5 md:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr] md:items-center md:gap-3 lg:gap-5"
          >
            {COUNTDOWN_UNITS.map((unit, idx) => {
              const valueStr = padTwo(countdown[unit.key]);
              return (
                <Fragment key={unit.key}>
                  <motion.div
                    variants={shouldReduceMotion ? undefined : staggerItemVariants}
                    className="h-full"
                  >
                    <InteractiveNeonCard
                      accentColor={unit.accent}
                      hoverLift={-10}
                      hoverScale={1.03}
                      maxTilt={5.5}
                      floatAmplitude={unit.floatAmp}
                      floatDuration={unit.floatDuration}
                      floatDelay={unit.floatDelay}
                      className={`flex h-full flex-col items-center justify-center border px-4 py-6 text-center transition-colors duration-200 sm:px-6 sm:py-8 ${unit.borderClass}`}
                    >
                      {/* Subtle neon corner accent top bar */}
                      <span
                        aria-hidden="true"
                        style={{
                          backgroundColor: unit.accent,
                          boxShadow: `0 0 14px ${unit.accent}`,
                        }}
                        className="neon-badge-pulse absolute top-0 right-6 left-6 h-[2px]"
                      />

                      <div className="relative z-10 flex min-h-[4.25rem] items-center justify-center overflow-hidden sm:min-h-[5.5rem]">
                        <AnimatePresence mode="popLayout" initial={false}>
                          <motion.span
                            key={valueStr}
                            initial={
                              shouldReduceMotion
                                ? { opacity: 1 }
                                : { opacity: 0, y: 14, scale: 0.94 }
                            }
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={
                              shouldReduceMotion
                                ? { opacity: 0 }
                                : { opacity: 0, y: -14, scale: 0.94 }
                            }
                            transition={
                              shouldReduceMotion
                                ? { duration: 0.01 }
                                : { duration: 0.24, ease: EDITORIAL_EASE }
                            }
                            style={{
                              textShadow: `0 0 22px ${unit.accent}55`,
                            }}
                            className="font-display block text-[clamp(3.25rem,6vw,5.5rem)] leading-none font-black tracking-tight text-[#EAE7E0] tabular-nums"
                          >
                            {valueStr}
                          </motion.span>
                        </AnimatePresence>
                      </div>

                      <span
                        className="neon-badge-pulse relative z-10 mt-3 font-mono-num text-[11px] font-semibold tracking-[0.25em] uppercase"
                        style={{ color: unit.accent }}
                      >
                        {unit.label}
                      </span>
                    </InteractiveNeonCard>
                  </motion.div>

                  {/* Glowing Colon Separator on Desktop (Days : Hours : Minutes : Seconds) */}
                  {idx < COUNTDOWN_UNITS.length - 1 && (
                    <motion.span
                      aria-hidden="true"
                      animate={
                        shouldReduceMotion
                          ? { opacity: 0.7 }
                          : { opacity: [0.35, 0.95, 0.35] }
                      }
                      transition={
                        shouldReduceMotion
                          ? undefined
                          : { duration: 1.8, repeat: Infinity, ease: 'easeInOut' }
                      }
                      className="neon-text-crimson hidden font-display text-4xl font-black text-[#FF1744] select-none md:inline-block lg:text-5xl"
                    >
                      :
                    </motion.span>
                  )}
                </Fragment>
              );
            })}
          </motion.div>
        )}
      </div>
    </section>
  );
}
