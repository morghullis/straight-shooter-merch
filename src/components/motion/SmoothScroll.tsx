"use client";

import "lenis/dist/lenis.css";

import { ReactLenis } from "lenis/react";

import { useMotionEnabled } from "./motion-preference";

/**
 * Inertial page scrolling for mouse wheels and trackpads, so the page and every scroll-linked effect
 * glide instead of stepping. Touch keeps the device's own scrolling. Scroll containers inside the page
 * (cart, menu, carousels) still scroll natively, and the page pauses while an overlay locks it.
 * Off when the visitor asks the system for reduced motion.
 */
export function SmoothScroll() {
  const motionOn = useMotionEnabled();
  if (!motionOn) return null;
  return (
    <ReactLenis
      root
      options={{ lerp: 0.1, smoothWheel: true, syncTouch: false, autoToggle: true, allowNestedScroll: true, anchors: false }}
    />
  );
}
