"use client";

import { motion, useScroll } from "motion/react";
import { useRef, type ReactNode } from "react";

import { cn } from "@/lib/cn";

interface CarouselProps {
  /** `<li>` items. */
  children: ReactNode;
  label: string;
  /** Layout from `md` up (usually a grid). The list is a snap carousel below it. */
  gridClassName?: string;
  /** Gap between items while it is a carousel. */
  gapClassName?: string;
  className?: string;
}

/**
 * Phones get a swipeable snap carousel with a thin progress rule and the next item
 * peeking in; from `md` up the same list becomes the grid you pass in `gridClassName`.
 * The scroller is focusable so keyboard users can arrow through it.
 */
export function Carousel({ children, label, gridClassName, gapClassName = "gap-3", className }: CarouselProps) {
  const scroller = useRef<HTMLUListElement>(null);
  const { scrollXProgress } = useScroll({ container: scroller });

  return (
    <div className={className}>
      <ul
        ref={scroller}
        aria-label={label}
        // Scroll containers are keyboard reachable.
        tabIndex={0}
        className={cn(
          "scrollbar-none -mx-(--gutter) flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain scroll-px-(--gutter) px-(--gutter) pb-1 focus-visible:outline-offset-[-0.125rem] md:mx-0 md:snap-none md:overflow-visible md:px-0 md:pb-0",
          gapClassName,
          gridClassName,
        )}
      >
        {children}
      </ul>
      <div aria-hidden="true" className="mt-4 h-[0.125rem] w-full bg-current/15 md:hidden">
        <motion.div style={{ scaleX: scrollXProgress }} className="h-full origin-left bg-gold" />
      </div>
    </div>
  );
}
