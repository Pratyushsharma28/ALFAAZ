import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion, useScroll, useTransform } from 'motion/react';
import { ArrowUpRight, Eye } from 'lucide-react';
import {
  AmbientNeonParticles,
  EDITORIAL_EASE,
  InteractiveNeonCard,
  OFFICIAL_GOOGLE_FORM_URL,
  scrollToSection,
  SectionDividerLine,
} from './MotionPrimitives';

interface HeroSectionProps {
  onOpenPoster: () => void;
}

export function HeroSection({ onOpenPoster }: HeroSectionProps) {
  const shouldReduceMotion = useReducedMotion();
  const [unfilteredHovered, setUnfilteredHovered] = useState(false);
  const [unfilteredTapActive, setUnfilteredTapActive] = useState(false);
  const tapTimeoutRef = useRef<number | null>(null);
  const { scrollY } = useScroll();
  const imageParallaxY = useTransform(scrollY, [0, 700], [0, 36]);

  const isUnfilteredSpectrum = unfilteredHovered || unfilteredTapActive;

  useEffect(() => {
    return () => {
      if (tapTimeoutRef.current) {
        window.clearTimeout(tapTimeoutRef.current);
      }
    };
  }, []);

  const handleUnfilteredTap = () => {
    setUnfilteredTapActive(true);
    if (tapTimeoutRef.current) {
      window.clearTimeout(tapTimeoutRef.current);
    }
    tapTimeoutRef.current = window.setTimeout(() => {
      setUnfilteredTapActive(false);
    }, 2800);
  };

  return (
    <section
      id="top"
      className="underground-surface relative overflow-hidden border-b border-[#EAE7E0]/15"
    >
      {/* Subtle breathing neon crimson & floating purple/cyan ambient backdrops */}
      <motion.div
        aria-hidden="true"
        animate={shouldReduceMotion ? { opacity: 0.18 } : { opacity: [0.14, 0.24, 0.14] }}
        transition={
          shouldReduceMotion
            ? undefined
            : { duration: 7.5, repeat: Infinity, ease: 'easeInOut' }
        }
        className="diagonal-slash-right pointer-events-none absolute -top-16 right-0 h-[560px] w-full bg-[#FF1744]/75 lg:h-[780px] lg:w-[54%]"
      />
      <motion.div
        aria-hidden="true"
        animate={
          shouldReduceMotion
            ? undefined
            : { x: [0, 26, 0], y: [0, -18, 0], scale: [1, 1.12, 1], opacity: [0.08, 0.16, 0.08] }
        }
        transition={
          shouldReduceMotion
            ? undefined
            : { duration: 12, repeat: Infinity, ease: 'easeInOut' }
        }
        className="pointer-events-none absolute -bottom-24 left-[10%] h-72 w-72 rounded-full bg-[#D500F9]/15 blur-3xl"
      />
      <motion.div
        aria-hidden="true"
        animate={
          shouldReduceMotion
            ? undefined
            : { x: [0, -22, 0], y: [0, 20, 0], scale: [1, 1.14, 1], opacity: [0.06, 0.14, 0.06] }
        }
        transition={
          shouldReduceMotion
            ? undefined
            : { duration: 14, repeat: Infinity, ease: 'easeInOut', delay: 1.2 }
        }
        className="pointer-events-none absolute top-16 right-[4%] h-64 w-64 rounded-full bg-[#00E5FF]/14 blur-3xl"
      />
      <AmbientNeonParticles />

      <motion.div
        aria-hidden="true"
        initial={shouldReduceMotion ? false : { scaleY: 0, opacity: 0 }}
        animate={{ scaleY: 1, opacity: 1 }}
        transition={
          shouldReduceMotion
            ? { duration: 0.01 }
            : { duration: 0.9, delay: 0.2, ease: EDITORIAL_EASE }
        }
        className="pointer-events-none absolute top-0 right-[48%] hidden h-full w-px origin-top -skew-x-12 bg-[#FF1744]/45 lg:block"
      />
      <motion.div
        aria-hidden="true"
        initial={shouldReduceMotion ? false : { scaleY: 0, opacity: 0 }}
        animate={{ scaleY: 1, opacity: 1 }}
        transition={
          shouldReduceMotion
            ? { duration: 0.01 }
            : { duration: 1.0, delay: 0.35, ease: EDITORIAL_EASE }
        }
        className="pointer-events-none absolute right-[8%] bottom-0 hidden h-[65%] w-[2px] origin-bottom -skew-x-12 bg-[#00E5FF]/25 lg:block"
      />

      <div className="relative mx-auto max-w-[1440px] px-6 pt-6 pb-14 lg:px-10 lg:pt-8 lg:pb-16">
        {/* Top Metadata Ledger */}
        <motion.div
          initial={shouldReduceMotion ? false : { opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={
            shouldReduceMotion
              ? { duration: 0.01 }
              : { duration: 0.45, ease: EDITORIAL_EASE }
          }
          className="flex flex-wrap items-center justify-between gap-4 pb-4 text-xs font-medium tracking-widest text-[#EAE7E0]/75 uppercase"
        >
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-mono-num text-[#C8F36B]">18 DECEMBER 2026</span>
            <span aria-hidden="true">·</span>
            <span>QUAD AI, BENGALURU</span>
            <span aria-hidden="true">·</span>
            <span>4:00 PM – 9:00 PM</span>
          </div>
          <span className="text-[#EAE7E0]/65">Social and Cultural Team, Quad AI</span>
        </motion.div>
        <SectionDividerLine />

        {/* Balanced 2-Column Editorial Hero Split (Layout & Images 100% Preserved) */}
        <div className="mt-7 grid grid-cols-1 items-stretch gap-10 lg:mt-8 lg:grid-cols-12 lg:gap-10 xl:gap-14">
          {/* LEFT COLUMN: Monumental Typography, Selective Neon Highlighting & Primary CTAs */}
          <div className="flex flex-col justify-between lg:col-span-6 lg:py-2">
            <div>
              <h1 className="font-display text-[clamp(4rem,10vw,9rem)] leading-[0.82] font-black tracking-tight text-[#EAE7E0] uppercase">
                <motion.span
                  initial={shouldReduceMotion ? false : { opacity: 0, y: 26 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={
                    shouldReduceMotion
                      ? { duration: 0.01 }
                      : { duration: 0.6, delay: 0.05, ease: EDITORIAL_EASE }
                  }
                  className="neon-text-crimson block"
                >
                  ALFAAZ
                </motion.span>
                <motion.span
                  initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.94, y: 14 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={
                    shouldReduceMotion
                      ? { duration: 0.01 }
                      : { duration: 0.52, delay: 0.18, ease: EDITORIAL_EASE }
                  }
                  onMouseEnter={() => setUnfilteredHovered(true)}
                  onMouseLeave={() => setUnfilteredHovered(false)}
                  onPointerDown={(e) => {
                    if (e.pointerType !== 'mouse') {
                      handleUnfilteredTap();
                    }
                  }}
                  style={
                    isUnfilteredSpectrum
                      ? {
                          borderColor: 'rgba(234, 231, 224, 0.55)',
                          boxShadow:
                            '0 0 28px rgba(255, 23, 68, 0.42), 0 0 42px rgba(0, 229, 255, 0.22)',
                        }
                      : undefined
                  }
                  className="relative mt-2 inline-block -rotate-1 cursor-default border border-[#FF1744]/60 bg-[#050505] px-4 py-1 text-[clamp(2.25rem,4.75vw,4.5rem)] leading-none text-[#FF1744] shadow-[0_0_24px_rgba(255,23,68,0.32)] transition-[border-color,box-shadow] duration-500 ease-out select-none"
                >
                  <span className="relative inline-block">
                    {/* Original Crimson Text (smoothly fades out on hover/tap) */}
                    <span
                      className={`inline-block transition-opacity duration-500 ease-out ${
                        isUnfilteredSpectrum ? 'opacity-0' : 'opacity-100'
                      }`}
                    >
                      UNFILTERED
                    </span>

                    {/* Cursor-triggered Multicolor Spectrum Flowing Overlay */}
                    <span
                      aria-hidden="true"
                      style={{
                        filter: isUnfilteredSpectrum
                          ? 'drop-shadow(0 0 10px rgba(255, 23, 68, 0.45)) drop-shadow(0 0 18px rgba(0, 229, 255, 0.28))'
                          : 'none',
                      }}
                      className={`unfiltered-rainbow-text pointer-events-none absolute inset-0 inline-block transition-[opacity,filter] duration-500 ease-out ${
                        isUnfilteredSpectrum
                          ? shouldReduceMotion
                            ? 'opacity-100'
                            : 'unfiltered-rainbow-active opacity-100'
                          : 'opacity-0'
                      }`}
                    >
                      UNFILTERED
                    </span>
                  </span>
                </motion.span>
              </h1>

              {/* Poster-inspired tilted crimson category ribbon */}
              <motion.div
                initial={shouldReduceMotion ? false : { opacity: 0, x: -18 }}
                animate={{ opacity: 1, x: 0 }}
                whileHover={shouldReduceMotion ? undefined : { x: 4 }}
                transition={
                  shouldReduceMotion
                    ? { duration: 0.01 }
                    : { duration: 0.5, delay: 0.28, ease: EDITORIAL_EASE }
                }
                className="mt-7 inline-block -rotate-1 border border-[#EAE7E0]/25 bg-[#FF1744] px-5 py-2.5 shadow-[0_0_22px_rgba(255,23,68,0.35),6px_6px_0px_#050505]"
              >
                <p className="font-display text-xl font-black tracking-widest text-[#EAE7E0] uppercase sm:text-2xl">
                  Dance · Singing · Poetry
                </p>
              </motion.div>

              <motion.div
                initial={shouldReduceMotion ? false : { opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={
                  shouldReduceMotion
                    ? { duration: 0.01 }
                    : { duration: 0.55, delay: 0.34, ease: EDITORIAL_EASE }
                }
                className="mt-8 max-w-xl"
              >
                <p className="font-display text-3xl font-extrabold tracking-wide text-[#C8F36B] uppercase sm:text-4xl">
                  No Rules. Just Raw Talent.
                </p>
                <p className="mt-3 text-sm leading-relaxed text-[#EAE7E0]/80 sm:text-base lg:text-lg">
                  Five unfiltered hours of live singing, movement, and spoken-word poetry at Quad
                  AI, Bengaluru. Step onto the floor to{' '}
                  <span className="neon-text-cyan text-[#00E5FF] font-semibold">PERFORM</span> and{' '}
                  <span className="neon-text-purple text-[#D500F9] font-semibold">EXPRESS</span>{' '}
                  without constraints, compete for ₹9,000 in cash awards, and walk away with an
                  official certificate and goodies.
                </p>
              </motion.div>
            </div>

            {/* Bottom CTA & Quick Event Coordinates */}
            <motion.div
              initial={shouldReduceMotion ? false : { opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={
                shouldReduceMotion
                  ? { duration: 0.01 }
                  : { duration: 0.5, delay: 0.42, ease: EDITORIAL_EASE }
              }
              className="mt-8 border-t border-[#EAE7E0]/15 pt-7"
            >
              <div className="flex flex-wrap items-center gap-4">
                <motion.a
                  href={OFFICIAL_GOOGLE_FORM_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  whileHover={shouldReduceMotion ? undefined : { scale: 1.04, y: -2 }}
                  whileTap={shouldReduceMotion ? undefined : { scale: 0.96 }}
                  transition={{ duration: 0.18, ease: EDITORIAL_EASE }}
                  className="neon-cta-breathe group inline-flex min-h-[48px] cursor-pointer items-center gap-2 border border-[#FF1744] bg-[#FF1744] px-7 py-3 font-display text-xl font-extrabold tracking-wider text-[#EAE7E0] uppercase transition-all duration-200 hover:bg-[#ff2b54] hover:shadow-[0_0_34px_rgba(255,23,68,0.82)] whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EAE7E0]"
                >
                  <span>Register Now</span>
                  <ArrowUpRight
                    className="h-5 w-5 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:rotate-12"
                    aria-hidden="true"
                  />
                </motion.a>

                <motion.button
                  type="button"
                  onClick={onOpenPoster}
                  whileHover={shouldReduceMotion ? undefined : { scale: 1.03, y: -2 }}
                  whileTap={shouldReduceMotion ? undefined : { scale: 0.96 }}
                  transition={{ duration: 0.18, ease: EDITORIAL_EASE }}
                  className="group inline-flex min-h-[48px] cursor-pointer items-center gap-2 border border-[#00E5FF]/45 bg-[#050505]/85 px-6 py-3 text-xs font-semibold tracking-wider text-[#EAE7E0] uppercase transition-all duration-200 hover:border-[#00E5FF] hover:text-[#00E5FF] hover:shadow-[0_0_24px_rgba(0,229,255,0.35)] whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00E5FF]"
                >
                  <Eye
                    className="h-4 w-4 text-[#00E5FF] transition-transform duration-200 group-hover:scale-125 group-hover:-rotate-6"
                    aria-hidden="true"
                  />
                  View Official Poster
                </motion.button>
              </div>

              {/* Interactive Quick Event Coordinate Cards — responsive 1-col on ultra-narrow, 3-col on sm+ */}
              <div className="mt-6 grid grid-cols-1 gap-2.5 border-t border-[#EAE7E0]/10 pt-5 text-xs sm:grid-cols-3 sm:gap-4">
                <InteractiveNeonCard
                  role="button"
                  tabIndex={0}
                  onClick={() => scrollToSection('#prizes', shouldReduceMotion)}
                  accentColor="#C8F36B"
                  hoverLift={-6}
                  hoverScale={1.02}
                  maxTilt={4}
                  className="cursor-pointer border border-[#EAE7E0]/12 bg-[#070709]/85 p-3 transition-colors hover:border-[#C8F36B]/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8F36B]"
                >
                  <span className="relative z-10 block tracking-widest text-[#EAE7E0]/60 uppercase">
                    1st Prize
                  </span>
                  <span className="font-mono-num relative z-10 mt-1 block text-base font-semibold text-[#C8F36B]">
                    ₹5,000
                  </span>
                </InteractiveNeonCard>
                <InteractiveNeonCard
                  role="button"
                  tabIndex={0}
                  onClick={() => scrollToSection('#passes', shouldReduceMotion)}
                  accentColor="#FF1744"
                  hoverLift={-6}
                  hoverScale={1.02}
                  maxTilt={4}
                  className="cursor-pointer border border-[#EAE7E0]/12 bg-[#070709]/85 p-3 transition-colors hover:border-[#FF1744]/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF1744]"
                >
                  <span className="relative z-10 block tracking-widest text-[#EAE7E0]/60 uppercase">
                    Passes From
                  </span>
                  <span className="font-mono-num relative z-10 mt-1 block text-base font-semibold text-[#EAE7E0]">
                    ₹99
                  </span>
                </InteractiveNeonCard>
                <InteractiveNeonCard
                  role="button"
                  tabIndex={0}
                  onClick={() => scrollToSection('#about', shouldReduceMotion)}
                  accentColor="#00E5FF"
                  hoverLift={-6}
                  hoverScale={1.02}
                  maxTilt={4}
                  className="cursor-pointer border border-[#EAE7E0]/12 bg-[#070709]/85 p-3 transition-colors hover:border-[#00E5FF]/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00E5FF]"
                >
                  <span className="relative z-10 block tracking-widest text-[#EAE7E0]/60 uppercase">
                    Every Entry
                  </span>
                  <span className="relative z-10 mt-1 block text-sm font-semibold text-[#EAE7E0]">
                    Cert + Goodies
                  </span>
                </InteractiveNeonCard>
              </div>
            </motion.div>
          </div>

          {/* RIGHT COLUMN: Full-Height Performer Showcase + Artistic Collage (All Images Locked) */}
          <motion.div
            initial={shouldReduceMotion ? false : { opacity: 0, y: 24, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={
              shouldReduceMotion
                ? { duration: 0.01 }
                : { duration: 0.72, delay: 0.16, ease: EDITORIAL_EASE }
            }
            className="relative flex flex-col lg:col-span-6"
          >
            {/* Sophisticated layered crimson & purple stage halo behind right showcase */}
            <motion.div
              aria-hidden="true"
              animate={shouldReduceMotion ? { opacity: 0.24 } : { opacity: [0.18, 0.28, 0.18] }}
              transition={
                shouldReduceMotion
                  ? undefined
                  : { duration: 7, repeat: Infinity, ease: 'easeInOut' }
              }
              style={{
                background:
                  'radial-gradient(circle at 55% 45%, rgba(255, 23, 68, 0.65) 0%, rgba(213, 0, 249, 0.22) 55%, transparent 78%)',
              }}
              className="pointer-events-none absolute -inset-4 hidden blur-2xl lg:block"
            />

            <InteractiveNeonCard
              accentColor="#FF1744"
              hoverLift={-8}
              hoverScale={1.015}
              maxTilt={3.5}
              className="flex h-full min-h-[420px] flex-col justify-between border border-[#EAE7E0]/20 bg-[#050505] p-2.5 shadow-[0_24px_80px_rgba(255,23,68,0.24)] sm:min-h-[500px] lg:min-h-[580px]"
            >
              {/* Main Performer Stage Frame */}
              <div className="group relative z-10 min-h-[360px] flex-1 overflow-hidden bg-[#050505] sm:min-h-[440px]">
                <motion.img
                  style={shouldReduceMotion ? undefined : { y: imageParallaxY }}
                  src="/src/assets/images/hero_indian_concert_stage_1795714855811.jpg"
                  alt="Young Indian performer singing confidently into a stage microphone under crimson concert spotlights"
                  referrerPolicy="no-referrer"
                  className="absolute inset-0 h-full w-full scale-[1.06] object-cover object-top transition-transform duration-700 ease-out group-hover:scale-[1.09]"
                />

                {/* Measured Dark & Crimson Editorial Scrim */}
                <div
                  aria-hidden="true"
                  className="absolute inset-0 bg-gradient-to-t from-[#050505]/92 via-[#050505]/20 to-[#FF1744]/12"
                />

                {/* Top-Left Editorial Stage Tag */}
                <div className="neon-badge-pulse absolute top-4 left-4 border border-[#FF1744]/45 bg-[#050505]/80 px-3.5 py-2 backdrop-blur-xs shadow-[0_0_14px_rgba(255,23,68,0.25)]">
                  <p className="font-mono-num text-[11px] tracking-widest text-[#FF1744] uppercase">
                    Main Stage · Quad AI
                  </p>
                </div>

                {/* Top-Right Vertical Editorial Discipline Strip + Checkerboard Mark */}
                <div className="absolute top-4 right-4 flex flex-col items-end gap-3">
                  <div
                    aria-hidden="true"
                    className="poster-checker h-8 w-8 border border-[#EAE7E0]/35"
                  />
                  <div className="hidden border border-[#EAE7E0]/20 bg-[#050505]/80 px-2 py-3 backdrop-blur-xs sm:block">
                    <p
                      className="font-mono-num text-[10px] tracking-[0.26em] text-[#EAE7E0]/85 uppercase"
                      style={{ writingMode: 'vertical-rl' }}
                    >
                      Singing · Poetry · Dance
                    </p>
                  </div>
                </div>

                {/* Bottom Collage Overlay */}
                <div className="absolute right-4 bottom-4 left-4 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
                  <div>
                    <p className="font-mono-num text-[11px] tracking-widest text-[#C8F36B] uppercase">
                      18 Dec 2026 · Bengaluru
                    </p>
                    <p className="mt-0.5 font-display text-3xl font-black tracking-tight text-[#EAE7E0] uppercase sm:text-4xl">
                      Live Open Stage
                    </p>
                  </div>

                  {/* Artistic Discipline Micro-Collage */}
                  <div
                    aria-label="Singing, Poetry, and Dance festival collage"
                    className="flex items-center gap-2 border border-[#EAE7E0]/20 bg-[#050505]/85 p-1.5 backdrop-blur-xs"
                  >
                    <motion.div
                      whileHover={shouldReduceMotion ? undefined : { y: -3, scale: 1.08 }}
                      transition={{ duration: 0.18 }}
                      className="relative h-12 w-10 overflow-hidden border border-[#FF1744]/55 shadow-[0_0_10px_rgba(255,23,68,0.28)] sm:h-14 sm:w-12"
                    >
                      <img
                        src="/src/assets/images/singing_indian_female_concert_1795714855686.jpg"
                        alt="Singing showcase preview"
                        referrerPolicy="no-referrer"
                        className="h-full w-full object-cover object-top"
                      />
                    </motion.div>
                    <motion.div
                      whileHover={shouldReduceMotion ? undefined : { y: -3, scale: 1.08 }}
                      transition={{ duration: 0.18 }}
                      className="relative h-12 w-10 overflow-hidden border border-[#D500F9]/55 shadow-[0_0_10px_rgba(213,0,249,0.28)] sm:h-14 sm:w-12"
                    >
                      <img
                        src="/src/assets/images/poetry_indian_spoken_word_1795714855215.jpg"
                        alt="Poetry showcase preview"
                        referrerPolicy="no-referrer"
                        className="h-full w-full object-cover object-top"
                      />
                    </motion.div>
                    <motion.div
                      whileHover={shouldReduceMotion ? undefined : { y: -3, scale: 1.08 }}
                      transition={{ duration: 0.18 }}
                      className="relative h-12 w-10 overflow-hidden border border-[#00E5FF]/55 shadow-[0_0_10px_rgba(0,229,255,0.28)] sm:h-14 sm:w-12"
                    >
                      <img
                        src="/src/assets/images/dance_indian_crew_stage_1795714857180.jpg"
                        alt="Dance showcase preview"
                        referrerPolicy="no-referrer"
                        className="h-full w-full object-cover object-top"
                      />
                    </motion.div>
                  </div>
                </div>
              </div>

              {/* Bottom Architectural Bar inside Right Frame */}
              <div className="relative z-10 mt-2.5 flex flex-wrap items-center justify-between gap-3 border border-[#EAE7E0]/15 bg-[#050505] px-4 py-3 text-xs tracking-widest uppercase">
                <span className="font-mono-num text-[#EAE7E0]/75">
                  00. Main Auditorium Showcase
                </span>
                <span className="font-mono-num font-semibold text-[#FF1744]">
                  4:00 PM – 9:00 PM
                </span>
              </div>
            </InteractiveNeonCard>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
