import { motion, useReducedMotion } from 'motion/react';
import {
  AmbientNeonParticles,
  InteractiveNeonCard,
  RevealBlock,
  SectionDividerLine,
  staggerContainerVariants,
  staggerItemVariants,
} from './MotionPrimitives';

interface PrizeTier {
  rank: string;
  label: string;
  amount: string;
  note: string;
  colSpan: string;
  highlight?: boolean;
}

const PRIZES: PrizeTier[] = [
  {
    rank: '01',
    label: 'First Place',
    amount: '₹5,000',
    note: 'Grand Showcase Winner',
    colSpan: 'lg:col-span-5',
    highlight: true,
  },
  {
    rank: '02',
    label: 'Second Place',
    amount: '₹3,000',
    note: 'Runner-Up Honour',
    colSpan: 'lg:col-span-4 lg:mt-6',
  },
  {
    rank: '03',
    label: 'Third Place',
    amount: '₹1,000',
    note: 'Third Place Recognition',
    colSpan: 'lg:col-span-3 lg:mt-12',
  },
];

export function PrizePoolSection() {
  const shouldReduceMotion = useReducedMotion();

  return (
    <section
      id="prizes"
      className="relative scroll-mt-20 overflow-hidden border-b border-[#EAE7E0]/15 bg-[#0A0406] py-20 text-[#EAE7E0] lg:py-28"
    >
      {/* Subtle Floating Crimson & Lime Ambient Backdrop + Particles */}
      <motion.div
        aria-hidden="true"
        animate={shouldReduceMotion ? { opacity: 0.22 } : { opacity: [0.16, 0.26, 0.16] }}
        transition={
          shouldReduceMotion
            ? undefined
            : { duration: 7.5, repeat: Infinity, ease: 'easeInOut' }
        }
        className="diagonal-slash-left pointer-events-none absolute -bottom-16 -left-12 h-80 w-[48%] bg-[#FF1744]/25"
      />
      <motion.div
        aria-hidden="true"
        animate={
          shouldReduceMotion
            ? undefined
            : { x: [0, -24, 0], y: [0, 18, 0], scale: [1, 1.15, 1], opacity: [0.07, 0.16, 0.07] }
        }
        transition={
          shouldReduceMotion
            ? undefined
            : { duration: 12.5, repeat: Infinity, ease: 'easeInOut' }
        }
        className="pointer-events-none absolute top-10 right-[10%] hidden h-72 w-72 rounded-full bg-[#FF1744]/16 blur-3xl md:block"
      />
      <AmbientNeonParticles />

      <div className="relative mx-auto max-w-[1440px] px-6 lg:px-10">
        <RevealBlock className="flex flex-col justify-between gap-6 pb-8 md:flex-row md:items-end">
          <div>
            <p className="font-mono-num text-xs font-medium tracking-widest text-[#FF1744] uppercase">
              04. Prize Pool
            </p>
            <h2 className="mt-3 font-display text-[clamp(3.25rem,6.5vw,5.75rem)] leading-[0.86] font-black tracking-tight uppercase">
              <span className="neon-text-crimson text-[#FF1744]">₹9,000</span> Cash Pool.
            </h2>
          </div>

          <p className="max-w-md text-sm leading-relaxed text-[#EAE7E0]/85">
            Three podium awards for standout live performances—plus certificates and goodies for
            every registered participant.
          </p>
        </RevealBlock>
        <SectionDividerLine />

        {/* Asymmetrical Stepped Podium Grid (5 / 4 / 3 columns) */}
        <motion.div
          variants={shouldReduceMotion ? undefined : staggerContainerVariants}
          initial={shouldReduceMotion ? false : 'hidden'}
          whileInView="visible"
          viewport={{ once: true, amount: 0.15 }}
          className="mt-12 grid grid-cols-1 items-start gap-6 lg:grid-cols-12"
        >
          {PRIZES.map((prize, idx) => (
            <motion.div
              key={prize.rank}
              variants={shouldReduceMotion ? undefined : staggerItemVariants}
              className={prize.colSpan}
            >
              <InteractiveNeonCard
                accentColor={prize.highlight ? '#FF1744' : '#C8F36B'}
                hoverLift={-10}
                hoverScale={1.02}
                maxTilt={4.5}
                floatAmplitude={prize.highlight ? 4 : 2.5}
                floatDuration={5 + idx * 0.65}
                floatDelay={idx * 0.35}
                className={`flex flex-col justify-between border p-8 transition-colors duration-200 ${
                  prize.highlight
                    ? 'border-[#FF1744] bg-[#050505] text-[#EAE7E0] shadow-[0_0_28px_rgba(255,23,68,0.24)]'
                    : 'border-[#EAE7E0]/20 bg-[#050505]/90 text-[#EAE7E0] hover:border-[#C8F36B]/55'
                }`}
              >
                <div className="relative z-10 flex items-center justify-between text-xs tracking-widest uppercase">
                  <span
                    className={`font-mono-num text-[#FF1744] ${
                      prize.highlight ? 'neon-badge-pulse' : ''
                    }`}
                  >
                    Rank {prize.rank}
                  </span>
                  <span className="text-[#EAE7E0]/75">{prize.note}</span>
                </div>

                <div className="relative z-10 my-8">
                  <p
                    className={`font-display leading-none font-black tabular-nums transition-transform duration-300 group-hover/neoncard:scale-105 origin-left ${
                      prize.highlight
                        ? 'neon-text-crimson text-[clamp(4.5rem,7vw,6.5rem)] text-[#FF1744]'
                        : 'text-[clamp(3.5rem,5vw,4.75rem)] text-[#C8F36B]'
                    }`}
                  >
                    {prize.amount}
                  </p>
                  <h3 className="mt-3 font-display text-3xl font-extrabold tracking-tight uppercase">
                    {prize.label}
                  </h3>
                </div>

                <p className="relative z-10 border-t border-[#EAE7E0]/15 pt-4 text-xs tracking-wider text-[#EAE7E0]/70 uppercase">
                  Trophy · Official Certificate
                </p>
              </InteractiveNeonCard>
            </motion.div>
          ))}
        </motion.div>

        {/* Bottom Guarantee Strip */}
        <RevealBlock delay={0.15} className="mt-10">
          <InteractiveNeonCard
            accentColor="#FF1744"
            hoverLift={-8}
            hoverScale={1.015}
            maxTilt={2.5}
            className="flex flex-col justify-between gap-4 border border-[#FF1744]/40 bg-[#050505] p-6 sm:flex-row sm:items-center sm:px-8"
          >
            <p className="relative z-10 font-display text-2xl font-extrabold tracking-wide text-[#EAE7E0] uppercase sm:text-3xl">
              Every Registered Participant Receives A Participation Certificate &amp; Goodies.
            </p>
            <span className="relative z-10 font-mono-num text-xs tracking-widest text-[#C8F36B] uppercase whitespace-nowrap shrink-0">
              All Participants · 18 Dec 2026
            </span>
          </InteractiveNeonCard>
        </RevealBlock>
      </div>
    </section>
  );
}
