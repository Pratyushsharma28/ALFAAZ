import { useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Minus, Plus } from 'lucide-react';
import { EDITORIAL_EASE, RevealBlock, SectionDividerLine } from './MotionPrimitives';

interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

const FAQ_ITEMS: FaqItem[] = [
  {
    id: 'no-rules',
    question: 'What does "No Rules. Just Raw Talent." mean?',
    answer:
      'There are no rigid theme constraints, dress codes, or language restrictions. Performers across Dance, Singing, and Poetry are free to present original work, remixes, classical or street choreography, or multilingual spoken word—just keep sets within your allotted stage slot.',
  },
  {
    id: 'registration',
    question: 'How do I complete registration and choose my pass?',
    answer:
      'Pick Individual (₹99), Couple (₹149), or Group (₹199) in the Passes section and submit your details via the official Google Form shared by the Social and Cultural Team, Quad AI. No account login or payment gateway is built into this page.',
  },
  {
    id: 'perks',
    question: 'Do all registered participants receive certificates and goodies?',
    answer:
      'Yes. Every registered participant receives an official participation certificate and event goodies from the Social and Cultural Team, Quad AI, regardless of podium placement.',
  },
  {
    id: 'multiple-categories',
    question: 'Can I participate in more than one category?',
    answer:
      'Yes, you can perform across Dance, Singing, or Poetry as long as your stage slots are registered and confirmed during check-in at Quad AI, Bengaluru on 18 December 2026.',
  },
  {
    id: 'prizes',
    question: 'How is the prize pool distributed?',
    answer:
      'The top three standout acts take home ₹5,000 (1st), ₹3,000 (2nd), and ₹1,000 (3rd), evaluated on raw energy, originality, stage command, and audience resonance.',
  },
];

export function FaqSection() {
  const [openId, setOpenId] = useState<string>(FAQ_ITEMS[0].id);
  const shouldReduceMotion = useReducedMotion();

  return (
    <section
      id="faq"
      className="scroll-mt-20 border-b border-[#EAE7E0]/15 bg-[#050505] py-20 lg:py-28"
    >
      <div className="mx-auto max-w-[1440px] px-6 lg:px-10">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-12">
          <RevealBlock className="lg:col-span-4">
            <p className="font-mono-num text-xs font-medium tracking-widest text-[#C8F36B] uppercase">
              06. Frequently Asked
            </p>
            <h2 className="mt-3 font-display text-[clamp(3.25rem,5.5vw,4.75rem)] leading-[0.86] font-black tracking-tight text-[#EAE7E0] uppercase">
              Questions &amp; Answers.
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-[#EAE7E0]/75">
              Quick clarity on passes, stage slots, certificates, and cash awards for 18 December
              2026.
            </p>
          </RevealBlock>

          <RevealBlock delay={0.1} className="lg:col-span-8">
            <SectionDividerLine />
            <div className="divide-y divide-[#EAE7E0]/15 border-b border-[#EAE7E0]/15">
              {FAQ_ITEMS.map((item, idx) => {
                const isOpen = openId === item.id;
                return (
                  <motion.div
                    key={item.id}
                    whileHover={
                      shouldReduceMotion
                        ? undefined
                        : { x: 4, transition: { duration: 0.18, ease: EDITORIAL_EASE } }
                    }
                    className={`group relative transition-colors duration-200 ${
                      isOpen ? 'bg-[#FF1744]/[0.04]' : 'hover:bg-[#FF1744]/[0.03]'
                    }`}
                  >
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      onClick={() => setOpenId(isOpen ? '' : item.id)}
                      className="flex min-h-[64px] w-full cursor-pointer items-center justify-between gap-6 px-2 py-5 text-left transition-colors hover:text-[#FF1744] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF1744]"
                    >
                      <div className="flex items-baseline gap-4">
                        <span className="font-mono-num text-xs text-[#FF1744]">0{idx + 1}</span>
                        <span className="font-display text-2xl font-extrabold tracking-tight text-[#EAE7E0] uppercase transition-colors group-hover:text-[#EAE7E0] sm:text-3xl">
                          {item.question}
                        </span>
                      </div>
                      <motion.span
                        animate={shouldReduceMotion ? undefined : { rotate: isOpen ? 180 : 0 }}
                        whileHover={shouldReduceMotion ? undefined : { scale: 1.08 }}
                        whileTap={shouldReduceMotion ? undefined : { scale: 0.92 }}
                        transition={{ duration: 0.22, ease: EDITORIAL_EASE }}
                        className={`flex h-9 w-9 shrink-0 items-center justify-center border transition-all duration-200 ${
                          isOpen
                            ? 'border-[#FF1744] bg-[#FF1744] text-[#EAE7E0] shadow-[0_0_16px_rgba(255,23,68,0.6)]'
                            : 'border-[#EAE7E0]/25 text-[#FF1744] group-hover:border-[#FF1744]/65 group-hover:shadow-[0_0_12px_rgba(255,23,68,0.28)]'
                        }`}
                      >
                        {isOpen ? (
                          <Minus className="h-4 w-4" aria-hidden="true" />
                        ) : (
                          <Plus className="h-4 w-4" aria-hidden="true" />
                        )}
                      </motion.span>
                    </button>

                    <AnimatePresence initial={false}>
                      {isOpen && (
                        <motion.div
                          initial={
                            shouldReduceMotion
                              ? { opacity: 1 }
                              : { height: 0, opacity: 0 }
                          }
                          animate={
                            shouldReduceMotion
                              ? { opacity: 1 }
                              : { height: 'auto', opacity: 1 }
                          }
                          exit={
                            shouldReduceMotion
                              ? { opacity: 0 }
                              : { height: 0, opacity: 0 }
                          }
                          transition={
                            shouldReduceMotion
                              ? { duration: 0.01 }
                              : { duration: 0.28, ease: EDITORIAL_EASE }
                          }
                          className="overflow-hidden"
                        >
                          <div className="pb-6 pl-8 pr-10">
                            <p className="max-w-2xl text-sm leading-relaxed text-[#EAE7E0]/80 sm:text-base">
                              {item.answer}
                            </p>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </div>
          </RevealBlock>
        </div>
      </div>
    </section>
  );
}
