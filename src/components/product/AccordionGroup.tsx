"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Folding blocks where only one is open at a time. The blocks are <details name="…">, which
 * browsers already keep exclusive; this adds the same for browsers without it, and keeps the block
 * just opened in view when the one closing above it was long (the page would otherwise jump past it).
 */
export function AccordionGroup({ children, className }: { children: ReactNode; className?: string }) {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const onToggle = (event: Event) => {
      const opened = event.target;
      if (!(opened instanceof HTMLDetailsElement) || !opened.open) return;
      for (const other of el.querySelectorAll("details")) if (other !== opened && other.open) other.open = false;
      const summary = opened.querySelector("summary");
      const header = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--header-h")) * 16 || 80;
      if (summary && summary.getBoundingClientRect().top < header) {
        summary.scrollIntoView({ block: "start", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
      }
    };
    // "toggle" does not bubble: listen while it travels down.
    el.addEventListener("toggle", onToggle, true);
    return () => el.removeEventListener("toggle", onToggle, true);
  }, []);

  return (
    <div ref={root} className={className}>
      {children}
    </div>
  );
}
