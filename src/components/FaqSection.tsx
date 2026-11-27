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
    id: 'audience-vs-participant',
    question: 'What is the difference between Participant and Audience registration?',
    answer:
      'Participant Registration (Individual ₹99, Couple ₹149, Group ₹199) is for performers taking the stage in Dance, Singing, or Poetry and competing for cash prizes. Audience Registration is a fixed ₹59 per person watch-only pass to attend and enjoy the show—it does not include stage participation or performance rights.',
  },
  {
    id: 'registration',
    question: 'How do I complete registration and receive my QR ticket?',
    answer:
      'Choose Participant or Audience registration, fill in your details, scan the official ALFAAZ UPI QR code to pay, and upload your UTR and payment screenshot. Once an organizer verifies your payment, download your signed QR pass anytime from My Tickets.',
  },
  {
    id: 'perks',
    question: 'Who receives certificates and event goodies?',
    answer:
      'Certificates and event goodies from the Social and Cultural Team, Quad AI are awarded to winners only, alongside the ₹10,000 total cash prize pool.',
  },
  {
    id: 'multiple-categories',
    question: 'Can I participate in more than one category?',
    answer:
      'Yes, performers can select multiple categories across Dance, Singing, or Poetry during Participant Registration as long as stage slots are confirmed during check-in at Quad AI, Bengaluru on 18 December 2026.',
  },
  {
    id: 'prizes',
    question: 'How is the prize pool distributed?',
    answer:
      'The top three standout acts take home ₹5,000 (1st), ₹3,000 (2nd), and ₹2,000 (3rd), evaluated on raw energy, originality, stage command, and audience resonance.',
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
                      id={`faq-trigger-${item.id}`}
                      type="button"
                      aria-expanded={isOpen}
                      aria-controls={`faq-panel-${item.id}`}
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
                          id={`faq-panel-${item.id}`}
                          role="region"
                          aria-labelledby={`faq-trigger-${item.id}`}
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
