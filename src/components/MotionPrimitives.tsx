import { MouseEvent, PointerEvent, ReactNode, useEffect, useRef, useState } from 'react';
import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
  Variants,
} from 'motion/react';

export const EDITORIAL_EASE = [0.16, 1, 0.3, 1] as const;

export const OFFICIAL_GOOGLE_FORM_URL =
  'https://docs.google.com/forms/d/e/1FAIpQLSek8JttdFB7n_ppedqx_BXV4rSbIkWvIPpBKsenPG8nMUdfMw/viewform';

/**
 * Lightweight hook to detect coarse-pointer / small touch screens
 * so idle decorative loops pause on mobile for locked 60 FPS battery-friendly scrolling.
 */
export function useIsCompactOrTouch(): boolean {
  const [isCompact, setIsCompact] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(max-width: 767px), (pointer: coarse)');
    const update = () => setIsCompact(mq.matches);
    update();
    mq.addEventListener?.('change', update);
    return () => mq.removeEventListener?.('change', update);
  }, []);

  return isCompact;
}

interface RevealProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  yOffset?: number;
}

export function RevealBlock({
  children,
  className = '',
  delay = 0,
  yOffset = 18,
}: RevealProps) {
  const shouldReduceMotion = useReducedMotion();

  if (shouldReduceMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: yOffset }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.12 }}
      transition={{ duration: 0.56, delay, ease: EDITORIAL_EASE }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function SectionDividerLine({ className = '' }: { className?: string }) {
  const shouldReduceMotion = useReducedMotion();

  if (shouldReduceMotion) {
    return <div aria-hidden="true" className={`h-px w-full bg-[#EAE7E0]/15 ${className}`} />;
  }

  return (
    <motion.div
      aria-hidden="true"
      initial={{ scaleX: 0, opacity: 0.4 }}
      whileInView={{ scaleX: 1, opacity: 1 }}
      viewport={{ once: true, amount: 0.5 }}
      transition={{ duration: 0.72, ease: EDITORIAL_EASE }}
      className={`h-px w-full origin-left bg-[#EAE7E0]/20 ${className}`}
    />
  );
}

export const staggerContainerVariants: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.09,
    },
  },
};

export const staggerItemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.52,
      ease: EDITORIAL_EASE,
    },
  },
};

export function scrollToSection(href: string, reduceMotion: boolean | null) {
  const id = href.replace(/^#/, '');
  const element = document.getElementById(id);
  if (!element) return;
  element.scrollIntoView({
    behavior: reduceMotion ? 'auto' : 'smooth',
    block: 'start',
  });
}

export interface InteractiveNeonCardProps {
  children: ReactNode;
  className?: string;
  accentColor?: string;
  hoverLift?: number;
  hoverScale?: number;
  maxTilt?: number;
  floatAmplitude?: number;
  floatDuration?: number;
  floatDelay?: number;
  onClick?: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  role?: string;
  tabIndex?: number;
  ariaPressed?: boolean;
}

/**
 * InteractiveNeonCard:
 * Cohesive festival card primitive:
 * - Desktop: GPU 3D cursor tilt, controlled hover lift, subtle scale, cursor spotlight & light sweep.
 * - Mobile/Touch: disables idle float & mouse tilt, retains crisp tap feedback (whileTap).
 */
export function InteractiveNeonCard({
  children,
  className = '',
  accentColor = '#FF1744',
  hoverLift = -9,
  hoverScale = 1.02,
  maxTilt = 4.5,
  floatAmplitude = 0,
  floatDuration = 5.6,
  floatDelay = 0,
  onClick,
  onMouseEnter,
  onMouseLeave,
  role,
  tabIndex,
  ariaPressed,
}: InteractiveNeonCardProps) {
  const shouldReduceMotion = useReducedMotion();
  const isCompactOrTouch = useIsCompactOrTouch();
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [isHovered, setIsHovered] = useState(false);

  const disablePointerTilt = Boolean(shouldReduceMotion || isCompactOrTouch);

  const normX = useMotionValue(0);
  const normY = useMotionValue(0);
  const spotX = useMotionValue(50);
  const spotY = useMotionValue(50);

  const smoothNormX = useSpring(normX, { stiffness: 250, damping: 26, mass: 0.5 });
  const smoothNormY = useSpring(normY, { stiffness: 250, damping: 26, mass: 0.5 });
  const smoothSpotX = useSpring(spotX, { stiffness: 220, damping: 28 });
  const smoothSpotY = useSpring(spotY, { stiffness: 220, damping: 28 });

  const rotateX = useTransform(smoothNormY, [-0.5, 0.5], [maxTilt, -maxTilt]);
  const rotateY = useTransform(smoothNormX, [-0.5, 0.5], [-maxTilt, maxTilt]);

  const spotlightBg = useMotionTemplate`radial-gradient(360px circle at ${smoothSpotX}% ${smoothSpotY}%, ${accentColor}1E, ${accentColor}08 42%, transparent 72%)`;

  const handlePointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (disablePointerTilt || e.pointerType !== 'mouse' || !cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;

    normX.set(px - 0.5);
    normY.set(py - 0.5);
    spotX.set(px * 100);
    spotY.set(py * 100);
  };

  const handlePointerEnter = (e: MouseEvent<HTMLDivElement>) => {
    if (isCompactOrTouch) return;
    setIsHovered(true);
    onMouseEnter?.();
    if (cardRef.current && !shouldReduceMotion) {
      const rect = cardRef.current.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        spotX.set(((e.clientX - rect.left) / rect.width) * 100);
        spotY.set(((e.clientY - rect.top) / rect.height) * 100);
      }
    }
  };

  const handlePointerLeave = () => {
    setIsHovered(false);
    normX.set(0);
    normY.set(0);
    spotX.set(50);
    spotY.set(50);
    onMouseLeave?.();
  };

  const enableFloat = !shouldReduceMotion && !isCompactOrTouch && floatAmplitude > 0;
  const shouldFloat = enableFloat && !isHovered;

  const innerCard = (
    <motion.div
      ref={cardRef}
      role={role}
      tabIndex={tabIndex}
      aria-pressed={ariaPressed}
      onClick={onClick}
      onKeyDown={
        role === 'button' && onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      onPointerMove={handlePointerMove}
      onMouseEnter={handlePointerEnter}
      onMouseLeave={handlePointerLeave}
      style={
        disablePointerTilt
          ? undefined
          : {
              transformPerspective: 1000,
              rotateX,
              rotateY,
              transformStyle: 'preserve-3d',
            }
      }
      whileHover={
        disablePointerTilt
          ? undefined
          : {
              y: hoverLift,
              scale: hoverScale,
              transition: { duration: 0.26, ease: EDITORIAL_EASE },
            }
      }
      whileTap={
        shouldReduceMotion
          ? undefined
          : {
              scale: 0.985,
              transition: { duration: 0.12 },
            }
      }
      className={`group/neoncard relative overflow-hidden ${
        disablePointerTilt ? '' : 'will-change-transform'
      } ${className}`}
    >
      {/* Shifting Cursor Radial Gradient Spotlight (Desktop hover only) */}
      {!disablePointerTilt && (
        <motion.div
          aria-hidden="true"
          style={{ background: spotlightBg }}
          animate={{ opacity: isHovered ? 1 : 0 }}
          transition={{ duration: 0.26, ease: EDITORIAL_EASE }}
          className="pointer-events-none absolute inset-0 z-0"
        />
      )}

      {/* Subtle Diagonal Light Sweep across the card on hover */}
      {!disablePointerTilt && (
        <motion.div
          aria-hidden="true"
          initial={{ x: '-130%', opacity: 0 }}
          animate={
            isHovered
              ? { x: '130%', opacity: [0, 0.48, 0] }
              : { x: '-130%', opacity: 0 }
          }
          transition={{ duration: 0.68, ease: EDITORIAL_EASE }}
          style={{
            background: `linear-gradient(108deg, transparent 22%, ${accentColor}24 46%, rgba(234,231,224,0.14) 50%, ${accentColor}20 54%, transparent 78%)`,
          }}
          className="pointer-events-none absolute inset-y-0 left-0 z-20 w-[75%]"
        />
      )}

      {/* Controlled Neon Perimeter Glow Layer on Hover */}
      {!disablePointerTilt && (
        <div
          aria-hidden="true"
          style={{
            boxShadow: isHovered
              ? `inset 0 0 0 1px ${accentColor}75, 0 20px 44px -14px ${accentColor}30`
              : 'inset 0 0 0 1px transparent',
          }}
          className="pointer-events-none absolute inset-0 z-20 transition-all duration-300"
        />
      )}

      {children}
    </motion.div>
  );

  if (enableFloat) {
    return (
      <motion.div
        animate={shouldFloat ? { y: [0, -floatAmplitude, 0] } : { y: 0 }}
        transition={
          shouldFloat
            ? {
                duration: floatDuration,
                repeat: Infinity,
                ease: 'easeInOut',
                delay: floatDelay,
              }
            : { duration: 0.24, ease: EDITORIAL_EASE }
        }
        className="h-full"
      >
        {innerCard}
      </motion.div>
    );
  }

  return innerCard;
}

interface AmbientParticle {
  left: string;
  top: string;
  size: number;
  color: string;
  duration: number;
  delay: number;
  driftY: number;
}

const DEFAULT_PARTICLES: AmbientParticle[] = [
  { left: '14%', top: '26%', size: 2.5, color: '#FF1744', duration: 8.2, delay: 0, driftY: -16 },
  { left: '64%', top: '20%', size: 2.5, color: '#D500F9', duration: 9.4, delay: 0.8, driftY: -14 },
  { left: '84%', top: '64%', size: 2.5, color: '#00E5FF', duration: 8.8, delay: 1.5, driftY: -18 },
];

export function AmbientNeonParticles({
  particles = DEFAULT_PARTICLES,
}: {
  particles?: AmbientParticle[];
}) {
  const shouldReduceMotion = useReducedMotion();
  const isCompactOrTouch = useIsCompactOrTouch();
  if (shouldReduceMotion || isCompactOrTouch) return null;

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      {particles.map((p, idx) => (
        <motion.span
          key={idx}
          style={{
            left: p.left,
            top: p.top,
            width: `${p.size}px`,
            height: `${p.size}px`,
            backgroundColor: p.color,
            boxShadow: `0 0 8px ${p.color}`,
          }}
          animate={{
            y: [0, p.driftY, 0],
            opacity: [0.12, 0.45, 0.12],
          }}
          transition={{
            duration: p.duration,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: p.delay,
          }}
          className="absolute rounded-full"
        />
      ))}
    </div>
  );
}
