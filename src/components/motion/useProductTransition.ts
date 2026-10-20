"use client";

import { animate, useMotionValue, type MotionValue } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";

export interface TransitionTiming {
  exitMs: number;
  overlapMs: number;
  enterMs: number;
  loadWaitMs: number;
}

interface Options {
  timing: TransitionTiming;
  /** True once the item can be shown without a hitch (loaded, uploaded to the GPU). */
  isReady: (index: number) => boolean;
}

export interface ProductTransition {
  /** The item on stage (arriving or at rest). The copy shows this item. */
  active: number;
  /** The item spinning out, while a change runs. */
  leaving: number | null;
  /** The item being prepared (loaded and warmed) before a change starts. */
  preparing: number | null;
  /** The item the stage last came to rest on (lags `active` until a change is completely over). */
  settled: number;
  /** +1 when moving to a later item, -1 to an earlier one. */
  direction: number;
  /** 0..1 progress of the leaving item's exit. */
  exit: MotionValue<number>;
  /** 0..1 progress of the active item's arrival (1 = at rest). */
  enter: MotionValue<number>;
  /** A change is running (or waiting for its model). */
  busy: () => boolean;
  /** Change to an item with the standard animation. Requests during a change wait for it to end. */
  goTo: (index: number) => void;
  /** Put an item on stage with no animation (used while the stage is off screen). */
  jump: (index: number) => void;
}

const EASE_IN = [0.55, 0, 0.85, 0.35] as const;
const EASE_OUT = [0.15, 0.6, 0.25, 1] as const;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function until(test: () => boolean, timeoutMs: number) {
  const start = performance.now();
  while (!test() && performance.now() - start < timeoutMs) await sleep(40);
}

/**
 * One change between two items, always the same: the current one leaves at once, the next one
 * (loaded and warmed ahead of time) arrives just before it is gone, and the stage rests. The animation runs on its own clock: how fast the
 * visitor scrolls never changes it.
 */
export function useProductTransition({ timing, isReady }: Options): ProductTransition {
  const [active, setActive] = useState(0);
  const [leaving, setLeaving] = useState<number | null>(null);
  const [preparing, setPreparing] = useState<number | null>(null);
  const [settled, setSettled] = useState(0);
  const [direction, setDirection] = useState(1);
  const exit = useMotionValue(0);
  const enter = useMotionValue(1);

  const activeRef = useRef(0);
  const pending = useRef<number | null>(null);
  const running = useRef(false);
  const alive = useRef(false);
  const latest = useRef({ timing, isReady });
  useEffect(() => {
    latest.current = { timing, isReady };
  });

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const run = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    try {
      while (alive.current && pending.current !== null && pending.current !== activeRef.current) {
        const target = pending.current;
        pending.current = null;
        const t = latest.current.timing;

        // The current item leaves at once (the gesture gets an immediate answer). The next one is
        // normally loaded and warmed already; if not, it finishes preparing while this one leaves.
        setPreparing(target);
        const from = activeRef.current;
        const dir = target > from ? 1 : -1;
        setDirection(dir);
        setLeaving(from);
        exit.set(0);
        const leave = animate(exit, 1, { duration: t.exitMs / 1000, ease: EASE_IN });

        // The next item starts its arrival just before the current one is gone.
        await sleep(Math.max(0, t.exitMs - t.overlapMs));
        await until(() => !alive.current || latest.current.isReady(target), t.loadWaitMs);
        setPreparing(null);
        if (!alive.current) break;
        enter.set(0);
        activeRef.current = target;
        setActive(target);
        const arrive = animate(enter, 1, { duration: t.enterMs / 1000, ease: EASE_OUT });

        await Promise.all([leave.finished, arrive.finished]);
        setLeaving(null);
        exit.set(0);
      }
      setSettled(activeRef.current);
    } finally {
      running.current = false;
    }
  }, [exit, enter]);

  const goTo = useCallback(
    (index: number) => {
      pending.current = index;
      void run();
    },
    [run],
  );

  const jump = useCallback(
    (index: number) => {
      if (running.current || index === activeRef.current) return;
      activeRef.current = index;
      setActive(index);
      setLeaving(null);
      setSettled(index);
      exit.set(0);
      enter.set(1);
    },
    [exit, enter],
  );

  const busy = useCallback(() => running.current, []);

  return { active, leaving, preparing, settled, direction, exit, enter, busy, goTo, jump };
}
