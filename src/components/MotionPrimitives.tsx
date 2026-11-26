import { MouseEvent, PointerEvent, ReactNode, useRef, useState } from 'react';
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
  yOffset = 20,
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
      transition={{ duration: 0.58, delay, ease: EDITORIAL_EASE }}
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
      transition={{ duration: 0.75, ease: EDITORIAL_EASE }}
      className={`h-px w-full origin-left bg-[#EAE7E0]/20 ${className}`}
    />
  );
}

export const staggerContainerVariants: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.11,
    },
  },
};

export const staggerItemVariants: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.56,
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
 * GPU-accelerated 3D cursor tilt, hover lift (-8px to -14px), slight scale-up,
 * shifting radial gradient spotlight, subtle diagonal light sweep sheen,
 * neon border glow, and optional staggered floating idle motion.
 */
export function InteractiveNeonCard({
  children,
  className = '',
  accentColor = '#FF1744',
  hoverLift = -10,
  hoverScale = 1.025,
  maxTilt = 6,
  floatAmplitude = 0,
  floatDuration = 5.4,
  floatDelay = 0,
  onClick,
  onMouseEnter,
  onMouseLeave,
  role,
  tabIndex,
  ariaPressed,
}: InteractiveNeonCardProps) {
  const shouldReduceMotion = useReducedMotion();
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [isHovered, setIsHovered] = useState(false);

  // Normalized cursor coordinates in [-0.5, 0.5] and pixel coords for spotlight
  const normX = useMotionValue(0);
  const normY = useMotionValue(0);
  const spotX = useMotionValue(50);
  const spotY = useMotionValue(50);

  const smoothNormX = useSpring(normX, { stiffness: 240, damping: 24, mass: 0.55 });
  const smoothNormY = useSpring(normY, { stiffness: 240, damping: 24, mass: 0.55 });
  const smoothSpotX = useSpring(spotX, { stiffness: 220, damping: 26 });
  const smoothSpotY = useSpring(spotY, { stiffness: 220, damping: 26 });

  const rotateX = useTransform(smoothNormY, [-0.5, 0.5], [maxTilt, -maxTilt]);
  const rotateY = useTransform(smoothNormX, [-0.5, 0.5], [-maxTilt, maxTilt]);

  const spotlightBg = useMotionTemplate`radial-gradient(380px circle at ${smoothSpotX}% ${smoothSpotY}%, ${accentColor}24, ${accentColor}09 42%, transparent 72%)`;

  const handlePointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (shouldReduceMotion || e.pointerType !== 'mouse' || !cardRef.current) return;
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

  const shouldFloat = !shouldReduceMotion && floatAmplitude > 0 && !isHovered;

  const innerCard = (
    <motion.div
      ref={cardRef}
      role={role}
      tabIndex={tabIndex}
      aria-pressed={ariaPressed}
      onClick={onClick}
      onKeyDown={
        onClick
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
        shouldReduceMotion
          ? undefined
          : {
              transformPerspective: 1000,
              rotateX,
              rotateY,
              transformStyle: 'preserve-3d',
            }
      }
      whileHover={
        shouldReduceMotion
          ? undefined
          : {
              y: hoverLift,
              scale: hoverScale,
              transition: { duration: 0.28, ease: EDITORIAL_EASE },
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
      className={`group/neoncard relative overflow-hidden will-change-transform ${className}`}
    >
      {/* Shifting Cursor Radial Gradient Spotlight */}
      {!shouldReduceMotion && (
        <motion.div
          aria-hidden="true"
          style={{ background: spotlightBg }}
          animate={{ opacity: isHovered ? 1 : 0 }}
          transition={{ duration: 0.28, ease: EDITORIAL_EASE }}
          className="pointer-events-none absolute inset-0 z-0"
        />
      )}

      {/* Subtle Diagonal Light Sweep across the card on hover */}
      {!shouldReduceMotion && (
        <motion.div
          aria-hidden="true"
          initial={{ x: '-130%', opacity: 0 }}
          animate={
            isHovered
              ? { x: '130%', opacity: [0, 0.55, 0] }
              : { x: '-130%', opacity: 0 }
          }
          transition={{ duration: 0.72, ease: EDITORIAL_EASE }}
          style={{
            background: `linear-gradient(108deg, transparent 22%, ${accentColor}26 46%, rgba(234,231,224,0.16) 50%, ${accentColor}22 54%, transparent 78%)`,
          }}
          className="pointer-events-none absolute inset-y-0 left-0 z-20 w-[75%]"
        />
      )}

      {/* Animated Neon Perimeter Glow Layer on Hover */}
      {!shouldReduceMotion && (
        <div
          aria-hidden="true"
          style={{
            boxShadow: isHovered
              ? `inset 0 0 0 1px ${accentColor}80, 0 22px 48px -12px ${accentColor}35`
              : 'inset 0 0 0 1px transparent',
          }}
          className="pointer-events-none absolute inset-0 z-20 transition-all duration-300"
        />
      )}

      {children}
    </motion.div>
  );

  if (floatAmplitude > 0 && !shouldReduceMotion) {
    return (
      <motion.div
        animate={
          shouldFloat
            ? { y: [0, -floatAmplitude, 0] }
            : { y: 0 }
        }
        transition={
          shouldFloat
            ? {
                duration: floatDuration,
                repeat: Infinity,
                ease: 'easeInOut',
                delay: floatDelay,
              }
            : { duration: 0.25, ease: EDITORIAL_EASE }
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
  { left: '12%', top: '24%', size: 3, color: '#FF1744', duration: 7.2, delay: 0, driftY: -18 },
  { left: '38%', top: '68%', size: 2.5, color: '#00E5FF', duration: 8.6, delay: 1.1, driftY: -22 },
  { left: '66%', top: '22%', size: 3, color: '#D500F9', duration: 9.1, delay: 0.6, driftY: -16 },
  { left: '86%', top: '58%', size: 2.5, color: '#C8F36B', duration: 7.8, delay: 1.8, driftY: -20 },
  { left: '52%', top: '82%', size: 2, color: '#FF1744', duration: 8.4, delay: 0.4, driftY: -14 },
];

export function AmbientNeonParticles({
  particles = DEFAULT_PARTICLES,
}: {
  particles?: AmbientParticle[];
}) {
  const shouldReduceMotion = useReducedMotion();
  if (shouldReduceMotion) return null;

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
            boxShadow: `0 0 10px ${p.color}`,
          }}
          animate={{
            y: [0, p.driftY, 0],
            opacity: [0.15, 0.55, 0.15],
            scale: [1, 1.35, 1],
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
