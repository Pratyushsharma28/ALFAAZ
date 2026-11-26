import { motion, useReducedMotion } from 'motion/react';
import { AboutEventTimeline } from './AboutEventTimeline';
import {
  EDITORIAL_EASE,
  InteractiveNeonCard,
  RevealBlock,
  staggerContainerVariants,
  staggerItemVariants,
} from './MotionPrimitives';

export function AboutSection() {
  const shouldReduceMotion = useReducedMotion();

  return (
    <section
      id="about"
      className="underground-surface relative scroll-mt-20 overflow-hidden border-b border-[#EAE7E0]/15 py-20 lg:py-28"
    >
      {/* Subtle diagonal crimson & floating purple ambient gradients */}
      <motion.div
        aria-hidden="true"
        animate={shouldReduceMotion ? { opacity: 0.16 } : { opacity: [0.12, 0.22, 0.12] }}
        transition={
          shouldReduceMotion
            ? undefined
            : { duration: 7.5, repeat: Infinity, ease: 'easeInOut' }
        }
        className="diagonal-slash-left pointer-events-none absolute top-12 -left-16 h-72 w-72 bg-[#FF1744]/55"
      />
      <motion.div
        aria-hidden="true"
        animate={
          shouldReduceMotion
            ? undefined
            : { x: [0, -24, 0], y: [0, -16, 0], scale: [1, 1.12, 1], opacity: [0.06, 0.14, 0.06] }
        }
        transition={
          shouldReduceMotion
            ? undefined
            : { duration: 13, repeat: Infinity, ease: 'easeInOut' }
        }
        className="pointer-events-none absolute right-0 bottom-0 hidden h-80 w-80 rounded-full bg-[#D500F9]/14 blur-3xl md:block"
      />

      <div className="relative mx-auto max-w-[1440px] px-6 lg:px-10">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-12">
          {/* Left Asymmetric Editorial Statement */}
          <RevealBlock className="flex flex-col justify-between lg:col-span-5">
            <div>
              <p className="font-mono-num text-xs font-medium tracking-widest text-[#C8F36B] uppercase">
                01. About ALFAAZ
              </p>
              <h2 className="mt-4 font-display text-[clamp(3.25rem,6.2vw,5.5rem)] leading-[0.86] font-black tracking-tight text-[#EAE7E0] uppercase text-balance">
                Zero Filters. Raw Underground{' '}
                <span className="neon-text-crimson text-[#FF1744]">Sound</span> &amp;{' '}
                <span className="neon-text-purple text-[#D500F9]">Verse</span>.
              </h2>

              {/* Animated editorial quotation pull accent in Electric Purple */}
              <motion.blockquote
                initial={shouldReduceMotion ? false : { opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={
                  shouldReduceMotion
                    ? { duration: 0.01 }
                    : { duration: 0.55, delay: 0.12, ease: EDITORIAL_EASE }
                }
                className="mt-8 border-t border-[#D500F9]/30 pt-5"
              >
                <span
                  aria-hidden="true"
                  className="neon-text-purple font-display text-4xl leading-none font-black text-[#D500F9]"
                >
                  &ldquo;
                </span>
                <p className="mt-1 text-sm leading-relaxed text-[#EAE7E0]/80 italic">
                  Where rhythm, voice, and spoken truth collide without a filter.
                </p>
              </motion.blockquote>
            </div>

            <AboutEventTimeline />

            <div className="mt-4">
              {/* Seamless Left-to-Right Moving Text Ticker beside About event details */}
              <div
                aria-label="ALFAAZ event ticker"
                className="marquee-mask relative mb-2.5 w-full overflow-hidden py-1"
              >
                <div className="marquee-ltr-about font-mono-num text-[11px] font-medium tracking-[0.22em] uppercase whitespace-nowrap">
                  {[0, 1].map((copyIdx) => (
                    <div
                      key={copyIdx}
                      aria-hidden={copyIdx === 1}
                      className="flex shrink-0 items-center"
                    >
                      {[0, 1].map((repIdx) => (
                        <span key={repIdx} className="inline-flex items-center gap-3 pr-6">
                          <span className="neon-text-crimson text-[#FF1744]">ALFAAZ — UNFILTERED</span>
                          <span className="text-[#D500F9]">•</span>
                          <span className="text-[#EAE7E0]/90">18 DECEMBER 2026</span>
                          <span className="text-[#00E5FF]">•</span>
                          <span className="neon-text-cyan text-[#00E5FF]">BENGALURU</span>
                          <span className="text-[#C8F36B]">•</span>
                          <span className="text-[#FF1744]">SINGING</span>
                          <span className="text-[#D500F9]">•</span>
                          <span className="neon-text-purple text-[#D500F9]">POETRY</span>
                          <span className="text-[#00E5FF]">•</span>
                          <span className="text-[#C8F36B]">DANCE</span>
                          <span className="text-[#FF1744]">•</span>
                        </span>
                      ))}
                    </div>
                  ))}
                </div>
              </div>

              {/* Fixed horizontal divider line beside/below About event details with L-to-R traveling neon pulse */}
              <div
                aria-hidden="true"
                className="relative mb-6 h-px w-full overflow-hidden bg-[#EAE7E0]/15"
              >
                <div
                  style={{
                    background:
                      'linear-gradient(90deg, rgba(255,23,68,0.35) 0%, rgba(213,0,249,0.35) 35%, rgba(0,229,255,0.35) 70%, rgba(200,243,107,0.35) 100%)',
                  }}
                  className="absolute inset-0"
                />
                {!shouldReduceMotion && (
                  <motion.div
                    initial={{ x: '-35%' }}
                    animate={{ x: '135%' }}
                    transition={{
                      duration: 3.8,
                      repeat: Infinity,
                      ease: 'linear',
                    }}
                    className="absolute inset-y-0 left-0 w-[35%]"
                    style={{
                      background:
                        'linear-gradient(90deg, transparent 0%, rgba(255,23,68,0.45) 22%, rgba(213,0,249,0.75) 52%, rgba(0,229,255,0.9) 80%, #C8F36B 94%, #EAE7E0 100%)',
                      boxShadow:
                        '0 0 12px rgba(0, 229, 255, 0.75), 0 0 18px rgba(213, 0, 249, 0.5)',
                    }}
                  />
                )}
              </div>
              <p className="text-xs font-semibold tracking-widest text-[#EAE7E0]/55 uppercase">
                Curated &amp; Organised By
              </p>
              <p className="mt-1 font-display text-2xl font-extrabold tracking-wide text-[#EAE7E0] uppercase">
                Social and Cultural Team, Quad AI
              </p>
            </div>
          </RevealBlock>

          {/* Right Offset Manifesto, Cultural Rehearsal Photography & Callouts */}
          <RevealBlock
            delay={0.12}
            className="flex flex-col justify-between gap-10 lg:col-span-7 lg:pt-4"
          >
            {/* Editorial Student Cultural Festival Photography Frame (Image Locked) */}
            <InteractiveNeonCard
              accentColor="#FF1744"
              hoverLift={-8}
              hoverScale={1.015}
              maxTilt={3.5}
              className="group border border-[#EAE7E0]/20 bg-[#050505] p-2"
            >
              <div className="relative z-10 aspect-[16/9] w-full overflow-hidden">
                <img
                  src="/src/assets/images/about_indian_students_festival_1795714856996.jpg"
                  alt="Indian university students rehearsing music and poetry backstage at a cultural festival"
                  referrerPolicy="no-referrer"
                  className="h-full w-full object-cover object-center transition-transform duration-500 ease-out group-hover:scale-[1.03]"
                />
                <div
                  aria-hidden="true"
                  className="absolute inset-0 bg-gradient-to-t from-[#050505]/85 via-[#050505]/15 to-transparent"
                />
                <div className="absolute right-4 bottom-3 left-4 flex items-center justify-between gap-4 text-[11px] tracking-widest text-[#EAE7E0]/80 uppercase">
                  <span className="font-mono-num text-[#C8F36B]">Rehearsals &amp; Soundcheck</span>
                  <span>Quad AI Cultural Collective</span>
                </div>
              </div>
            </InteractiveNeonCard>

            <div className="space-y-6 text-base leading-relaxed text-[#EAE7E0]/85 sm:text-lg">
              <p className="first-letter:float-left first-letter:mt-1 first-letter:mr-3 first-letter:font-display first-letter:text-6xl first-letter:leading-[0.82] first-letter:font-black first-letter:text-[#FF1744]">
                ALFAAZ — UNFILTERED breaks out of sterile auditorium rules. Built for movers,
                vocalists, and poets at Quad AI and across Bengaluru, the stage exists for raw
                presence—where unrehearsed honesty hits harder than polished perfection.
              </p>
              <p>
                On 18 December 2026, the Social and Cultural Team transforms Quad AI into a five-hour
                live cultural arena. Bring your crew, your acoustic instrument, or crumpled pages of
                original verse.
              </p>
            </div>

            <motion.div
              variants={shouldReduceMotion ? undefined : staggerContainerVariants}
              initial={shouldReduceMotion ? false : 'hidden'}
              whileInView="visible"
              viewport={{ once: true, amount: 0.15 }}
              className="grid grid-cols-1 gap-6 sm:grid-cols-2"
            >
              <motion.div
                variants={shouldReduceMotion ? undefined : staggerItemVariants}
                className="h-full"
              >
                <InteractiveNeonCard
                  accentColor="#FF1744"
                  hoverLift={-8}
                  hoverScale={1.02}
                  maxTilt={4.5}
                  className="h-full border border-[#FF1744]/50 bg-[#140409] p-7 text-[#EAE7E0] shadow-[0_0_24px_rgba(255,23,68,0.14)]"
                >
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute -top-6 -right-6 h-20 w-20 rotate-12 bg-[#FF1744]/20 transition-transform duration-300 group-hover/neoncard:rotate-45 group-hover/neoncard:scale-125"
                  />
                  <p className="relative z-10 font-mono-num text-xs tracking-widest text-[#FF1744] uppercase">
                    For Every Performer
                  </p>
                  <p className="relative z-10 mt-2 font-display text-3xl font-black tracking-tight uppercase">
                    Certificates &amp; Goodies
                  </p>
                  <p className="relative z-10 mt-2 text-sm leading-relaxed text-[#EAE7E0]/85">
                    Every registered participant receives an official participation certificate and
                    curated ALFAAZ goodies—no exceptions.
                  </p>
                </InteractiveNeonCard>
              </motion.div>

              <motion.div
                variants={shouldReduceMotion ? undefined : staggerItemVariants}
                className="h-full"
              >
                <InteractiveNeonCard
                  accentColor="#00E5FF"
                  hoverLift={-8}
                  hoverScale={1.02}
                  maxTilt={4.5}
                  className="h-full border border-[#EAE7E0]/20 bg-[#050505] p-7 text-[#EAE7E0] transition-colors hover:border-[#00E5FF]/55"
                >
                  <p className="relative z-10 font-mono-num text-xs tracking-widest text-[#C8F36B] uppercase">
                    The Rulebook
                  </p>
                  <p className="relative z-10 mt-2 font-display text-3xl font-black tracking-tight uppercase">
                    No Rules. Just Raw Talent.
                  </p>
                  <p className="relative z-10 mt-2 text-sm leading-relaxed text-[#EAE7E0]/75">
                    Any language, any genre, solo or crew. Step onto the floor, own your slot, and
                    let the room decide.
                  </p>
                </InteractiveNeonCard>
              </motion.div>
            </motion.div>
          </RevealBlock>
        </div>
      </div>
    </section>
  );
}
