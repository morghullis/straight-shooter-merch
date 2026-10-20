"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";

import { useMotionEnabled } from "./motion-preference";

type Tag = "div" | "li" | "article" | "section";

interface RevealProps {
  as?: Tag;
  delay?: number;
  y?: number;
  className?: string;
  children: ReactNode;
}

const motionTags = {
  div: motion.div,
  li: motion.li,
  article: motion.article,
  section: motion.section,
} as const;

/** Fades and lifts its children into place the first time they scroll into view. */
export function Reveal({ as = "div", delay = 0, y = 26, className, children }: RevealProps) {
  const enabled = useMotionEnabled();

  if (!enabled) {
    const Plain = as;
    return <Plain className={className}>{children}</Plain>;
  }

  const Comp = motionTags[as];
  return (
    <Comp
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.12, margin: "0px 0px -4% 0px" }}
      transition={{ duration: 0.85, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </Comp>
  );
}
