import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ArrowUpRight } from 'lucide-react';
import {
  AmbientNeonParticles,
  EDITORIAL_EASE,
  InteractiveNeonCard,
  OFFICIAL_GOOGLE_FORM_URL,
  RevealBlock,
  SectionDividerLine,
  staggerContainerVariants,
  staggerItemVariants,
} from './MotionPrimitives';

interface CategoryItem {
  id: 'dance' | 'singing' | 'poetry';
  index: string;
  title: string;
  subtitle: string;
  image: string;
  imageAlt: string;
  duration: string;
  formats: string;
  description: string;
  criteria: string[];
  offsetClass: string;
  accentHex: string;
  activeBorderClass: string;
  hoverBorderClass: string;
  badgeActiveClass: string;
}

const CATEGORIES: CategoryItem[] = [
  {
    id: 'dance',
    index: '01',
    title: 'Dance',
    subtitle: 'Movement · Choreography · Freestyle',
    image: '/src/assets/images/dance_indian_crew_stage_1795714857180.jpg',
    imageAlt:
      'Group of young Indian dancers performing a synchronized hip-hop and contemporary routine on a concert stage',
    duration: '3–5 min per set',
    formats: 'Solo · Couple · Crew',
    description:
      'Hip-hop, contemporary, classical fusion, krump, or pure improv. Command the Quad AI floor with live energy and music that hits hard.',
    criteria: ['Stage presence & crowd command', 'Musicality & originality', 'Execution & flow'],
    offsetClass: '',
    accentHex: '#00E5FF',
    activeBorderClass:
      'border-[#00E5FF] bg-[#060B0D] shadow-[0_0_30px_rgba(0,229,255,0.22)]',
    hoverBorderClass:
      'border-[#EAE7E0]/20 bg-[#050505] hover:border-[#00E5FF]/65 hover:shadow-[0_0_24px_rgba(0,229,255,0.16)]',
    badgeActiveClass: 'bg-[#00E5FF] text-black shadow-[0_0_16px_rgba(0,229,255,0.65)]',
  },
  {
    id: 'singing',
    index: '02',
    title: 'Singing',
    subtitle: 'Vocals · Originals · Acoustic',
    image: '/src/assets/images/singing_indian_female_concert_1795714855686.jpg',
    imageAlt:
      'Young Indian female vocalist singing confidently into a microphone on a crimson-lit auditorium stage',
    duration: '3–4 min per set',
    formats: 'Acapella · Acoustic · Backing Track',
    description:
      'Bring indie originals, soulful classical melodies, acoustic covers, or raw rap verses. One mic, full room acoustics, and zero autotune.',
    criteria: ['Vocal tone & pitch control', 'Emotional authenticity', 'Audience connection'],
    offsetClass: 'lg:mt-14',
    accentHex: '#FF1744',
    activeBorderClass:
      'border-[#FF1744] bg-[#0D0508] shadow-[0_0_30px_rgba(255,23,68,0.26)]',
    hoverBorderClass:
      'border-[#EAE7E0]/20 bg-[#050505] hover:border-[#FF1744]/65 hover:shadow-[0_0_24px_rgba(255,23,68,0.18)]',
    badgeActiveClass: 'bg-[#FF1744] text-[#EAE7E0] shadow-[0_0_16px_rgba(255,23,68,0.65)]',
  },
  {
    id: 'poetry',
    index: '03',
    title: 'Poetry',
    subtitle: 'Spoken Word · Slam · Shayari',
    image: '/src/assets/images/poetry_indian_spoken_word_1795714855215.jpg',
    imageAlt:
      'Young Indian spoken-word poet gesturing expressively at a microphone under an open-mic stage spotlight',
    duration: '3–4 min per piece',
    formats: 'English · Hindi · Urdu · Regional',
    description:
      'Unfiltered storytelling, slam poetry, and late-night shayari. Speak your piece straight from handwritten pages or pure memory.',
    criteria: ['Lyrical craft & imagery', 'Voice modulation & pacing', 'Original voice'],
    offsetClass: 'lg:mt-4',
    accentHex: '#D500F9',
    activeBorderClass:
      'border-[#D500F9] bg-[#0B050E] shadow-[0_0_30px_rgba(213,0,249,0.24)]',
    hoverBorderClass:
      'border-[#EAE7E0]/20 bg-[#050505] hover:border-[#D500F9]/65 hover:shadow-[0_0_24px_rgba(213,0,249,0.18)]',
    badgeActiveClass: 'bg-[#D500F9] text-[#EAE7E0] shadow-[0_0_16px_rgba(213,0,249,0.65)]',
  },
];

const EQ_BARS = [0.4, 0.9, 0.55, 1, 0.65, 0.85, 0.45];
const POETRY_WORDS = ['WORDS', 'SOUL', 'FEEL', 'EXPRESS'] as const;

export function CategoriesSection() {
  const [activeId, setActiveId] = useState<CategoryItem['id']>('dance');
  const [hoveredCard, setHoveredCard] = useState<CategoryItem['id'] | null>(null);
  const [panelHovered, setPanelHovered] = useState(false);
  const [poetryWordIdx, setPoetryWordIdx] = useState(0);
  const shouldReduceMotion = useReducedMotion();

  const activeCategory = CATEGORIES.find((c) => c.id === activeId) ?? CATEGORIES[0];

  useEffect(() => {
    if (shouldReduceMotion) return;
    const timer = window.setInterval(() => {
      setPoetryWordIdx((prev) => (prev + 1) % POETRY_WORDS.length);
    }, 2600);
    return () => window.clearInterval(timer);
  }, [shouldReduceMotion]);

  return (
    <section
      id="categories"
      className="relative scroll-mt-20 overflow-hidden border-b border-[#EAE7E0]/15 bg-[#050505] py-20 lg:py-28"
    >
      {/* Subtle Floating Neon Ambient Glows (Cyan / Crimson / Purple) + Particles */}
      <motion.div
        aria-hidden="true"
        animate={shouldReduceMotion ? { opacity: 0.14 } : { opacity: [0.1, 0.2, 0.1] }}
        transition={
          shouldReduceMotion
            ? undefined
            : { duration: 7, repeat: Infinity, ease: 'easeInOut' }
        }
        className="diagonal-slash-right pointer-events-none absolute top-24 right-0 h-80 w-64 bg-[#FF1744]/70"
      />
      <motion.div
        aria-hidden="true"
        animate={
          shouldReduceMotion
            ? undefined
            : { x: [0, 24, 0], y: [0, -20, 0], scale: [1, 1.15, 1], opacity: [0.06, 0.13, 0.06] }
        }
        transition={
          shouldReduceMotion
            ? undefined
            : { duration: 13.5, repeat: Infinity, ease: 'easeInOut' }
        }
        className="pointer-events-none absolute bottom-12 left-8 h-72 w-72 rounded-full bg-[#00E5FF]/12 blur-3xl"
      />
      <motion.div
        aria-hidden="true"
        animate={
          shouldReduceMotion
            ? undefined
            : { x: [0, -24, 0], y: [0, 18, 0], scale: [1, 1.12, 1], opacity: [0.06, 0.14, 0.06] }
        }
        transition={
          shouldReduceMotion
            ? undefined
            : { duration: 15, repeat: Infinity, ease: 'easeInOut', delay: 1.5 }
        }
        className="pointer-events-none absolute top-1/2 right-12 h-72 w-72 rounded-full bg-[#D500F9]/12 blur-3xl"
      />
      <AmbientNeonParticles />

      <div className="relative mx-auto max-w-[1440px] px-6 lg:px-10">
        <RevealBlock className="flex flex-col justify-between gap-6 pb-8 md:flex-row md:items-end">
          <div>
            <p className="font-mono-num text-xs font-medium tracking-widest text-[#C8F36B] uppercase">
              02. Performance Categories
            </p>
            <h2 className="mt-3 font-display text-[clamp(3.25rem,6.5vw,5.75rem)] leading-[0.86] font-black tracking-tight text-[#EAE7E0] uppercase">
              Three Disciplines.{' '}
              <span className="neon-text-cyan text-[#00E5FF]">One</span>{' '}
              <span className="neon-text-crimson text-[#FF1744]">Floor</span>.
            </h2>
          </div>

          <p className="max-w-sm text-sm leading-relaxed text-[#EAE7E0]/75">
            Select <span className="text-[#00E5FF]">Dance</span>,{' '}
            <span className="text-[#FF1744]">Singing</span>, or{' '}
            <span className="text-[#D500F9]">Poetry</span> to inspect stage time, allowed formats,
            and judging focus.
          </p>
        </RevealBlock>
        <SectionDividerLine />

        {/* Staggered Asymmetric Editorial Gallery (All Images Locked) */}
        <motion.div
          variants={shouldReduceMotion ? undefined : staggerContainerVariants}
          initial={shouldReduceMotion ? false : 'hidden'}
          whileInView="visible"
          viewport={{ once: true, amount: 0.15 }}
          className="mt-12 grid grid-cols-1 items-start gap-6 lg:grid-cols-3"
        >
          {CATEGORIES.map((category) => {
            const isSelected = category.id === activeId;
            const isHovered = hoveredCard === category.id;
            return (
              <motion.div
                key={category.id}
                variants={shouldReduceMotion ? undefined : staggerItemVariants}
                className={category.offsetClass}
              >
                <InteractiveNeonCard
                  role="button"
                  tabIndex={0}
                  ariaPressed={isSelected}
                  accentColor={category.accentHex}
                  hoverLift={-12}
                  hoverScale={1.03}
                  maxTilt={6}
                  onClick={() => setActiveId(category.id)}
                  onMouseEnter={() => setHoveredCard(category.id)}
                  onMouseLeave={() => setHoveredCard(null)}
                  className={`group flex cursor-pointer flex-col border text-left transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EAE7E0] ${
                    isSelected ? category.activeBorderClass : category.hoverBorderClass
                  }`}
                >
                  <div className="relative z-10 aspect-[3/4] w-full overflow-hidden bg-[#050505]">
                    <img
                      src={category.image}
                      alt={category.imageAlt}
                      referrerPolicy="no-referrer"
                      className="h-full w-full object-cover object-top transition-transform duration-500 ease-out group-hover:scale-[1.04]"
                    />
                    <div
                      aria-hidden="true"
                      className="absolute inset-0 bg-gradient-to-t from-[#050505] via-[#050505]/35 to-transparent"
                    />

                    {/* Index Tag in Discipline Neon */}
                    <div
                      className={`neon-badge-pulse absolute top-0 left-0 px-3.5 py-2 font-mono-num text-xs font-semibold tracking-widest uppercase transition-all duration-200 ${
                        isSelected
                          ? category.badgeActiveClass
                          : 'bg-[#050505]/85 text-[#EAE7E0] border-r border-b border-[#EAE7E0]/20'
                      }`}
                    >
                      {category.index}
                    </div>

                    {/* Discipline-Specific Neon Micro-Visual in Top Right */}
                    <div
                      aria-hidden="true"
                      className="absolute top-3 right-3 flex items-center gap-1 border border-[#EAE7E0]/15 bg-[#050505]/75 px-2.5 py-1.5 backdrop-blur-xs"
                    >
                      {category.id === 'singing' && (
                        <div className="flex h-3.5 items-end gap-[2px]">
                          {EQ_BARS.slice(0, 5).map((peak, i) => (
                            <motion.span
                              key={i}
                              className="w-[2px] origin-bottom bg-[#FF1744] shadow-[0_0_6px_rgba(255,23,68,0.8)]"
                              style={{ height: '14px' }}
                              animate={
                                shouldReduceMotion
                                  ? { scaleY: peak * 0.7 }
                                  : {
                                      scaleY:
                                        isHovered || isSelected
                                          ? [peak * 0.35, peak, peak * 0.4]
                                          : [peak * 0.3, peak * 0.65, peak * 0.3],
                                    }
                              }
                              transition={
                                shouldReduceMotion
                                  ? undefined
                                  : {
                                      duration: isHovered ? 0.6 + i * 0.08 : 1.2 + i * 0.12,
                                      repeat: Infinity,
                                      ease: 'easeInOut',
                                    }
                              }
                            />
                          ))}
                        </div>
                      )}

                      {category.id === 'poetry' && (
                        <span className="neon-text-purple font-mono-num text-[10px] tracking-[0.2em] text-[#D500F9] uppercase">
                          &ldquo;{POETRY_WORDS[poetryWordIdx]}&rdquo;
                        </span>
                      )}

                      {category.id === 'dance' && (
                        <svg viewBox="0 0 36 12" className="h-3 w-9" fill="none">
                          <motion.path
                            d="M2 8 C 10 2, 16 10, 24 4 C 28 1, 32 9, 34 5"
                            stroke="#00E5FF"
                            strokeWidth="1.6"
                            strokeLinecap="round"
                            animate={
                              shouldReduceMotion
                                ? undefined
                                : {
                                    d: isHovered
                                      ? [
                                          'M2 8 C 10 2, 16 10, 24 4 C 28 1, 32 9, 34 5',
                                          'M2 4 C 10 10, 16 2, 24 8 C 28 10, 32 2, 34 7',
                                          'M2 8 C 10 2, 16 10, 24 4 C 28 1, 32 9, 34 5',
                                        ]
                                      : [
                                          'M2 7 C 10 4, 16 8, 24 5 C 28 4, 32 7, 34 6',
                                          'M2 5 C 10 8, 16 4, 24 7 C 28 8, 32 4, 34 6',
                                          'M2 7 C 10 4, 16 8, 24 5 C 28 4, 32 7, 34 6',
                                        ],
                                  }
                            }
                            transition={
                              shouldReduceMotion
                                ? undefined
                                : {
                                    duration: isHovered ? 0.9 : 2.4,
                                    repeat: Infinity,
                                    ease: 'easeInOut',
                                  }
                            }
                          />
                        </svg>
                      )}
                    </div>

                    <div className="absolute right-0 bottom-0 left-0 p-6">
                      <p
                        className="font-mono-num text-[11px] tracking-widest uppercase"
                        style={{ color: category.accentHex }}
                      >
                        {category.duration}
                      </p>
                      <h3 className="mt-1 font-display text-5xl font-black tracking-tight text-[#EAE7E0] uppercase transition-transform duration-200 group-hover:translate-x-1">
                        {category.title}
                      </h3>
                      <p className="mt-1 text-xs font-medium tracking-wider text-[#EAE7E0]/75 uppercase">
                        {category.subtitle}
                      </p>
                    </div>
                  </div>
                </InteractiveNeonCard>
              </motion.div>
            );
          })}
        </motion.div>

        {/* Active Category Interactive Spec Panel */}
        <InteractiveNeonCard
          accentColor={activeCategory.accentHex}
          hoverLift={-6}
          hoverScale={1.01}
          maxTilt={2.5}
          onMouseEnter={() => setPanelHovered(true)}
          onMouseLeave={() => setPanelHovered(false)}
          className="mt-10 border bg-[#070709] p-6 transition-colors duration-300 sm:p-10"
        >
          <div
            aria-hidden="true"
            style={{ borderColor: `${activeCategory.accentHex}55` }}
            className="pointer-events-none absolute inset-0 border transition-colors duration-300"
          />
          <AnimatePresence mode="wait">
            <motion.div
              key={activeCategory.id}
              initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -10 }}
              transition={
                shouldReduceMotion
                  ? { duration: 0.01 }
                  : { duration: 0.26, ease: EDITORIAL_EASE }
              }
              className="grid grid-cols-1 gap-8 lg:grid-cols-12"
            >
              <div className="lg:col-span-7">
                <div className="flex flex-wrap items-center gap-3 text-xs tracking-widest uppercase">
                  <span
                    className="font-mono-num font-semibold"
                    style={{ color: activeCategory.accentHex }}
                  >
                    {activeCategory.index}. {activeCategory.title}
                  </span>
                  <span aria-hidden="true" className="text-[#EAE7E0]/40">
                    ·
                  </span>
                  <span className="text-[#EAE7E0]/75">{activeCategory.formats}</span>
                  <span aria-hidden="true" className="text-[#EAE7E0]/40">
                    ·
                  </span>
                  <span className="font-mono-num text-[#EAE7E0]/75">
                    {activeCategory.duration}
                  </span>
                </div>

                {/* Discipline-Specific Interactive Neon Expression Module */}
                <div className="mt-4 flex flex-wrap items-center gap-4">
                  {activeCategory.id === 'singing' && (
                    <div className="flex items-center gap-3 border border-[#FF1744]/55 bg-[#050505] px-4 py-2.5 shadow-[0_0_20px_rgba(255,23,68,0.28)]">
                      <div className="flex h-4 items-end gap-[3px]" aria-hidden="true">
                        {EQ_BARS.map((peak, i) => (
                          <motion.span
                            key={i}
                            className="w-[2.5px] origin-bottom bg-[#FF1744] shadow-[0_0_8px_rgba(255,23,68,0.8)]"
                            style={{ height: '16px' }}
                            animate={
                              shouldReduceMotion
                                ? { scaleY: peak * 0.7 }
                                : {
                                    scaleY: panelHovered
                                      ? [peak * 0.35, peak, peak * 0.4]
                                      : [peak * 0.3, peak * 0.75, peak * 0.3],
                                  }
                            }
                            transition={
                              shouldReduceMotion
                                ? undefined
                                : {
                                    duration: panelHovered ? 0.55 + i * 0.08 : 1.05 + i * 0.12,
                                    repeat: Infinity,
                                    ease: 'easeInOut',
                                  }
                            }
                          />
                        ))}
                      </div>
                      <span className="font-mono-num text-[11px] tracking-widest text-[#EAE7E0]/85 uppercase">
                        Crimson Soundwave Active
                      </span>
                    </div>
                  )}

                  {activeCategory.id === 'poetry' && (
                    <div className="flex items-center gap-2 border border-[#D500F9]/55 bg-[#050505] px-4 py-2.5 shadow-[0_0_20px_rgba(213,0,249,0.26)]">
                      <span
                        aria-hidden="true"
                        className="neon-text-purple font-display text-xl text-[#D500F9]"
                      >
                        &ldquo;
                      </span>
                      <AnimatePresence mode="wait">
                        <motion.span
                          key={POETRY_WORDS[poetryWordIdx]}
                          initial={
                            shouldReduceMotion
                              ? { opacity: 1 }
                              : { opacity: 0, y: 4, letterSpacing: '0.3em' }
                          }
                          animate={{ opacity: 1, y: 0, letterSpacing: '0.18em' }}
                          exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
                          transition={
                            shouldReduceMotion
                              ? { duration: 0.01 }
                              : { duration: 0.28, ease: EDITORIAL_EASE }
                          }
                          className="neon-text-purple font-mono-num text-[11px] font-medium text-[#D500F9] uppercase"
                        >
                          {POETRY_WORDS[poetryWordIdx]}
                        </motion.span>
                      </AnimatePresence>
                      <span
                        aria-hidden="true"
                        className="neon-text-purple font-display text-xl text-[#D500F9]"
                      >
                        &rdquo;
                      </span>
                    </div>
                  )}

                  {activeCategory.id === 'dance' && (
                    <div className="flex items-center gap-3 border border-[#00E5FF]/55 bg-[#050505] px-4 py-2.5 shadow-[0_0_20px_rgba(0,229,255,0.24)]">
                      <svg viewBox="0 0 64 16" className="h-4 w-16" fill="none" aria-hidden="true">
                        <motion.path
                          d="M2 11 C 16 2, 28 14, 42 5 C 50 1, 56 12, 62 6"
                          stroke="#00E5FF"
                          strokeWidth="1.7"
                          strokeLinecap="round"
                          animate={
                            shouldReduceMotion
                              ? undefined
                              : {
                                  d: panelHovered
                                    ? [
                                        'M2 11 C 16 2, 28 14, 42 5 C 50 1, 56 12, 62 6',
                                        'M2 5 C 16 14, 28 2, 42 11 C 50 15, 56 3, 62 10',
                                        'M2 11 C 16 2, 28 14, 42 5 C 50 1, 56 12, 62 6',
                                      ]
                                    : [
                                        'M2 9 C 16 5, 28 11, 42 7 C 50 5, 56 10, 62 7',
                                        'M2 7 C 16 11, 28 5, 42 9 C 50 11, 56 5, 62 9',
                                        'M2 9 C 16 5, 28 11, 42 7 C 50 5, 56 10, 62 7',
                                      ],
                                }
                          }
                          transition={
                            shouldReduceMotion
                              ? undefined
                              : {
                                  duration: panelHovered ? 0.95 : 2.5,
                                  repeat: Infinity,
                                  ease: 'easeInOut',
                                }
                          }
                        />
                      </svg>
                      <span className="neon-text-cyan font-mono-num text-[11px] tracking-widest text-[#00E5FF] uppercase">
                        Kinetic Rhythm Path
                      </span>
                    </div>
                  )}
                </div>

                <p className="mt-4 max-w-2xl text-base leading-relaxed text-[#EAE7E0]/85 sm:text-lg">
                  {activeCategory.description}
                </p>
              </div>

              <div className="relative z-10 flex flex-col justify-between gap-6 border-t border-[#EAE7E0]/15 pt-6 lg:col-span-5 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-8">
                <div>
                  <p className="text-xs font-semibold tracking-widest text-[#EAE7E0]/60 uppercase">
                    Stage Focus
                  </p>
                  <ul className="mt-3 space-y-2 text-sm text-[#EAE7E0]/85">
                    {activeCategory.criteria.map((item) => (
                      <li key={item} className="flex items-center gap-3">
                        <span
                          className="font-mono-num text-xs"
                          style={{ color: activeCategory.accentHex }}
                        >
                          /
                        </span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <motion.a
                  href={OFFICIAL_GOOGLE_FORM_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  whileHover={shouldReduceMotion ? undefined : { scale: 1.04, y: -2 }}
                  whileTap={shouldReduceMotion ? undefined : { scale: 0.96 }}
                  transition={{ duration: 0.18, ease: EDITORIAL_EASE }}
                  className="neon-cta-breathe group inline-flex min-h-[44px] w-fit cursor-pointer items-center gap-2 border border-[#FF1744] bg-[#FF1744] px-6 py-3 font-display text-lg font-extrabold tracking-wider text-[#EAE7E0] uppercase transition-all duration-200 hover:bg-[#ff2b54] hover:shadow-[0_0_32px_rgba(255,23,68,0.75)] whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EAE7E0]"
                >
                  <span>Register Now · {activeCategory.title}</span>
                  <ArrowUpRight
                    className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:rotate-12"
                    aria-hidden="true"
                  />
                </motion.a>
              </div>
            </motion.div>
          </AnimatePresence>
        </InteractiveNeonCard>
      </div>
    </section>
  );
}
