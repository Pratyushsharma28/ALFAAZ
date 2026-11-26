import { useState } from 'react';
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

function getInitialIntroOpen(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.sessionStorage.getItem(DEFAULT_STORAGE_KEY) !== 'true';
  } catch {
    return true;
  }
}

export default function App() {
  const [isIntroOpen, setIsIntroOpen] = useState<boolean>(getInitialIntroOpen);
  const shouldReduceMotion = useReducedMotion();

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
          aria-hidden={isIntroOpen}
          className="relative flex min-h-screen flex-col"
        >
          <Navbar />

          <main className="flex-1">
            <HeroSection onOpenPoster={() => setIsIntroOpen(true)} />
            <CountdownSection />
            <AboutSection />
            <CategoriesSection />
            <PricingSection />
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
