"use client";

import { animate, motion, useMotionValue, useTransform, useVelocity } from "motion/react";
import { useEffect, useRef } from "react";

import { cn } from "@/lib/cn";

import { useMotionEnabled } from "./motion-preference";

/** Each wheel carries the digits 0-9 five times, and rests on the middle set. */
const SETS = 5;
const REST = 20;
const wheel = Array.from({ length: 10 * SETS }, (_, i) => i % 10);

const formatters = new Map<string, Intl.NumberFormat>();
function partsOf(amount: number, currency: string) {
  let f = formatters.get(currency);
  if (!f) {
    f = new Intl.NumberFormat("en-US", { style: "currency", currency });
    formatters.set(currency, f);
  }
  return { text: f.format(amount), parts: f.formatToParts(amount) };
}

/**
 * One digit on a cash-register wheel. On a change it spins one full turn plus the way to the new
 * digit (forward or back with `direction`) and lands on it with a small mechanical knock. A touch of
 * vertical blur follows the speed of the wheel.
 */
function DigitWheel({ digit, turn, direction, delay }: { digit: number; turn: string; direction: number; delay: number }) {
  const motionOn = useMotionEnabled();
  const pos = useMotionValue(REST + digit);
  const shown = useRef({ digit, turn });
  const y = useTransform(pos, (p) => `${-p}em`);
  const speed = useVelocity(pos);
  const filter = useTransform(speed, (v) => `blur(${Math.min(0.06, Math.abs(v) * 0.0016).toFixed(3)}em)`);

  useEffect(() => {
    if (digit === shown.current.digit && turn === shown.current.turn) return;
    shown.current = { digit, turn };
    if (!motionOn) {
      pos.set(REST + digit);
      return;
    }
    const from = pos.get();
    const now = ((Math.round(from) % 10) + 10) % 10;
    const steps = direction >= 0 ? ((digit - now + 10) % 10) + 10 : -(((now - digit + 10) % 10) + 10);
    const controls = animate(pos, from + steps, {
      duration: 1.05,
      // Fast start, long run-out, a small knock as the wheel lands on its digit.
      ease: [0.22, 0.8, 0.3, 1.08],
      delay,
      // Back to the middle set, where the wheel always has room to spin both ways.
      onComplete: () => pos.set(REST + digit),
    });
    return () => controls.stop();
  }, [digit, turn, direction, delay, motionOn, pos]);

  return (
    <span className="relative inline-block h-[1em] w-[1ch] overflow-hidden align-top tabular-nums [clip-path:inset(-0.05em_-0.1em)]">
      <motion.span style={{ y, filter }} className="absolute inset-x-0 top-0 flex flex-col items-center">
        {wheel.map((d, i) => (
          <span key={i} className="block h-[1em] leading-none">
            {d}
          </span>
        ))}
      </motion.span>
    </span>
  );
}

/**
 * A price on a cash-register display: big dollars, small raised currency sign and cents. When the
 * amount changes, the digits spin to the new price one after the other, from the cents leftwards.
 */
export function PriceRoll({
  amount,
  currency,
  turn = "",
  direction = 1,
  className,
}: {
  amount: number;
  currency: string;
  /** Change it (e.g. the product) to ring the register again even when the amount is the same. */
  turn?: string;
  /** +1 spins the wheels forward, -1 back (follow the way the visitor is going). */
  direction?: number;
  className?: string;
}) {
  const { text, parts } = partsOf(amount, currency);
  const digits = parts.flatMap((p) => (p.type === "integer" || p.type === "fraction" ? [...p.value] : [])).length;
  let digitIndex = 0;

  return (
    <span className={cn("inline-flex items-start leading-none", className)}>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true" className="inline-flex items-start">
        {parts.map((part, p) => {
          if (part.type === "currency") {
            return (
              <span key={p} className="mt-[0.08em] mr-[0.04em] text-[0.46em]">
                {part.value}
              </span>
            );
          }
          if (part.type === "decimal") return null; // the cents sit raised instead of after a point
          if (part.type === "integer" || part.type === "fraction") {
            const cents = part.type === "fraction";
            return (
              <span
                key={p}
                className={cn("inline-flex", cents && "mt-[0.08em] ml-[0.06em] border-b-[0.06em] border-current text-[0.46em]")}
              >
                {[...part.value].map((ch) => {
                  // The last digit moves first, like the register counting up to the total.
                  const order = digits - 1 - digitIndex++;
                  return <DigitWheel key={`${part.type}-${order}`} digit={Number(ch)} turn={turn} direction={direction} delay={order * 0.09} />;
                })}
              </span>
            );
          }
          return (
            <span key={p} className="text-[0.6em]">
              {part.value}
            </span>
          );
        })}
      </span>
    </span>
  );
}
