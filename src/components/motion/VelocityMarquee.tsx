"use client";

import {
  motion,
  useAnimationFrame,
  useMotionValue,
  useScroll,
  useSpring,
  useTransform,
  useVelocity,
  wrap,
} from "motion/react";
import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

import { useMotionEnabled } from "./motion-preference";

interface VelocityMarqueeProps {
  /** One full set of items. It is repeated four times for a seamless loop. */
  children: ReactNode;
  /** Idle speed in % of the track per second. Negative runs the other way. */
  speed?: number;
  paused?: boolean;
  /** Max skew (deg) added while the page is scrolling fast. */
  skew?: number;
  className?: string;
}

/**
 * Infinite ticker that reads the page scroll: it drifts on its own, speeds up while the
 * visitor scrolls, and leans into the scroll direction. Static when animations are off.
 */
export function VelocityMarquee({ children, speed = 3, paused = false, skew = 7, className }: VelocityMarqueeProps) {
  const enabled = useMotionEnabled();
  const base = useMotionValue(0);

  const { scrollY } = useScroll();
  const velocity = useSpring(useVelocity(scrollY), { damping: 50, stiffness: 400 });
  const boost = useTransform(velocity, [-2000, 0, 2000], [4, 0, 4]);
  const lean = useTransform(velocity, [-2000, 2000], [skew, -skew]);

  const x = useTransform(base, (v) => `${wrap(-25, -50, v)}%`);
  const direction = Math.sign(speed) || 1;

  useAnimationFrame((_, delta) => {
    if (!enabled || paused) return;
    const step = Math.abs(speed) * (delta / 1000) * (1 + boost.get());
    base.set(base.get() + direction * step);
  });

  return (
    <div className={cn("overflow-hidden", className)}>
      <motion.div style={{ x: enabled ? x : 0, skewX: enabled ? lean : 0 }} className="flex w-max will-change-transform">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} aria-hidden={i > 0 ? true : undefined} className="flex flex-none">
            {children}
          </div>
        ))}
      </motion.div>
    </div>
  );
}
