"use client";

import { AnimatePresence, motion } from "motion/react";

import { cn } from "@/lib/cn";

const slide = {
  enter: (direction: number) => ({ y: direction > 0 ? "105%" : "-105%", opacity: 0 }),
  center: { y: "0%", opacity: 1 },
  exit: (direction: number) => ({ y: direction > 0 ? "-105%" : "105%", opacity: 0 }),
};

interface TextSwapProps {
  value: string;
  /** +1: the new text rolls up from below; -1: it drops in from above. */
  direction?: number;
  /** "inline" for words inside a line, "block" for a heading or paragraph. */
  display?: "inline" | "block";
  className?: string;
}

/**
 * Changes only the text: the old value rolls out of a mask while the new one rolls in. The element
 * around it (its type, colour, tape, borders) never moves, so a product change reads as the same
 * label getting new content.
 */
export function TextSwap({ value, direction = 1, display = "inline", className }: TextSwapProps) {
  return (
    <span
      className={cn(
        "relative overflow-hidden py-[0.08em] -my-[0.08em] align-bottom",
        display === "block" ? "grid" : "inline-grid",
        className,
      )}
    >
      <AnimatePresence initial={false} custom={direction} mode="popLayout">
        <motion.span
          key={value}
          custom={direction}
          variants={slide}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
          className="col-start-1 row-start-1 block"
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
