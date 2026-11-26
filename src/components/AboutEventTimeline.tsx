import { useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Calendar, MapPin, Trophy, type LucideIcon } from 'lucide-react';
import { EDITORIAL_EASE } from './MotionPrimitives';

interface TimelineDetail {
  id: string;
  label: string;
  value: string;
  meta: string;
  accent: string;
  Icon: LucideIcon;
}

const TIMELINE_DETAILS: TimelineDetail[] = [
  {
    id: 'date',
    label: 'Event Date',
    value: '18 December 2026',
    meta: '4:00 PM – 9:00 PM',
    accent: '#FF1744',
    Icon: Calendar,
  },
  {
    id: 'venue',
    label: 'Venue / Place',
    value: 'Quad AI, Bengaluru',
    meta: 'Main Cultural Floor',
    accent: '#00E5FF',
    Icon: MapPin,
  },
  {
    id: 'prizes',
    label: 'Prize Pool',
    value: '₹9,000 Cash Pool',
    meta: '1st ₹5,000 · 2nd ₹3,000 · 3rd ₹1,000',
    accent: '#C8F36B',
    Icon: Trophy,
  },
];

interface TimelineNodeProps {
  item: TimelineDetail;
  index: number;
  shouldReduceMotion: boolean | null;
  isHovered: boolean;
  onHoverStart: () => void;
  onHoverEnd: () => void;
}

function TimelineNode({
  item,
  index,
  shouldReduceMotion,
  isHovered,
  onHoverStart,
  onHoverEnd,
}: TimelineNodeProps) {
  const { Icon, accent } = item;

  return (
    <motion.div
      onMouseEnter={onHoverStart}
      onMouseLeave={onHoverEnd}
      onFocus={onHoverStart}
      onBlur={onHoverEnd}
      tabIndex={0}
      animate={
        shouldReduceMotion
          ? undefined
          : {
              x: isHovered ? 5 : 0,
            }
      }
      transition={{ duration: 0.24, ease: EDITORIAL_EASE }}
      className="group relative flex items-start gap-3.5 py-2.5 pl-9 pr-3 outline-none transition-colors duration-200 focus-visible:ring-1 focus-visible:ring-[#FF1744] sm:gap-4 sm:pl-10"
    >
      {/* Subtle row hover backdrop tint */}
      <div
        aria-hidden="true"
        style={{
          background: isHovered
            ? `linear-gradient(90deg, ${accent}14 0%, transparent 90%)`
            : 'transparent',
          borderColor: isHovered ? `${accent}40` : 'transparent',
        }}
        className="pointer-events-none absolute inset-y-0.5 right-0 left-6 border transition-all duration-300"
      />

      {/* Neon Marker fixed over the rail */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-[11px] z-20 -translate-x-1/2 -translate-y-1/2"
      >
        <motion.span
          animate={{
            opacity: isHovered ? 0.95 : 0.3,
            scale: isHovered ? 1.7 : 1,
          }}
          style={{ backgroundColor: accent }}
          transition={{ duration: 0.22, ease: EDITORIAL_EASE }}
          className="absolute inset-0 rounded-full blur-[5px]"
        />

        <motion.span
          animate={{
            scale: isHovered ? 1.42 : 1,
          }}
          style={{
            borderColor: accent,
            boxShadow: isHovered ? `0 0 14px ${accent}` : `0 0 6px ${accent}80`,
          }}
          transition={{ duration: 0.22, ease: EDITORIAL_EASE }}
          className="relative flex h-3 w-3 items-center justify-center rounded-full border-[1.5px] bg-[#050505]"
        >
          <span
            style={{ backgroundColor: accent }}
            className="h-1.5 w-1.5 rounded-full"
          />
        </motion.span>
      </div>

      {/* Illuminated Icon Badge */}
      <div className="relative z-10 mt-0.5 shrink-0">
        <motion.div
          style={{
            borderColor: isHovered ? accent : `${accent}50`,
            boxShadow: isHovered ? `0 0 18px ${accent}66` : undefined,
          }}
          animate={
            shouldReduceMotion
              ? undefined
              : {
                  scale: isHovered ? 1.1 : 1,
                }
          }
          transition={{ duration: 0.22, ease: EDITORIAL_EASE }}
          className="relative flex h-9 w-9 items-center justify-center border bg-[#070709] transition-colors duration-200"
        >
          <Icon
            className="relative z-10 h-4 w-4 transition-transform duration-200 group-hover:scale-110"
            style={{ color: accent }}
            aria-hidden="true"
          />
        </motion.div>
      </div>

      {/* Event Coordinate Typography + Fixed Horizontal Neon Line with Left-to-Right Pulse */}
      <div className="relative z-10 min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className="font-mono-num text-[10px] font-semibold tracking-[0.22em] uppercase transition-all duration-200"
            style={{ color: accent }}
          >
            {item.label}
          </span>

          {/* Fixed horizontal accent line beside each detail with seamless L-to-R neon light pulse */}
          <span
            aria-hidden="true"
            className="relative inline-block h-[1px] w-5 overflow-hidden bg-[#EAE7E0]/20"
          >
            <span
              style={{
                background: `linear-gradient(90deg, ${accent}55, rgba(213,0,249,0.55), rgba(0,229,255,0.55), rgba(200,243,107,0.55))`,
              }}
              className="absolute inset-0 opacity-75"
            />
            {!shouldReduceMotion && (
              <motion.span
                initial={{ x: '-120%' }}
                animate={{ x: '220%' }}
                transition={{
                  duration: 2.4,
                  repeat: Infinity,
                  ease: 'easeInOut',
                  repeatDelay: 0.35,
                  delay: index * 0.4,
                }}
                style={{
                  background: `linear-gradient(90deg, transparent 0%, #FF1744 25%, #D500F9 52%, #00E5FF 76%, #C8F36B 92%, #EAE7E0 100%)`,
                  boxShadow: `0 0 8px ${accent}`,
                }}
                className="absolute inset-y-0 left-0 w-3.5"
              />
            )}
          </span>
        </div>

        <p className="mt-0.5 font-display text-2xl leading-none font-black tracking-tight text-[#EAE7E0] uppercase sm:text-[1.65rem]">
          {item.value}
        </p>

        <p className="mt-1 font-mono-num text-[11px] tracking-wider text-[#EAE7E0]/65">
          {item.meta}
        </p>
      </div>
    </motion.div>
  );
}

export function AboutEventTimeline() {
  const shouldReduceMotion = useReducedMotion();
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  return (
    <div
      aria-label="Key event coordinates: Date, Place, and Prize Pool"
      className="relative my-8"
    >
      {/* Existing line fixed in exact position beside Date, Place & Prize Pool with horizontal L-to-R neon sweep */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-4 bottom-4 left-[11px] w-[2px] -translate-x-1/2 overflow-hidden"
      >
        <div
          style={{
            background:
              'linear-gradient(180deg, rgba(255,23,68,0.6) 0%, rgba(213,0,249,0.65) 36%, rgba(0,229,255,0.65) 70%, rgba(200,243,107,0.6) 100%)',
          }}
          className="h-full w-full"
        />
        {!shouldReduceMotion && (
          <motion.div
            animate={{ x: ['-100%', '100%'] }}
            transition={{ duration: 3.2, repeat: Infinity, ease: 'linear' }}
            style={{
              background:
                'linear-gradient(90deg, transparent 0%, rgba(255,23,68,0.8) 25%, rgba(213,0,249,0.85) 50%, rgba(0,229,255,0.85) 75%, rgba(200,243,107,0.9) 100%)',
            }}
            className="absolute inset-0"
          />
        )}
      </div>

      {/* Event Date, Venue/Place & Prize Pool Rows */}
      <div className="flex flex-col gap-3">
        {TIMELINE_DETAILS.map((item, idx) => (
          <TimelineNode
            key={item.id}
            item={item}
            index={idx}
            shouldReduceMotion={shouldReduceMotion}
            isHovered={hoveredId === item.id}
            onHoverStart={() => setHoveredId(item.id)}
            onHoverEnd={() => setHoveredId(null)}
          />
        ))}
      </div>
    </div>
  );
}
