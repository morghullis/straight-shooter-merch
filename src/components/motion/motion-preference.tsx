"use client";

import { useEffect, useSyncExternalStore } from "react";

/**
 * One switch for every animation on the site: the operating system's "reduce motion" setting.
 * CSS animations are cut by the `data-motion="off"` attribute on <html>; JS-driven effects read
 * useMotionEnabled().
 */

const REDUCED = "(prefers-reduced-motion: reduce)";
/** Where an earlier version of the site stored an on-page animation switch. Cleared so it cannot stick. */
const LEGACY_KEY = "ssm-motion";

function subscribeReduced(cb: () => void) {
  const mq = window.matchMedia(REDUCED);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

/** True when animations should run. Server and first client render say "yes". */
export function useMotionEnabled(): boolean {
  const reduced = useSyncExternalStore(
    subscribeReduced,
    () => window.matchMedia(REDUCED).matches,
    () => false,
  );
  return !reduced;
}

/** Mirrors the setting onto <html data-motion> so plain CSS can react to it. */
export function MotionAttribute() {
  const enabled = useMotionEnabled();
  useEffect(() => {
    document.documentElement.dataset.motion = enabled ? "on" : "off";
  }, [enabled]);
  useEffect(() => {
    try {
      window.localStorage.removeItem(LEGACY_KEY);
    } catch {
      /* blocked storage: nothing to clear */
    }
  }, []);
  return null;
}
