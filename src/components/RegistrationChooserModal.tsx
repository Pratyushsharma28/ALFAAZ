import { useEffect } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ArrowUpRight, Eye, Mic2, Sparkles, X } from 'lucide-react';
import { EDITORIAL_EASE } from './MotionPrimitives';

export interface RegistrationChooserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onChooseParticipant: () => void;
  onChooseAudience: () => void;
}

export function RegistrationChooserModal({
  isOpen,
  onClose,
  onChooseParticipant,
  onChooseAudience,
}: RegistrationChooserModalProps) {
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    if (!isOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-labelledby="chooser-modal-title"
          initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0 }}
          transition={shouldReduceMotion ? { duration: 0.01 } : { duration: 0.22 }}
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[#050505]/92 p-4 backdrop-blur-md sm:p-6"
          onClick={onClose}
        >
          <motion.div
            initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 18, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.985 }}
            transition={shouldReduceMotion ? { duration: 0.01 } : { duration: 0.28, ease: EDITORIAL_EASE }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-4xl border border-[#EAE7E0]/20 bg-[#08080A] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.85)] sm:p-8"
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-4 border-b border-[#EAE7E0]/15 pb-5">
              <div>
                <p className="font-mono-num text-[11px] font-semibold tracking-widest text-[#C8F36B] uppercase">
                  ALFAAZ — UNFILTERED · 18 DECEMBER 2026 · QUAD AI, BENGALURU
                </p>
                <h2
                  id="chooser-modal-title"
                  className="mt-1.5 font-display text-3xl font-black tracking-tight text-[#EAE7E0] uppercase sm:text-4xl"
                >
                  Choose How You&apos;re Joining
                </h2>
                <p className="mt-1 text-sm text-[#EAE7E0]/75">
                  Select whether you are registering to perform on stage or joining as an audience guest.
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close registration chooser"
                className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center border border-[#EAE7E0]/25 bg-[#050505] text-[#EAE7E0] transition-colors hover:border-[#FF1744] hover:text-[#FF1744] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF1744]"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            {/* Two Clearly Separated Paths */}
            <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2">
              {/* Path 1: Participant Registration */}
              <div className="flex flex-col justify-between border border-[#FF1744]/55 bg-[#0D0608] p-6 transition-colors hover:border-[#FF1744]">
                <div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-mono-num text-[11px] font-bold tracking-widest text-[#FF1744] uppercase">
                      01 · STAGE PERFORMER
                    </span>
                    <Mic2 className="h-5 w-5 text-[#FF1744]" aria-hidden="true" />
                  </div>

                  <h3 className="mt-3 font-display text-3xl font-black tracking-tight text-[#EAE7E0] uppercase">
                    Participant Registration
                  </h3>

                  <p className="mt-2 font-mono-num text-lg font-bold text-[#C8F36B] tabular-nums">
                    ₹99 Individual · ₹149 Couple · ₹199 Group
                  </p>

                  <p className="mt-3 text-sm leading-relaxed text-[#EAE7E0]/80">
                    For solo artists, duos, and crews performing live on stage in Dance, Singing, or
                    Poetry and competing for the ₹10,000 cash prize pool.
                  </p>

                  <ul className="mt-4 space-y-1.5 border-t border-[#EAE7E0]/12 pt-4 text-xs text-[#EAE7E0]/75">
                    <li>· Live stage performance slot (Dance / Singing / Poetry)</li>
                    <li>· Competes for ₹10,000 total cash prizes</li>
                    <li>· Issues verified Participant Pass QR ticket</li>
                  </ul>
                </div>

                <button
                  type="button"
                  onClick={onChooseParticipant}
                  className="mt-6 inline-flex min-h-[46px] w-full cursor-pointer items-center justify-center gap-2 border border-[#FF1744] bg-[#FF1744] px-5 py-3 font-display text-lg font-extrabold tracking-wider text-[#EAE7E0] uppercase transition-all hover:bg-[#ff2b54] hover:shadow-[0_0_26px_rgba(255,23,68,0.65)] whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EAE7E0]"
                >
                  <span>Register as Participant</span>
                  <ArrowUpRight className="h-4 w-4 shrink-0" aria-hidden="true" />
                </button>
              </div>

              {/* Path 2: Audience Registration */}
              <div className="flex flex-col justify-between border border-[#00E5FF]/55 bg-[#050C10] p-6 transition-colors hover:border-[#00E5FF]">
                <div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-mono-num text-[11px] font-bold tracking-widest text-[#00E5FF] uppercase">
                      02 · WATCH ONLY PASS
                    </span>
                    <Eye className="h-5 w-5 text-[#00E5FF]" aria-hidden="true" />
                  </div>

                  <h3 className="mt-3 font-display text-3xl font-black tracking-tight text-[#EAE7E0] uppercase">
                    Audience Registration
                  </h3>

                  <p className="mt-2 font-mono-num text-lg font-bold text-[#00E5FF] tabular-nums">
                    ₹59 Fixed · Per Person
                  </p>

                  <p className="mt-3 text-sm leading-relaxed text-[#EAE7E0]/80">
                    For guests coming to experience the live performances from the auditorium floor.
                    Quick 2-step form and UPI checkout.
                  </p>

                  <ul className="mt-4 space-y-1.5 border-t border-[#EAE7E0]/12 pt-4 text-xs text-[#EAE7E0]/75">
                    <li>· Full auditorium entry (4:00 PM – 9:00 PM)</li>
                    <li>· Watch-only entry — no stage performance rights</li>
                    <li>· Issues distinct verified Audience Pass QR ticket</li>
                  </ul>
                </div>

                <button
                  type="button"
                  onClick={onChooseAudience}
                  className="mt-6 inline-flex min-h-[46px] w-full cursor-pointer items-center justify-center gap-2 border border-[#00E5FF] bg-[#00E5FF] px-5 py-3 font-display text-lg font-extrabold tracking-wider text-[#050505] uppercase transition-all hover:bg-[#33ebff] hover:shadow-[0_0_26px_rgba(0,229,255,0.5)] whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EAE7E0]"
                >
                  <span>Register as Audience · ₹59</span>
                  <Sparkles className="h-4 w-4 shrink-0" aria-hidden="true" />
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
