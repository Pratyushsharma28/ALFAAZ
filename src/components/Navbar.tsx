import { MouseEvent, useEffect, useState } from 'react';
import {
  AnimatePresence,
  motion,
  useReducedMotion,
  useScroll,
  useSpring,
} from 'motion/react';
import { ArrowUpRight, Menu, X } from 'lucide-react';
import { EDITORIAL_EASE, OFFICIAL_GOOGLE_FORM_URL, scrollToSection } from './MotionPrimitives';

const NAV_LINKS = [
  { label: 'About', href: '#about', id: 'about' },
  { label: 'Categories', href: '#categories', id: 'categories' },
  { label: 'Passes', href: '#passes', id: 'passes' },
  { label: 'Prizes', href: '#prizes', id: 'prizes' },
  { label: 'FAQ', href: '#faq', id: 'faq' },
];

interface ShieldPathData {
  d: string;
  transform: string;
}

const QUAD_AI_SVG_URL = '/assets/aistudio/Quad_AI_Crimson__1__cf26c6bf.svg';

export function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeId, setActiveId] = useState<string>('');
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [shieldPaths, setShieldPaths] = useState<ShieldPathData[]>([]);
  const shouldReduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 220,
    damping: 32,
    restDelta: 0.001,
  });

  useEffect(() => {
    const sections = NAV_LINKS.map((l) => document.getElementById(l.id)).filter(
      Boolean
    ) as HTMLElement[];

    if (sections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        }
      },
      { rootMargin: '-30% 0px -55% 0px', threshold: 0.05 }
    );

    sections.forEach((sec) => observer.observe(sec));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mobileMenuOpen]);

  useEffect(() => {
    let cancelled = false;
    fetch(QUAD_AI_SVG_URL)
      .then((res) => (res.ok ? res.text() : ''))
      .then((svgText) => {
        if (cancelled || !svgText) return;
        const doc = new DOMParser().parseFromString(svgText, 'image/svg+xml');
        const paths = Array.from(doc.querySelectorAll('path'))
          .map((el) => ({
            d: el.getAttribute('d') ?? '',
            transform: el.getAttribute('transform') ?? '',
          }))
          .filter((item) => {
            if (!item.d) return false;
            const match = item.transform.match(/translate\(([^,]+),/);
            const tx = match ? parseFloat(match[1]) : 0;
            return tx < 4000;
          });
        if (!cancelled && paths.length > 0) {
          setShieldPaths(paths);
        }
      })
      .catch(() => {
        // Ignore network errors cleanly
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleNavClick = (event: MouseEvent<HTMLAnchorElement>, href: string) => {
    event.preventDefault();
    setMobileMenuOpen(false);
    scrollToSection(href, shouldReduceMotion);
  };

  return (
    <header className="sticky top-0 z-30 border-b border-[#EAE7E0]/15 bg-[#050505]/92 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-2 px-6 py-4 md:gap-8 lg:px-10">
        {/* Zone 1: Unified ALFAAZ X QUAD AI brand lockup using exact uploaded Quad AI SVG emblem */}
        <a
          href="#top"
          aria-label="ALFAAZ X QUAD AI — Back to top"
          onClick={(e) => {
            setActiveId('');
            handleNavClick(e, '#top');
          }}
          className="inline-flex items-center gap-1.5 font-display text-[17px] leading-none font-black tracking-tight text-[#EAE7E0] uppercase transition-all duration-200 hover:text-[#FF1744] hover:drop-shadow-[0_0_12px_rgba(255,23,68,0.55)] whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF1744] sm:gap-2 sm:text-2xl"
        >
          <span>ALFAAZ</span>
          <span aria-hidden="true">X</span>
          <svg
            viewBox="460 445 2980 3115"
            preserveAspectRatio="xMidYMid meet"
            fill="currentColor"
            aria-hidden="true"
            className="h-[15px] w-[14px] shrink-0 sm:h-[20px] sm:w-[19px]"
          >
            {shieldPaths.map((p, idx) => (
              <path key={idx} d={p.d} transform={p.transform} />
            ))}
          </svg>
          <span>QUAD AI</span>
        </a>

        {/* Zone 2: 5 concise single-line text links with neon crimson active & hover underlines */}
        <nav
          aria-label="Primary navigation"
          className="hidden md:flex items-center gap-8 text-sm font-medium text-[#EAE7E0]/75"
        >
          {NAV_LINKS.map((link) => {
            const isActive = activeId === link.id;
            const isHovered = hoveredId === link.id;
            return (
              <a
                key={link.href}
                href={link.href}
                aria-current={isActive ? 'location' : undefined}
                onClick={(e) => handleNavClick(e, link.href)}
                onMouseEnter={() => setHoveredId(link.id)}
                onMouseLeave={() => setHoveredId(null)}
                className={`relative py-1 transition-all duration-200 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF1744] ${
                  isActive
                    ? 'text-[#FF1744] drop-shadow-[0_0_10px_rgba(255,23,68,0.45)]'
                    : 'hover:text-[#EAE7E0] hover:drop-shadow-[0_0_8px_rgba(255,23,68,0.35)]'
                }`}
              >
                <span>{link.label}</span>
                {isActive && (
                  <motion.span
                    layoutId={shouldReduceMotion ? undefined : 'navbar-active-underline'}
                    transition={{ duration: 0.28, ease: EDITORIAL_EASE }}
                    className="absolute right-0 bottom-0 left-0 h-[2px] bg-[#FF1744] shadow-[0_0_10px_rgba(255,23,68,0.85)]"
                  />
                )}
                {!isActive && (
                  <motion.span
                    aria-hidden="true"
                    initial={false}
                    animate={{ scaleX: isHovered ? 1 : 0 }}
                    transition={
                      shouldReduceMotion
                        ? { duration: 0.01 }
                        : { duration: 0.2, ease: EDITORIAL_EASE }
                    }
                    className="absolute right-0 bottom-0 left-0 h-[1.5px] origin-left bg-[#FF1744] shadow-[0_0_8px_rgba(255,23,68,0.7)]"
                  />
                )}
              </a>
            );
          })}
        </nav>

        {/* Zone 3: 1 primary neon crimson Register Now action + mobile trigger */}
        <div className="flex items-center gap-3 shrink-0">
          <motion.a
            href={OFFICIAL_GOOGLE_FORM_URL}
            target="_blank"
            rel="noopener noreferrer"
            whileHover={shouldReduceMotion ? undefined : { scale: 1.04, y: -2 }}
            whileTap={shouldReduceMotion ? undefined : { scale: 0.96 }}
            transition={{ duration: 0.18, ease: EDITORIAL_EASE }}
            className="neon-cta-breathe group inline-flex min-h-[40px] cursor-pointer items-center gap-1.5 border border-[#FF1744]/80 bg-[#FF1744] px-5 py-2 font-display text-base font-extrabold tracking-wider text-[#EAE7E0] uppercase transition-all duration-200 hover:bg-[#ff2b54] hover:shadow-[0_0_30px_rgba(255,23,68,0.75)] whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EAE7E0]"
          >
            <span>Register Now</span>
            <ArrowUpRight
              className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:rotate-12"
              aria-hidden="true"
            />
          </motion.a>

          <motion.button
            type="button"
            whileHover={shouldReduceMotion ? undefined : { scale: 1.05 }}
            whileTap={shouldReduceMotion ? undefined : { scale: 0.94 }}
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={mobileMenuOpen}
            className="flex h-10 w-10 min-h-[40px] min-w-[40px] cursor-pointer items-center justify-center border border-[#EAE7E0]/25 text-[#EAE7E0] transition-colors hover:border-[#FF1744] hover:text-[#FF1744] md:hidden"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </motion.button>
        </div>
      </div>

      {/* Scroll Reading Progress Bar in Neon Crimson */}
      {!shouldReduceMotion && (
        <motion.div
          aria-hidden="true"
          style={{ scaleX }}
          className="h-[2px] w-full origin-left bg-[#FF1744] shadow-[0_0_10px_rgba(255,23,68,0.75)]"
        />
      )}

      {/* Animated Mobile Navigation Drawer */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.nav
            aria-label="Mobile navigation"
            initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
            transition={
              shouldReduceMotion
                ? { duration: 0.01 }
                : { duration: 0.24, ease: EDITORIAL_EASE }
            }
            className="overflow-hidden border-t border-[#EAE7E0]/15 bg-[#050505] px-6 md:hidden"
          >
            <ul className="flex flex-col divide-y divide-[#EAE7E0]/10 py-2">
              {NAV_LINKS.map((link) => {
                const isActive = activeId === link.id;
                return (
                  <li key={link.href}>
                    <a
                      href={link.href}
                      aria-current={isActive ? 'location' : undefined}
                      onClick={(e) => handleNavClick(e, link.href)}
                      className={`flex min-h-[44px] items-center justify-between py-3 text-sm font-medium transition-colors ${
                        isActive ? 'text-[#FF1744]' : 'text-[#EAE7E0]/85 hover:text-[#FF1744]'
                      }`}
                    >
                      <span>{link.label}</span>
                      {isActive && (
                        <span
                          aria-hidden="true"
                          className="h-1.5 w-1.5 rounded-full bg-[#FF1744] shadow-[0_0_8px_#FF1744]"
                        />
                      )}
                    </a>
                  </li>
                );
              })}
              <li className="pt-3 pb-2">
                <a
                  href={OFFICIAL_GOOGLE_FORM_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setMobileMenuOpen(false)}
                  className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 border border-[#FF1744] bg-[#FF1744] px-5 py-2.5 font-display text-lg font-extrabold tracking-wider text-[#EAE7E0] uppercase"
                >
                  <span>Register Now</span>
                  <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                </a>
              </li>
            </ul>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}
