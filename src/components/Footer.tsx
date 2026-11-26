import { MouseEvent } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Eye } from 'lucide-react';
import { EDITORIAL_EASE, RevealBlock, scrollToSection, SectionDividerLine } from './MotionPrimitives';

interface FooterProps {
  onOpenPoster: () => void;
}

const FOOTER_LINKS = [
  { label: 'About', href: '#about' },
  { label: 'Categories', href: '#categories' },
  { label: 'Passes', href: '#passes' },
  { label: 'Prizes', href: '#prizes' },
  { label: 'Details', href: '#details' },
  { label: 'FAQ', href: '#faq' },
];

export function Footer({ onOpenPoster }: FooterProps) {
  const shouldReduceMotion = useReducedMotion();

  const handleFooterNav = (event: MouseEvent<HTMLAnchorElement>, href: string) => {
    event.preventDefault();
    scrollToSection(href, shouldReduceMotion);
  };

  return (
    <footer className="underground-surface relative overflow-hidden pt-16 pb-10 text-[#EAE7E0]">
      <motion.div
        aria-hidden="true"
        animate={shouldReduceMotion ? { opacity: 0.18 } : { opacity: [0.14, 0.24, 0.14] }}
        transition={
          shouldReduceMotion
            ? undefined
            : { duration: 7.5, repeat: Infinity, ease: 'easeInOut' }
        }
        className="diagonal-slash-right pointer-events-none absolute top-0 right-0 h-56 w-72 bg-[#FF1744]/55"
      />

      <motion.div
        aria-hidden="true"
        animate={
          shouldReduceMotion
            ? undefined
            : { x: [0, 20, 0], y: [0, -14, 0], opacity: [0.05, 0.12, 0.05] }
        }
        transition={
          shouldReduceMotion
            ? undefined
            : { duration: 14, repeat: Infinity, ease: 'easeInOut' }
        }
        className="pointer-events-none absolute -bottom-16 left-8 h-64 w-64 rounded-full bg-[#D500F9]/14 blur-3xl"
      />

      <div className="relative mx-auto max-w-[1440px] px-6 lg:px-10">
        <RevealBlock className="grid grid-cols-1 gap-10 pb-12 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-7">
            <p className="font-mono-num text-xs tracking-widest text-[#C8F36B] uppercase">
              18 December 2026 · Quad AI, Bengaluru
            </p>
            <h2 className="mt-3 font-display text-[clamp(3rem,9.5vw,8rem)] leading-[0.82] font-black tracking-tight text-[#EAE7E0] uppercase">
              ALFAAZ <span className="neon-text-crimson text-[#FF1744]">UNFILTERED</span>
            </h2>
          </div>

          <div className="flex flex-col gap-6 lg:col-span-5 lg:items-end">
            <nav
              aria-label="Footer navigation"
              className="flex flex-wrap gap-6 text-sm text-[#EAE7E0]/75"
            >
              {FOOTER_LINKS.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={(e) => handleFooterNav(e, link.href)}
                  className="group relative py-1 transition-colors duration-150 hover:text-[#FF1744] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF1744]"
                >
                  <span>{link.label}</span>
                  <span
                    aria-hidden="true"
                    className="absolute right-0 bottom-0 left-0 h-[1.5px] origin-left scale-x-0 bg-[#FF1744] shadow-[0_0_8px_rgba(255,23,68,0.8)] transition-transform duration-200 group-hover:scale-x-100"
                  />
                </a>
              ))}
            </nav>

            <motion.button
              type="button"
              onClick={onOpenPoster}
              whileHover={shouldReduceMotion ? undefined : { scale: 1.04, y: -2 }}
              whileTap={shouldReduceMotion ? undefined : { scale: 0.96 }}
              transition={{ duration: 0.18, ease: EDITORIAL_EASE }}
              className="group inline-flex min-h-[44px] w-fit cursor-pointer items-center gap-2 border border-[#00E5FF]/40 bg-[#050505] px-5 py-2.5 text-xs font-semibold tracking-wider text-[#EAE7E0] uppercase transition-all duration-200 hover:border-[#00E5FF] hover:text-[#00E5FF] hover:shadow-[0_0_24px_rgba(0,229,255,0.34)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00E5FF]"
            >
              <Eye
                className="h-4 w-4 text-[#00E5FF] transition-transform duration-200 group-hover:scale-125 group-hover:-rotate-6"
                aria-hidden="true"
              />
              Reopen Official Poster
            </motion.button>
          </div>
        </RevealBlock>

        <SectionDividerLine />

        <div className="mt-8 flex flex-col justify-between gap-4 text-xs text-[#EAE7E0]/60 sm:flex-row sm:items-center">
          <p>Organised by Social and Cultural Team, Quad AI · Bengaluru</p>
          <p className="font-mono-num text-[#C8F36B]">No Rules. Just Raw Talent.</p>
        </div>
      </div>
    </footer>
  );
}
