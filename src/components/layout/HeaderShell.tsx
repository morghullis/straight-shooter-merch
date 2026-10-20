"use client";

import { useMotionValueEvent, useScroll } from "motion/react";
import { useState, type ReactNode } from "react";

import { cn } from "@/lib/cn";

/**
 * The header frame. On phones it sticks to the top and picks up a hairline and a shadow
 * once the page scrolls; from lg up it is the static bar of the reference.
 */
export function HeaderShell({ children }: { children: ReactNode }) {
  const { scrollY } = useScroll();
  const [scrolled, setScrolled] = useState(false);
  useMotionValueEvent(scrollY, "change", (y) => setScrolled(y > 8));

  return (
    <header
      className={cn(
        "relative z-40 bg-black transition-shadow duration-300 max-lg:sticky max-lg:top-0",
        scrolled && "max-lg:shadow-[0_1px_0_rgba(255,255,255,0.12),0_0.625rem_1.5rem_-0.75rem_rgba(0,0,0,0.9)]",
      )}
    >
      {children}
    </header>
  );
}
