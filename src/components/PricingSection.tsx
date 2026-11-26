import { useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { ArrowUpRight, Check, Copy } from 'lucide-react';
import {
  EDITORIAL_EASE,
  InteractiveNeonCard,
  OFFICIAL_GOOGLE_FORM_URL,
  RevealBlock,
  SectionDividerLine,
  staggerContainerVariants,
  staggerItemVariants,
} from './MotionPrimitives';

export type PassTierId = 'individual' | 'couple' | 'group';

interface PassTier {
  id: PassTierId;
  index: string;
  name: string;
  price: string;
  scope: string;
  description: string;
}

const PASS_TIERS: PassTier[] = [
  {
    id: 'individual',
    index: '01',
    name: 'Individual',
    price: '₹99',
    scope: '1 Entry',
    description:
      'Solo performer entry or single listener pass for the entire 4–9 PM evening, with participation certificate and goodies.',
  },
  {
    id: 'couple',
    index: '02',
    name: 'Couple',
    price: '₹149',
    scope: '2 Entries',
    description:
      'Built for duos or two friends attending together, with certificates and curated goodies for registered participants.',
  },
  {
    id: 'group',
    index: '03',
    name: 'Group',
    price: '₹199',
    scope: 'Crew & Squad',
    description:
      'Designed for dance crews, vocal ensembles, and friend squads hitting the stage together at Quad AI, Bengaluru.',
  },
];

export function PricingSection() {
  const [selectedTier, setSelectedTier] = useState<PassTierId>('individual');
  const [copiedSummary, setCopiedSummary] = useState(false);
  const shouldReduceMotion = useReducedMotion();

  const activeTier = PASS_TIERS.find((t) => t.id === selectedTier) ?? PASS_TIERS[0];

  const handleCopySummary = async () => {
    const text = `ALFAAZ — UNFILTERED | 18 Dec 2026 | Quad AI, Bengaluru | Pass: ${activeTier.name} (${activeTier.price})`;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedSummary(true);
      window.setTimeout(() => setCopiedSummary(false), 2400);
    } catch {
      setCopiedSummary(false);
    }
  };

  return (
    <section
      id="passes"
      className="underground-surface relative scroll-mt-20 overflow-hidden border-b border-[#EAE7E0]/15 py-20 lg:py-28"
    >
      {/* Floating Neon Ambient Blobs */}
      <motion.div
        aria-hidden="true"
        animate={
          shouldReduceMotion
            ? undefined
            : { x: [0, 26, 0], y: [0, -18, 0], scale: [1, 1.12, 1], opacity: [0.06, 0.14, 0.06] }
        }
        transition={
          shouldReduceMotion
            ? undefined
            : { duration: 13, repeat: Infinity, ease: 'easeInOut' }
        }
        className="pointer-events-none absolute top-20 -left-16 h-80 w-80 rounded-full bg-[#FF1744]/14 blur-3xl"
      />
      <motion.div
        aria-hidden="true"
        animate={
          shouldReduceMotion
            ? undefined
            : { x: [0, -20, 0], y: [0, 22, 0], scale: [1, 1.1, 1], opacity: [0.04, 0.1, 0.04] }
        }
        transition={
          shouldReduceMotion
            ? undefined
            : { duration: 15, repeat: Infinity, ease: 'easeInOut', delay: 1.5 }
        }
        className="pointer-events-none absolute right-0 bottom-16 h-72 w-72 rounded-full bg-[#C8F36B]/10 blur-3xl"
      />

      <div className="relative mx-auto max-w-[1440px] px-6 lg:px-10">
        <RevealBlock className="flex flex-col justify-between gap-6 pb-8 md:flex-row md:items-end">
          <div>
            <p className="font-mono-num text-xs font-medium tracking-widest text-[#C8F36B] uppercase">
              03. Registration Pricing
            </p>
            <h2 className="mt-3 font-display text-[clamp(3.25rem,6.5vw,5.75rem)] leading-[0.86] font-black tracking-tight text-[#EAE7E0] uppercase">
              Entry <span className="neon-text-crimson text-[#FF1744]">Passes</span>.
            </h2>
          </div>

          <p className="max-w-md text-sm leading-relaxed text-[#EAE7E0]/75">
            Every registered participant receives an official participation certificate and goodies.
            All passes register directly via the official Google Form.
          </p>
        </RevealBlock>
        <SectionDividerLine />

        {/* Asymmetric Stepped Entry Pass Ticket Cards */}
        <motion.div
          variants={shouldReduceMotion ? undefined : staggerContainerVariants}
          initial={shouldReduceMotion ? false : 'hidden'}
          whileInView="visible"
          viewport={{ once: true, amount: 0.15 }}
          className="mt-12 grid grid-cols-1 items-stretch gap-6 md:grid-cols-12"
        >
          {PASS_TIERS.map((tier, idx) => {
            const isSelected = tier.id === selectedTier;
            return (
              <motion.div
                key={tier.id}
                variants={shouldReduceMotion ? undefined : staggerItemVariants}
                className="md:col-span-4"
              >
                <InteractiveNeonCard
                  role="button"
                  tabIndex={0}
                  ariaPressed={isSelected}
                  accentColor="#FF1744"
                  hoverLift={-13}
                  hoverScale={1.035}
                  maxTilt={6}
                  floatAmplitude={5}
                  floatDuration={5.2 + idx * 0.7}
                  floatDelay={idx * 0.45}
                  onClick={() => setSelectedTier(tier.id)}
                  className={`flex h-full cursor-pointer flex-col justify-between border p-7 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF1744] ${
                    isSelected
                      ? 'border-[#FF1744] bg-[#0B0507] shadow-[0_0_32px_rgba(255,23,68,0.28)]'
                      : 'border-[#EAE7E0]/20 bg-[#050505] hover:border-[#FF1744]/65'
                  }`}
                >
                  {isSelected && (
                    <motion.div
                      layoutId={shouldReduceMotion ? undefined : 'pass-selected-badge'}
                      transition={{ duration: 0.24, ease: EDITORIAL_EASE }}
                      aria-hidden="true"
                      className="neon-badge-pulse absolute top-0 right-0 z-10 bg-[#FF1744] px-3 py-1 font-mono-num text-[10px] font-bold tracking-widest text-[#EAE7E0] uppercase shadow-[0_0_14px_rgba(255,23,68,0.75)]"
                    >
                      Selected
                    </motion.div>
                  )}

                  <div className="relative z-10">
                    <div className="flex items-center justify-between text-xs tracking-widest uppercase">
                      <span className="font-mono-num text-[#FF1744]">{tier.index}</span>
                      <span className="text-[#EAE7E0]/60">{tier.scope}</span>
                    </div>

                    <div className="mt-5 flex items-baseline justify-between gap-4 border-b border-[#EAE7E0]/15 pb-5">
                      <h3 className="font-display text-4xl font-black tracking-tight text-[#EAE7E0] uppercase">
                        {tier.name}
                      </h3>
                      <span className="font-display text-6xl font-black text-[#C8F36B] tabular-nums transition-transform duration-300 group-hover/neoncard:scale-105">
                        {tier.price}
                      </span>
                    </div>

                    <p className="mt-5 text-sm leading-relaxed text-[#EAE7E0]/80">
                      {tier.description}
                    </p>
                  </div>

                  {/* Subtle Ticket Perforation Notch Divider */}
                  <div className="relative z-10 my-5 flex items-center" aria-hidden="true">
                    <span className="-ml-9 h-4 w-4 rounded-full border border-[#EAE7E0]/15 bg-[#050505]" />
                    <div className="ticket-notch-glow h-px flex-1 border-t border-dashed border-[#FF1744]/40" />
                    <span className="-mr-9 h-4 w-4 rounded-full border border-[#EAE7E0]/15 bg-[#050505]" />
                  </div>

                  <motion.a
                    href={OFFICIAL_GOOGLE_FORM_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedTier(tier.id);
                    }}
                    whileHover={shouldReduceMotion ? undefined : { scale: 1.03, y: -1 }}
                    whileTap={shouldReduceMotion ? undefined : { scale: 0.96 }}
                    transition={{ duration: 0.16, ease: EDITORIAL_EASE }}
                    className={`group relative z-10 inline-flex min-h-[44px] w-full cursor-pointer items-center justify-center gap-2 px-5 py-3 font-display text-lg font-extrabold tracking-wider uppercase transition-all duration-200 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EAE7E0] ${
                      isSelected
                        ? 'neon-cta-breathe border border-[#FF1744] bg-[#FF1744] text-[#EAE7E0] hover:bg-[#ff2b54] hover:shadow-[0_0_32px_rgba(255,23,68,0.78)]'
                        : 'border border-[#EAE7E0]/25 text-[#EAE7E0] hover:border-[#FF1744] hover:text-[#FF1744] hover:shadow-[0_0_18px_rgba(255,23,68,0.28)]'
                    }`}
                  >
                    <span>Register Now · {tier.price}</span>
                    <ArrowUpRight
                      className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:rotate-12"
                      aria-hidden="true"
                    />
                  </motion.a>
                </InteractiveNeonCard>
              </motion.div>
            );
          })}
        </motion.div>

        {/* Dark Crimson-Accent Google Form Handoff Panel */}
        <RevealBlock delay={0.1} className="mt-8">
          <InteractiveNeonCard
            accentColor="#FF1744"
            hoverLift={-8}
            hoverScale={1.015}
            maxTilt={3}
            className="flex flex-col justify-between gap-6 border border-[#FF1744]/45 bg-[#090507] p-6 shadow-[0_0_32px_rgba(255,23,68,0.14)] sm:p-8 lg:flex-row lg:items-center"
          >
            <div className="relative z-10">
              <p className="neon-badge-pulse font-mono-num text-xs font-semibold tracking-widest text-[#FF1744] uppercase">
                Official Google Form Registration
              </p>
              <h3 className="mt-1 font-display text-3xl font-black tracking-tight text-[#EAE7E0] uppercase sm:text-4xl">
                {activeTier.name} Pass —{' '}
                <span className="text-[#C8F36B] tabular-nums">{activeTier.price}</span>
              </h3>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#EAE7E0]/75">
                Complete your entry directly on the official Social and Cultural Team Google Form. No
                login or online payment gateway is required on this page.
              </p>
            </div>

            <div className="relative z-10 flex flex-wrap items-center gap-3 shrink-0">
              <motion.button
                type="button"
                onClick={handleCopySummary}
                whileHover={shouldReduceMotion ? undefined : { scale: 1.03, y: -1 }}
                whileTap={shouldReduceMotion ? undefined : { scale: 0.96 }}
                transition={{ duration: 0.16, ease: EDITORIAL_EASE }}
                className="group inline-flex min-h-[44px] cursor-pointer items-center gap-2 border border-[#00E5FF]/40 bg-[#050505] px-4 py-2.5 text-xs font-semibold tracking-wider text-[#EAE7E0] uppercase transition-all duration-200 hover:border-[#00E5FF] hover:text-[#00E5FF] hover:shadow-[0_0_18px_rgba(0,229,255,0.3)] whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00E5FF]"
              >
                {copiedSummary ? (
                  <>
                    <Check
                      className="h-4 w-4 text-[#C8F36B] transition-transform duration-200 group-hover:scale-110"
                      aria-hidden="true"
                    />
                    Pass Info Copied
                  </>
                ) : (
                  <>
                    <Copy
                      className="h-4 w-4 text-[#00E5FF] transition-transform duration-200 group-hover:scale-110 group-hover:-rotate-6"
                      aria-hidden="true"
                    />
                    Copy Pass Summary
                  </>
                )}
              </motion.button>

              <motion.a
                href={OFFICIAL_GOOGLE_FORM_URL}
                target="_blank"
                rel="noopener noreferrer"
                whileHover={shouldReduceMotion ? undefined : { scale: 1.04, y: -2 }}
                whileTap={shouldReduceMotion ? undefined : { scale: 0.96 }}
                transition={{ duration: 0.18, ease: EDITORIAL_EASE }}
                className="neon-cta-breathe group inline-flex min-h-[44px] items-center gap-2 border border-[#FF1744] bg-[#FF1744] px-6 py-3 font-display text-lg font-extrabold tracking-wider text-[#EAE7E0] uppercase transition-all duration-200 hover:bg-[#ff2b54] hover:shadow-[0_0_34px_rgba(255,23,68,0.8)] whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EAE7E0]"
              >
                <span>Register Now</span>
                <ArrowUpRight
                  className="h-5 w-5 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:rotate-12"
                  aria-hidden="true"
                />
              </motion.a>
            </div>
          </InteractiveNeonCard>
        </RevealBlock>
      </div>
    </section>
  );
}
