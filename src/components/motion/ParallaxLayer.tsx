"use client";

import { motion, useMotionValue, useScroll, useSpring, useTransform } from "motion/react";
import { useEffect, useRef, type ReactNode } from "react";

import { useMotionEnabled } from "./motion-preference";

interface ParallaxLayerProps {
  children: ReactNode;
  className?: string;
  /** Max pointer travel in px (horizontal). Vertical travel is a third of it. */
  depth?: number;
  /** Extra vertical drift in px as the page scrolls the first 400px. */
  drift?: number;
}

/**
 * A layer that eases toward the pointer inside its nearest `[data-parallax-host]`
 * and drifts slightly on scroll. At rest every layer sits exactly where the static
 * design puts it, so the layout never depends on the effect.
 */
export function ParallaxLayer({ children, className, depth = 8, drift = 0 }: ParallaxLayerProps) {
  const enabled = useMotionEnabled();
  const ref = useRef<HTMLDivElement>(null);

  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const x = useSpring(px, { stiffness: 70, damping: 20, mass: 0.7 });
  const pointerY = useSpring(py, { stiffness: 70, damping: 20, mass: 0.7 });

  const { scrollY } = useScroll();
  const scrollShift = useTransform(scrollY, [0, 400], [0, drift]);
  const y = useTransform([pointerY, scrollShift], ([a, b]: number[]) => a + b);

  useEffect(() => {
    if (!enabled) return;
    const host = ref.current?.closest<HTMLElement>("[data-parallax-host]");
    if (!host) return;
    // Pointer parallax only for real pointers; touch devices keep the scroll drift.
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

    const onMove = (e: PointerEvent) => {
      const r = host.getBoundingClientRect();
      const nx = ((e.clientX - r.left) / r.width - 0.5) * 2;
      const ny = ((e.clientY - r.top) / r.height - 0.5) * 2;
      px.set(nx * depth);
      py.set(ny * depth * 0.33);
    };
    const onLeave = () => {
      px.set(0);
      py.set(0);
    };

    host.addEventListener("pointermove", onMove);
    host.addEventListener("pointerleave", onLeave);
    return () => {
      host.removeEventListener("pointermove", onMove);
      host.removeEventListener("pointerleave", onLeave);
    };
  }, [enabled, depth, px, py]);

  if (!enabled) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div ref={ref} style={{ x, y }} className={className}>
      {children}
    </motion.div>
  );
}
