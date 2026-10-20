"use client";

import { motion, useInView } from "motion/react";
import { useRef, type ElementType } from "react";

import { cn } from "@/lib/cn";

import { useMotionEnabled } from "./motion-preference";

interface RevealTextProps {
  /** One entry per visual line. Each line slides up from behind its own mask. */
  lines: readonly string[];
  as?: ElementType;
  className?: string;
  /** Index of the line that gets `accentClassName`, e.g. the gold one. */
  accentLine?: number;
  accentClassName?: string;
  id?: string;
  delay?: number;
}

/**
 * Headline that wipes in line by line when it scrolls into view. The full text is exposed
 * once to assistive tech and the animated copy is hidden from it.
 *
 * The in-view check watches the static heading, not the lines: a line that starts hidden
 * below its mask never intersects the viewport, so it could never trigger itself.
 */
export function RevealText({
  lines,
  as: Tag = "h2",
  className,
  accentLine,
  accentClassName = "text-gold",
  id,
  delay = 0,
}: RevealTextProps) {
  const enabled = useMotionEnabled();
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.35 });
  const shown = !enabled || inView;

  return (
    <Tag ref={ref} id={id} aria-label={lines.join(" ")} className={className}>
      {lines.map((line, i) => (
        <span key={line} aria-hidden="true" className="-mb-[0.08em] block overflow-hidden pb-[0.08em]">
          <motion.span
            className={cn("block", i === accentLine && accentClassName)}
            initial={false}
            animate={{ y: shown ? 0 : "108%" }}
            transition={{ duration: enabled ? 0.9 : 0, delay: enabled ? delay + i * 0.09 : 0, ease: [0.16, 1, 0.3, 1] }}
          >
            {line}
          </motion.span>
        </span>
      ))}
    </Tag>
  );
}
