"use client";

import { animate, motion, useMotionValue } from "motion/react";
import { useEffect, useRef } from "react";

import { useMotionEnabled } from "@/components/motion/motion-preference";

const delay = (ms: number) => ({ "--d": ms }) as React.CSSProperties;

/** Time each word rests before the next one comes up, and how long the move takes. */
const REST_MS = 2600;
const MOVE_S = 0.85;
/** Let the hero intro finish before the roll starts. */
const START_MS = 3600;

interface GhostRollProps {
  words: readonly string[];
  className?: string;
}

/**
 * The hero's stack of show words as a vertical carousel. At rest it is the stack of the design
 * (every word, one under the other); then it rolls up one line at a time, the top word leaving and
 * the next arriving at the bottom, forever. The window is exactly as tall as the stack, so the
 * layout never changes. Position and sizes come from the `--hero-ghost-*` tokens.
 */
export function GhostRoll({ words, className }: GhostRollProps) {
  const motionOn = useMotionEnabled();
  const track = useRef<HTMLUListElement>(null);
  const y = useMotionValue(0);

  useEffect(() => {
    const el = track.current;
    if (!motionOn || !el) return;

    let step = 0;
    let interval: ReturnType<typeof setInterval> | undefined;
    let move: ReturnType<typeof animate> | undefined;

    const roll = () => {
      const line = el.firstElementChild?.getBoundingClientRect().height ?? 0;
      step += 1;
      move = animate(y, -step * line, {
        duration: MOVE_S,
        ease: [0.65, 0, 0.35, 1],
        onComplete: () => {
          // The second copy now shows exactly what the first one did: jump back, unseen.
          if (step >= words.length) {
            y.set(0);
            step = 0;
          }
        },
      });
    };

    const start = setTimeout(() => {
      roll();
      interval = setInterval(roll, REST_MS + MOVE_S * 1000);
    }, START_MS);

    return () => {
      clearTimeout(start);
      clearInterval(interval);
      move?.stop();
      y.set(0);
    };
  }, [motionOn, words.length, y]);

  return (
    <div
      aria-hidden="true"
      style={{ height: `calc(var(--hero-ghost-lh) * ${words.length})` }}
      className={className}
    >
      <div className="h-full [overflow-y:clip]">
        <motion.ul
          ref={track}
          style={{ y }}
          className="font-display text-(length:--hero-ghost-size) leading-(--hero-ghost-lh) font-extrabold tracking-[-0.042em] text-ghost uppercase will-change-transform"
        >
          {[...words, ...words].map((word, i) => (
            <li key={i} className={i < words.length ? "anim-ghost" : undefined} style={i < words.length ? delay(550 + i * 70) : undefined}>
              {word}
            </li>
          ))}
        </motion.ul>
      </div>
    </div>
  );
}
