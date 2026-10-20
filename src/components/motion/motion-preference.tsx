"use client";

import { useEffect, useSyncExternalStore } from "react";

import { copy } from "@/config/copy";

/**
 * One switch for every animation on the site.
 *
 * Default follows the OS "reduce motion" setting. The footer toggle lets a visitor
 * override it, and the choice is remembered. CSS animations are cut by the
 * `data-motion="off"` attribute on <html>; JS-driven effects read useMotionEnabled().
 */

const KEY = "ssm-motion";
type Pref = "on" | "off" | null;

let userPref: Pref = null;
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const v = window.localStorage.getItem(KEY);
    userPref = v === "on" || v === "off" ? v : null;
  } catch {
    /* blocked storage: follow the OS setting */
  }
}

function getUserPref(): Pref {
  load();
  return userPref;
}

export function setMotionPreference(next: "on" | "off") {
  userPref = next;
  try {
    window.localStorage.setItem(KEY, next);
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l());
}

function subscribeUser(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

const REDUCED = "(prefers-reduced-motion: reduce)";

function subscribeReduced(cb: () => void) {
  const mq = window.matchMedia(REDUCED);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

/** True when animations should run. Server and first client render say "yes". */
export function useMotionEnabled(): boolean {
  const user = useSyncExternalStore(subscribeUser, getUserPref, () => null);
  const reduced = useSyncExternalStore(
    subscribeReduced,
    () => window.matchMedia(REDUCED).matches,
    () => false,
  );
  return user ? user === "on" : !reduced;
}

/** Mirrors the preference onto <html data-motion> so plain CSS can react to it. */
export function MotionAttribute() {
  const enabled = useMotionEnabled();
  useEffect(() => {
    document.documentElement.dataset.motion = enabled ? "on" : "off";
  }, [enabled]);
  return null;
}

export function MotionToggle() {
  const enabled = useMotionEnabled();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      onClick={() => setMotionPreference(enabled ? "off" : "on")}
      className="inline-flex min-h-11 items-center gap-2 text-xs text-white/60 transition-colors hover:text-white"
    >
      <span
        aria-hidden="true"
        className={`relative h-[0.875rem] w-[1.625rem] rounded-full transition-colors ${enabled ? "bg-gold" : "bg-white/25"}`}
      >
        <span
          className={`absolute top-[0.125rem] h-[0.625rem] w-[0.625rem] rounded-full bg-black transition-all ${enabled ? "left-[0.875rem]" : "left-[0.125rem] bg-white"}`}
        />
      </span>
      {copy.footer.motion(enabled)}
    </button>
  );
}
