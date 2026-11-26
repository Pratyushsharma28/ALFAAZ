import { motion, useReducedMotion } from 'motion/react';
import {
  EDITORIAL_EASE,
  InteractiveNeonCard,
  RevealBlock,
  SectionDividerLine,
  staggerContainerVariants,
  staggerItemVariants,
} from './MotionPrimitives';

interface DetailRow {
  label: string;
  value: string;
  secondary?: string;
}

const EVENT_DETAILS: DetailRow[] = [
  {
    label: 'Date',
    value: '18 December 2026',
    secondary: 'Friday Evening Edition',
  },
  {
    label: 'Schedule',
    value: '4:00 PM – 9:00 PM',
    secondary: 'Check-in & track verification begins at 3:30 PM',
  },
  {
    label: 'Venue',
    value: 'Quad AI, Bengaluru',
    secondary: 'Main Cultural Floor',
  },
  {
    label: 'Organiser',
    value: 'Social and Cultural Team, Quad AI',
    secondary: 'Curated campus underground arts collective',
  },
  {
    label: 'Categories',
    value: 'Dance · Singing · Poetry',
    secondary: 'Individual (₹99) · Couple (₹149) · Group (₹199)',
  },
  {
    label: 'Tagline',
    value: 'No Rules. Just Raw Talent.',
    secondary: 'Certificates and goodies for every registered participant',
  },
];

export function EventDetailsSection() {
  const shouldReduceMotion = useReducedMotion();

  return (
    <section
      id="details"
      className="underground-surface relative scroll-mt-20 overflow-hidden border-b border-[#EAE7E0]/15 py-20 lg:py-28"
    >
      {/* Subtle Floating Neon Ambient Blobs */}
      <motion.div
        aria-hidden="true"
        animate={
          shouldReduceMotion
            ? undefined
            : { x: [0, 22, 0], y: [0, -18, 0], scale: [1, 1.12, 1], opacity: [0.05, 0.12, 0.05] }
        }
        transition={
          shouldReduceMotion
            ? undefined
            : { duration: 14, repeat: Infinity, ease: 'easeInOut' }
        }
        className="pointer-events-none absolute top-24 right-0 hidden h-72 w-72 rounded-full bg-[#FF1744]/14 blur-3xl md:block"
      />
      <motion.div
        aria-hidden="true"
        animate={
          shouldReduceMotion
            ? undefined
            : { x: [0, -20, 0], y: [0, 16, 0], scale: [1, 1.14, 1], opacity: [0.04, 0.1, 0.04] }
        }
        transition={
          shouldReduceMotion
            ? undefined
            : { duration: 15.5, repeat: Infinity, ease: 'easeInOut', delay: 1.5 }
        }
        className="pointer-events-none absolute bottom-24 left-0 hidden h-72 w-72 rounded-full bg-[#00E5FF]/12 blur-3xl md:block"
      />

      <div className="relative mx-auto max-w-[1440px] px-6 lg:px-10">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-12">
          <RevealBlock className="flex flex-col justify-between lg:col-span-4">
            <div>
              <p className="font-mono-num text-xs font-semibold tracking-widest text-[#C8F36B] uppercase">
                05. Event Details
              </p>
              <h2 className="mt-3 font-display text-[clamp(3.25rem,5.5vw,4.75rem)] leading-[0.86] font-black tracking-tight text-[#EAE7E0] uppercase text-balance">
                Showtime Logistics.
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-[#EAE7E0]/75">
                Bring your backing tracks on a drive or phone and arrive early for floor check-in
                at Quad AI, Bengaluru.
              </p>
            </div>

            {/* Poster-inspired checkerboard Event Info Card with gentle float & tilt */}
            <div className="mt-10 hidden lg:block">
              <InteractiveNeonCard
                accentColor="#FF1744"
                hoverLift={-8}
                hoverScale={1.02}
                maxTilt={3.5}
                floatAmplitude={3}
                floatDuration={5.6}
                className="flex items-center gap-4 border border-[#EAE7E0]/20 bg-[#050505] p-4 transition-colors hover:border-[#FF1744]/60"
              >
                <div
                  aria-hidden="true"
                  className="poster-checker relative z-10 h-12 w-12 shrink-0 border border-[#EAE7E0]/25 transition-transform duration-300 group-hover/neoncard:rotate-6"
                />
                <div className="relative z-10">
                  <p className="font-mono-num text-[11px] tracking-widest text-[#FF1744] uppercase">
                    18 Dec 2026
                  </p>
                  <p className="font-display text-xl font-bold text-[#EAE7E0] uppercase">
                    Quad AI · Bengaluru
                  </p>
                </div>
              </InteractiveNeonCard>
            </div>
          </RevealBlock>

          <div className="lg:col-span-8">
            <SectionDividerLine />
            <motion.dl
              variants={shouldReduceMotion ? undefined : staggerContainerVariants}
              initial={shouldReduceMotion ? false : 'hidden'}
              whileInView="visible"
              viewport={{ once: true, amount: 0.15 }}
              className="divide-y divide-[#EAE7E0]/15 border-b border-[#EAE7E0]/15"
            >
              {EVENT_DETAILS.map((row) => (
                <motion.div
                  key={row.label}
                  variants={shouldReduceMotion ? undefined : staggerItemVariants}
                  whileHover={
                    shouldReduceMotion
                      ? undefined
                      : { x: 6, y: -3, transition: { duration: 0.2, ease: EDITORIAL_EASE } }
                  }
                  whileTap={shouldReduceMotion ? undefined : { scale: 0.99 }}
                  className="group relative grid grid-cols-1 gap-2 px-3 py-6 transition-colors duration-200 hover:bg-[#FF1744]/[0.06] sm:grid-cols-12 sm:items-baseline"
                >
                  <span
                    aria-hidden="true"
                    className="absolute top-2 bottom-2 left-0 w-[2px] origin-center scale-y-0 bg-[#FF1744] shadow-[0_0_10px_rgba(255,23,68,0.85)] transition-transform duration-200 group-hover:scale-y-100"
                  />
                  <dt className="font-mono-num text-xs font-semibold tracking-widest text-[#FF1744] uppercase sm:col-span-4">
                    {row.label}
                  </dt>
                  <dd className="sm:col-span-8">
                    <p className="font-display text-2xl font-black tracking-tight text-[#EAE7E0] uppercase sm:text-3xl">
                      {row.value}
                    </p>
                    {row.secondary && (
                      <p className="mt-1 text-sm text-[#EAE7E0]/75">{row.secondary}</p>
                    )}
                  </dd>
                </motion.div>
              ))}
            </motion.dl>
          </div>
        </div>

        {/* Event Atmosphere Concert Photography Showcase (Image Locked) */}
        <RevealBlock delay={0.12} className="mt-14">
          <InteractiveNeonCard
            accentColor="#FF1744"
            hoverLift={-8}
            hoverScale={1.015}
            maxTilt={3}
            className="group border border-[#EAE7E0]/20 bg-[#050505] p-2"
          >
            <div className="relative z-10 aspect-[16/9] max-h-[480px] w-full overflow-hidden">
              <img
                src="/src/assets/images/atmosphere_auditorium_concert_1795714857422.jpg"
                alt="Large Indian university auditorium concert stage with red spotlights, live musicians, and energized audience silhouettes"
                referrerPolicy="no-referrer"
                className="h-full w-full object-cover object-center transition-transform duration-700 ease-out group-hover:scale-[1.03]"
              />
              <div
                aria-hidden="true"
                className="absolute inset-0 bg-gradient-to-t from-[#050505]/88 via-[#050505]/25 to-transparent"
              />
              <div className="absolute right-5 bottom-4 left-5 flex flex-col justify-between gap-2 sm:flex-row sm:items-end sm:right-8 sm:bottom-6 sm:left-8">
                <div>
                  <p className="font-mono-num text-xs tracking-widest text-[#FF1744] uppercase">
                    Event Atmosphere
                  </p>
                  <p className="mt-1 font-display text-2xl font-black tracking-wide text-[#EAE7E0] uppercase sm:text-4xl">
                    Full Auditorium Sound · Crimson Stage Lights
                  </p>
                </div>
                <p className="text-xs tracking-widest text-[#EAE7E0]/75 uppercase">
                  Live Crowd · Quad AI Bengaluru
                </p>
              </div>
            </div>
          </InteractiveNeonCard>
        </RevealBlock>
      </div>
    </section>
  );
}
