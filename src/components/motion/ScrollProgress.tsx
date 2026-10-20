"use client";

import { motion, useScroll, useSpring } from "motion/react";

import { useMotionEnabled } from "./motion-preference";

/** 2px gold bar pinned to the top that fills as the page scrolls (invisible at the top). */
export function ScrollProgress() {
  const enabled = useMotionEnabled();
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 140, damping: 30, restDelta: 0.001 });

  if (!enabled) return null;
  return (
    <motion.div
      aria-hidden="true"
      style={{ scaleX }}
      className="pointer-events-none fixed inset-x-0 top-0 z-[75] h-[0.125rem] origin-left bg-gold"
    />
  );
}
