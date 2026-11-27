import { MouseEvent } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Eye } from 'lucide-react';
import { EDITORIAL_EASE, RevealBlock, scrollToSection, SectionDividerLine } from './MotionPrimitives';

interface FooterProps {
  onOpenPoster: () => void;
  onOpenMyTickets: () => void;
}

const FOOTER_LINKS = [
  { label: 'Home', href: '#top' },
  { label: 'Countdown', href: '#countdown' },
  { label: 'About', href: '#about' },
  { label: 'Categories', href: '#categories' },
  { label: 'Registration', href: '#passes' },
  { label: 'Prizes', href: '#prizes' },
  { label: 'Event Details', href: '#details' },
  { label: 'FAQ', href: '#faq' },
];

export function Footer({ onOpenPoster, onOpenMyTickets }: FooterProps) {
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
        className="pointer-events-none absolute -bottom-16 left-8 hidden h-64 w-64 rounded-full bg-[#D500F9]/14 blur-3xl md:block"
      />

      <div className="relative mx-auto max-w-[1440px] px-6 lg:px-10">
        <RevealBlock className="grid grid-cols-1 gap-10 pb-12 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:items-center lg:gap-8">
          {/* LEFT: Existing Footer Branding */}
          <div className="min-w-0">
            <p className="font-mono-num text-xs tracking-widest text-[#C8F36B] uppercase">
              18 December 2026 · Quad AI, Bengaluru
            </p>
            <h2 className="mt-3 font-display text-[clamp(3rem,9.5vw,8rem)] leading-[0.82] font-black tracking-tight text-[#EAE7E0] uppercase lg:text-[clamp(3.25rem,5vw,5.75rem)]">
              ALFAAZ <span className="neon-text-crimson text-[#FF1744]">UNFILTERED</span>
            </h2>
          </div>

          {/* CENTER: Dedicated Navigation Section */}
          <div className="flex flex-col items-start lg:items-center lg:justify-self-center">
            <p className="font-mono-num text-[11px] font-semibold tracking-[0.22em] text-[#EAE7E0]/55 uppercase">
              Navigation
            </p>
            <nav
              aria-label="Footer navigation"
              className="mt-3.5 grid w-full max-w-[340px] grid-flow-col grid-cols-2 grid-rows-5 gap-x-8 gap-y-1 text-sm font-medium text-[#EAE7E0]/80 sm:w-auto sm:max-w-none lg:mt-4 lg:gap-x-10 lg:gap-y-1.5"
            >
              {FOOTER_LINKS.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={(e) => handleFooterNav(e, link.href)}
                  className="group relative inline-flex min-h-[44px] w-fit items-center py-1 whitespace-nowrap transition-colors duration-150 hover:text-[#FF1744] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF1744] lg:min-h-[34px]"
                >
                  <span>{link.label}</span>
                  <span
                    aria-hidden="true"
                    className="absolute right-0 bottom-1.5 left-0 h-[1.5px] origin-left scale-x-0 bg-[#FF1744] shadow-[0_0_8px_rgba(255,23,68,0.8)] transition-transform duration-200 group-hover:scale-x-100 lg:bottom-0.5"
                  />
                </a>
              ))}
              <a
                href="/my-tickets"
                onClick={(e) => {
                  e.preventDefault();
                  onOpenMyTickets();
                }}
                className="group relative inline-flex min-h-[44px] w-fit items-center py-1 whitespace-nowrap text-[#C8F36B] transition-colors duration-150 hover:text-[#EAE7E0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8F36B] lg:min-h-[34px]"
              >
                <span>My Tickets</span>
                <span
                  aria-hidden="true"
                  className="absolute right-0 bottom-1.5 left-0 h-[1.5px] origin-left scale-x-0 bg-[#C8F36B] shadow-[0_0_8px_rgba(200,243,107,0.8)] transition-transform duration-200 group-hover:scale-x-100 lg:bottom-0.5"
                />
              </a>
            </nav>
          </div>

          {/* RIGHT: Official Poster Trigger + Instagram & Location Links */}
          <div className="flex flex-col gap-5 lg:items-end lg:justify-self-end">
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

            <div className="flex flex-wrap items-center gap-3 lg:justify-end">
              <motion.a
                href="https://www.instagram.com/joinmyquad?utm_source=ig_web_button_share_sheet&dmpr=ZDNlZDc0MzIxNw=="
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Follow us on Instagram"
                title="Follow us on Instagram"
                whileHover={shouldReduceMotion ? undefined : { scale: 1.05, y: -2 }}
                whileTap={shouldReduceMotion ? undefined : { scale: 0.96 }}
                transition={{ duration: 0.18, ease: EDITORIAL_EASE }}
                className="group inline-flex min-h-[44px] items-center gap-2.5 border border-[#EAE7E0]/20 bg-[#050505] px-4 py-2.5 font-mono-num text-xs font-semibold tracking-widest text-[#EAE7E0] uppercase transition-all duration-200 hover:border-[#D500F9] hover:text-[#D500F9] hover:shadow-[0_0_22px_rgba(213,0,249,0.48)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D500F9]"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.9"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-4 w-4 shrink-0 transition-all duration-200 group-hover:drop-shadow-[0_0_8px_rgba(213,0,249,0.85)]"
                  aria-hidden="true"
                >
                  <rect x="2.5" y="2.5" width="19" height="19" rx="5.5" />
                  <circle cx="12" cy="12" r="4.25" />
                  <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
                </svg>
                <span>INSTAGRAM</span>
              </motion.a>

              <motion.a
                href="https://maps.app.goo.gl/zeidDGL9ST8U6fer8"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Find the event location"
                title="Find the event location"
                whileHover={shouldReduceMotion ? undefined : { scale: 1.05, y: -2 }}
                whileTap={shouldReduceMotion ? undefined : { scale: 0.96 }}
                transition={{ duration: 0.18, ease: EDITORIAL_EASE }}
                className="group inline-flex min-h-[44px] items-center gap-2.5 border border-[#EAE7E0]/20 bg-[#050505] px-4 py-2.5 font-mono-num text-xs font-semibold tracking-widest text-[#EAE7E0] uppercase transition-all duration-200 hover:border-[#00E5FF] hover:text-[#00E5FF] hover:shadow-[0_0_22px_rgba(0,229,255,0.48)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00E5FF]"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.9"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-4 w-4 shrink-0 transition-all duration-200 group-hover:drop-shadow-[0_0_8px_rgba(0,229,255,0.85)]"
                  aria-hidden="true"
                >
                  <path d="M12 21.5s6.5-6.1 6.5-11.75a6.5 6.5 0 1 0-13 0C5.5 15.4 12 21.5 12 21.5Z" />
                  <circle cx="12" cy="9.75" r="2.5" />
                </svg>
                <span>LOCATION</span>
              </motion.a>
            </div>
          </div>
        </RevealBlock>

        <SectionDividerLine />

        <div className="mt-8 flex flex-col justify-between gap-4 text-xs text-[#EAE7E0]/70 sm:flex-row sm:items-center">
          <p>Organised by Social and Cultural Team, Quad AI · Bengaluru</p>
          <p className="font-mono-num text-[#C8F36B]">No Rules. Just Raw Talent.</p>
        </div>
      </div>
    </footer>
  );
}
