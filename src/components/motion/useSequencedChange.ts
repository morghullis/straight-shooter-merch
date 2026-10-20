"use client";

import { animate, useMotionValue, type MotionValue } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";

export interface SequenceTiming {
  /** The scroll must be still this long before a change starts (ms). */
  calmMs: number;
  /** ...but a change never waits longer than this while the scroll keeps going (ms). */
  maxWaitMs: number;
  outMs: number;
  inMs: number;
  /** Nothing else may start for this long after a change (ms). */
  dwellMs: number;
  /** Longest wait for the next item to be ready before showing it anyway (ms). */
  loadWaitMs: number;
}

interface Options {
  timing: SequenceTiming;
  /** True once the item can be shown without a hitch (loaded, uploaded to the GPU). */
  isReady: (index: number) => boolean;
}

export interface SequencedChange {
  /** The item on stage. Only changes while the stage is invisible. */
  active: number;
  /**
   * The item the stage last came to rest on. It lags `active` until the change AND the rest after it
   * are over, so heavy housekeeping (loading neighbours) never lands in the middle of a change.
   */
  settled: number;
  /** 1 = fully shown, 0 = hidden. Drives the stage, the copy and the sticker together. */
  reveal: MotionValue<number>;
  /** -1..1: where the item is while leaving (negative side) or arriving (positive side), 0 at rest. */
  slide: MotionValue<number>;
  /** The next item is not ready yet and the stage is waiting for it. */
  waiting: boolean;
  /** Tell it which item the scroll wants now. It decides when and how to get there. */
  request: (index: number) => void;
  /** Call on every scroll tick, so a change can wait for the scroll to settle. */
  touch: () => void;
}

const EASE_IN = [0.5, 0, 0.9, 0.6] as const;
const EASE_OUT = [0.1, 0.5, 0.2, 1] as const;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

async function until(test: () => boolean, timeoutMs: number) {
  const start = performance.now();
  while (!test() && performance.now() - start < timeoutMs) await sleep(40);
}

/**
 * Turns "the scroll wants item N" into one calm, identical change: wait for the scroll to settle,
 * the current item leaves, the stage swaps while it is invisible (once the new item is ready), the
 * new one arrives, and a short rest follows. Asking for a different item while it runs just changes
 * the destination: the latest request wins, and a far-away item is reached in ONE change.
 *
 * Because the visible state only ever changes while `reveal` is 0, two items are never on screen
 * together, and the copy, the sticker and the 3D model always change at the same instant.
 */
export function useSequencedChange({ timing, isReady }: Options): SequencedChange {
  const [active, setActive] = useState(0);
  const [settled, setSettled] = useState(0);
  const [waiting, setWaiting] = useState(false);
  const reveal = useMotionValue(1);
  const slide = useMotionValue(0);

  const activeRef = useRef(0);
  const wantedRef = useRef(0);
  const lastActivity = useRef(0);
  const mismatchSince = useRef<number | null>(null);
  const running = useRef(false);
  const alive = useRef(false);
  // Resolved by the effect below once React has put the new item on screen.
  const committed = useRef<(() => void) | null>(null);

  const latest = useRef({ timing, isReady });
  useEffect(() => {
    latest.current = { timing, isReady };
  });

  const run = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    try {
      while (alive.current && wantedRef.current !== activeRef.current) {
        const t = latest.current.timing;

        // 1. Let the scroll settle, but do not wait forever while it keeps going.
        while (alive.current && wantedRef.current !== activeRef.current) {
          const idle = performance.now() - lastActivity.current;
          const waited = performance.now() - (mismatchSince.current ?? performance.now());
          if (idle >= t.calmMs || waited >= t.maxWaitMs) break;
          await sleep(30);
        }
        if (!alive.current || wantedRef.current === activeRef.current) continue;

        // 2. Prepare: the next item loads and warms up while the current one is still on stage, so
        //    nothing heavy can stutter the change itself. If the scroll moves on, follow it.
        let target = wantedRef.current;
        const preparing = performance.now();
        while (alive.current && target !== activeRef.current && !latest.current.isReady(target) && performance.now() - preparing < t.loadWaitMs) {
          await sleep(40);
          target = wantedRef.current;
        }
        if (!alive.current) break;
        if (wantedRef.current === activeRef.current) continue;

        // 3. The current item leaves, then (while nothing is visible) the stage swaps to whatever the
        //    scroll wants NOW. It is normally ready already; if not, the stage waits invisibly for it.
        const from = activeRef.current;
        const out = { duration: t.outMs / 1000, ease: EASE_IN };
        await Promise.all([animate(reveal, 0, out).finished, animate(slide, wantedRef.current > from ? -1 : 1, out).finished]);
        if (!alive.current) break;

        const next = wantedRef.current;
        if (next !== from) {
          const slow = setTimeout(() => setWaiting(true), 250);
          await until(() => !alive.current || latest.current.isReady(next), t.loadWaitMs);
          clearTimeout(slow);
          setWaiting(false);
          activeRef.current = next;
          const applied = new Promise<void>((resolve) => {
            committed.current = resolve;
          });
          setActive(next);
          slide.set(next > from ? 1 : -1);
          await applied; // React has rendered the new item...
          await nextFrame(); // ...and the next frame has drawn it (still invisible).
        }

        // 4. The new item arrives, then rests.
        const arrive = { duration: t.inMs / 1000, ease: EASE_OUT };
        await Promise.all([animate(reveal, 1, arrive).finished, animate(slide, 0, arrive).finished]);
        await sleep(t.dwellMs);
        mismatchSince.current = wantedRef.current !== activeRef.current ? performance.now() : null;
        if (wantedRef.current === activeRef.current) setSettled(activeRef.current);
      }
      setSettled(activeRef.current);
    } finally {
      running.current = false;
    }
  }, [reveal, slide]);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  useEffect(() => {
    committed.current?.();
    committed.current = null;
  }, [active]);

  const request = useCallback(
    (index: number) => {
      wantedRef.current = index;
      if (index === activeRef.current) mismatchSince.current = null;
      else mismatchSince.current ??= performance.now();
      void run();
    },
    [run],
  );

  const touch = useCallback(() => {
    lastActivity.current = performance.now();
  }, []);

  return { active, settled, reveal, slide, waiting, request, touch };
}
