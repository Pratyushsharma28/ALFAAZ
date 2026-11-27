import { lazy, Suspense, useEffect, useState } from 'react';
import { motion, MotionConfig, useReducedMotion } from 'motion/react';
import { DEFAULT_STORAGE_KEY, IntroPopup } from './components/IntroPopup';
import { Navbar } from './components/Navbar';
import { HeroSection } from './components/HeroSection';
import { CountdownSection } from './components/CountdownSection';
import { AboutSection } from './components/AboutSection';
import { CategoriesSection } from './components/CategoriesSection';
import { PricingSection } from './components/PricingSection';
import { PrizePoolSection } from './components/PrizePoolSection';
import { EventDetailsSection } from './components/EventDetailsSection';
import { FaqSection } from './components/FaqSection';
import { Footer } from './components/Footer';
import { EDITORIAL_EASE } from './components/MotionPrimitives';
import { RegistrationModal } from './components/RegistrationModal';
import { EntryPassTierId, ParticipationCategory } from './types/registration';

const AdminPortal = lazy(() => import('./components/admin/AdminPortal'));

function isAdminPath(pathname: string): boolean {
  const normalized = pathname.replace(/\/+$/, '') || '/';
  return normalized === '/admin' || normalized.startsWith('/admin/');
}

function getInitialIntroOpen(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.sessionStorage.getItem(DEFAULT_STORAGE_KEY) !== 'true';
  } catch {
    return true;
  }
}

export default function App() {
  const [pathname, setPathname] = useState<string>(() =>
    typeof window !== 'undefined' ? window.location.pathname : '/'
  );
  const [isIntroOpen, setIsIntroOpen] = useState<boolean>(getInitialIntroOpen);
  const [registrationOpen, setRegistrationOpen] = useState<boolean>(false);
  const [regPreset, setRegPreset] = useState<{
    passTier: EntryPassTierId;
    category?: ParticipationCategory;
  }>({ passTier: 'individual' });
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    const onPopState = () => {
      setPathname(window.location.pathname);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  if (isAdminPath(pathname)) {
    return (
      <MotionConfig reducedMotion="user">
        <Suspense
          fallback={
            <div className="underground-surface flex min-h-screen items-center justify-center bg-[#050505] text-[#EAE7E0]">
              <p className="font-mono-num text-xs tracking-widest text-[#EAE7E0]/75 uppercase">
                Loading Admin Portal...
              </p>
            </div>
          }
        >
          <AdminPortal />
        </Suspense>
      </MotionConfig>
    );
  }

  const openRegistration = (options?: {
    passTier?: EntryPassTierId;
    category?: ParticipationCategory;
  }) => {
    setRegPreset({
      passTier: options?.passTier ?? 'individual',
      category: options?.category,
    });
    setRegistrationOpen(true);
  };

  return (
    <MotionConfig reducedMotion="user">
      <div className="relative min-h-screen overflow-x-clip bg-[#050505] text-[#EAE7E0]">
        {/* Subtle film grain texture across the editorial canvas */}
        <div
          aria-hidden="true"
          className="grain-overlay pointer-events-none fixed inset-0 z-40 opacity-[0.04]"
        />

        {/* Opening Official Poster Experience */}
        <IntroPopup isOpen={isIntroOpen} onClose={() => setIsIntroOpen(false)} />

        {/* Integrated Multi-Step Registration + Razorpay Checkout Experience */}
        <RegistrationModal
          isOpen={registrationOpen}
          initialPassTier={regPreset.passTier}
          initialCategory={regPreset.category}
          onClose={() => setRegistrationOpen(false)}
        />

        {/* Main Website Shell — smoothly revealed when IntroPopup closes */}
        <motion.div
          initial={false}
          animate={{
            opacity: isIntroOpen ? 0.18 : 1,
            scale: isIntroOpen && !shouldReduceMotion ? 0.985 : 1,
          }}
          transition={
            shouldReduceMotion
              ? { duration: 0.01 }
              : { duration: 0.55, ease: EDITORIAL_EASE }
          }
          aria-hidden={isIntroOpen || registrationOpen}
          className="relative flex min-h-screen flex-col"
        >
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:border focus:border-[#FF1744] focus:bg-[#050505] focus:px-4 focus:py-2 focus:font-mono-num focus:text-xs focus:font-semibold focus:tracking-widest focus:text-[#EAE7E0] focus:uppercase"
          >
            Skip to main content
          </a>
          <Navbar onOpenRegistration={() => openRegistration()} />

          <main id="main-content" tabIndex={-1} className="flex-1 outline-none">
            <HeroSection
              onOpenPoster={() => setIsIntroOpen(true)}
              onOpenRegistration={() => openRegistration()}
            />
            <CountdownSection />
            <AboutSection />
            <CategoriesSection onOpenRegistration={openRegistration} />
            <PricingSection onOpenRegistration={openRegistration} />
            <PrizePoolSection />
            <EventDetailsSection />
            <FaqSection />
          </main>

          <Footer onOpenPoster={() => setIsIntroOpen(true)} />
        </motion.div>
      </div>
    </MotionConfig>
  );
}
