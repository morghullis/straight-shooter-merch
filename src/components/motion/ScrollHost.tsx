"use client";

import { useScroll, useTransform, motion, type MotionValue } from "motion/react";
import { createContext, useContext, useRef, type ReactNode } from "react";

import { useMotionEnabled } from "./motion-preference";

const ScrollProgressContext = createContext<MotionValue<number> | null>(null);

function useHostProgress(): MotionValue<number> {
  const progress = useContext(ScrollProgressContext);
  if (!progress) throw new Error("ScrollLayer must be used inside <ScrollHost>");
  return progress;
}

interface ScrollHostProps {
  children: ReactNode;
  className?: string;
  /** Progress 0 when the host's top reaches the viewport top, 1 when its bottom does. */
  offset?: ["start start" | "start end", "end start" | "end end"];
  "aria-labelledby"?: string;
}

/**
 * A section that publishes its own scroll progress (0 to 1) to the `ScrollLayer`s inside
 * it. Also acts as the pointer area for `ParallaxLayer`.
 */
export function ScrollHost({ children, className, offset = ["start start", "end start"], ...aria }: ScrollHostProps) {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset });

  return (
    <ScrollProgressContext.Provider value={scrollYProgress}>
      <section ref={ref} data-parallax-host className={className} {...aria}>
        {children}
      </section>
    </ScrollProgressContext.Provider>
  );
}

type Range = [number, number];

interface ScrollLayerProps {
  children: ReactNode;
  className?: string;
  /** Output ranges mapped from host progress 0 -> 1. */
  y?: Range;
  x?: Range;
  opacity?: Range;
  scale?: Range;
  /** Sub-range of the host progress over which the values play. */
  during?: Range;
  origin?: string;
}

/** Scroll-scrubbed transform/opacity. At progress 0 it is exactly the static layout. */
export function ScrollLayer({ children, className, y, x, opacity, scale, during = [0, 1], origin }: ScrollLayerProps) {
  const enabled = useMotionEnabled();
  const progress = useHostProgress();

  const yv = useTransform(progress, during, y ?? [0, 0]);
  const xv = useTransform(progress, during, x ?? [0, 0]);
  const ov = useTransform(progress, during, opacity ?? [1, 1]);
  const sv = useTransform(progress, during, scale ?? [1, 1]);

  if (!enabled) return <div className={className}>{children}</div>;
  return (
    <motion.div style={{ y: yv, x: xv, opacity: ov, scale: sv, transformOrigin: origin }} className={className}>
      {children}
    </motion.div>
  );
}
