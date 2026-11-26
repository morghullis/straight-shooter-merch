"use client";

import { motion } from "motion/react";
import Image from "next/image";
import { useRef, useState, type Ref } from "react";

import { useMotionEnabled } from "@/components/motion/motion-preference";
import { art } from "@/config/art";
import { copy } from "@/config/copy";
import { cn } from "@/lib/cn";

/** Where the perforation runs, as a share of the ticket's height (the Meshy art). */
const TEAR = 27;
/** How long the tear takes before the coupon form opens. */
const TEAR_MS = 820;
const TOTAL = TEAR_MS / 1000;

/**
 * The torn edge: a ragged line along the perforation. The stub keeps what is above it, the body what is
 * below, so the two fit together exactly until they part.
 */
const EDGE = Array.from(
  { length: 13 },
  (_, i) =>
    [(i / 12) * 100, TEAR + (i % 2 ? 0.9 : -0.9) * (i % 3 ? 1 : 0.55)] as const,
);
const BODY_CLIP = `polygon(${EDGE.map(([x, y]) => `${x}% ${y}%`).join(", ")}, 100% 100%, 0% 100%)`;
const STUB_CLIP = `polygon(0% 0%, 100% 0%, ${[...EDGE]
  .reverse()
  .map(([x, y]) => `${x}% ${y}%`)
  .join(", ")})`;

/** Paper bits that come off where it tears: across the line, left to right, as the tear runs. */
const BITS = [
  { left: 14, size: 5, x: -10, y: 46, r: -140, delay: 0.3 },
  { left: 34, size: 4, x: 6, y: 58, r: 120, delay: 0.36 },
  { left: 52, size: 6, x: -4, y: 52, r: -200, delay: 0.42 },
  { left: 70, size: 3, x: 12, y: 64, r: 160, delay: 0.47 },
];

/**
 * The offer, always at hand: the gold ticket (Meshy art) half tucked behind the right edge of the page.
 * It slides out under the pointer (or the finger). Chosen, it is torn along its perforation, like at the
 * door: the paper pulls, the stub rips from left to right and falls away, and the coupon form opens. The
 * site writes the figure, so it follows the discount in Shopify.
 */
export function CouponTab({
  label,
  onOpen,
  hidden,
  ref,
}: {
  label: string;
  onOpen: () => void;
  hidden?: boolean;
  ref?: Ref<HTMLButtonElement>;
}) {
  const motionOn = useMotionEnabled();
  const [torn, setTorn] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  // "10% off" -> "10%" and "off".
  const [, figure = label, rest = ""] = /^(\S*\d\S*)\s+(.+)$/.exec(label) ?? [];
  const { src, width, height } = art.ticket;

  const choose = () => {
    if (torn) return;
    if (!motionOn) return onOpen();
    setTorn(true);
    timers.current.forEach(clearTimeout);
    // The form opens as the stub falls away; the ticket is whole again by the time the form closes.
    timers.current = [
      setTimeout(onOpen, TEAR_MS),
      setTimeout(() => setTorn(false), TEAR_MS + 900),
    ];
  };

  const picture = (clip: string) => (
    <Image
      src={src}
      alt=""
      width={width}
      height={height}
      sizes="(min-width: 640px) 88px, 68px"
      draggable={false}
      className="block h-auto w-full select-none"
      style={{ clipPath: clip }}
    />
  );

  return (
    <motion.button
      ref={ref}
      type="button"
      onClick={choose}
      tabIndex={hidden ? -1 : undefined}
      aria-hidden={hidden || undefined}
      aria-haspopup="dialog"
      aria-label={copy.coupon.tab(label)}
      initial={motionOn ? { x: "110%" } : false}
      animate={{ x: 0 }}
      transition={{ duration: 0.7, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        "group fixed top-[58%] right-0 z-[60] w-[3.75rem] -translate-y-1/2 touch-manipulation transition-opacity [-webkit-tap-highlight-color:transparent] sm:top-1/2 sm:w-[5.5rem]",
        hidden && "pointer-events-none invisible opacity-0",
      )}
    >
      <span
        className={cn(
          "relative block drop-shadow-[0_0.75rem_1rem_rgba(0,0,0,0.7)] transition-transform ease-[cubic-bezier(0.16,1,0.3,1)]",
          torn
            ? "-translate-x-[6%] rotate-0 scale-[1.12] duration-300"
            : "translate-x-[22%] -rotate-[7deg] duration-500 group-hover:translate-x-[6%] group-hover:-rotate-[3deg] group-focus-visible:translate-x-[6%] group-focus-visible:-rotate-[3deg] group-active:translate-x-[6%]",
        )}
      >
        {/* The body: it stays in the hand, and gives a little when the stub lets go. */}
        <motion.span
          className="relative block"
          initial={false}
          animate={
            torn
              ? { y: [0, 0, -2, 3, 0], rotate: [0, 0, -1, 1.5, 0] }
              : { y: 0, rotate: 0 }
          }
          transition={
            torn
              ? { duration: 0.6, times: [0, 0.45, 0.6, 0.8, 1], delay: 0.15 }
              : { duration: 0 }
          }
        >
          {picture(BODY_CLIP)}
          <span
            aria-hidden="true"
            className="absolute top-[45%] right-[24%] bottom-[10%] left-[6%] flex flex-col items-center justify-center text-[#14110a]"
          >
            <span className="block font-display text-[1.5rem] leading-[0.8] font-extrabold tracking-[-0.03em] sm:text-[2.25rem]">
              {figure}
            </span>
            <span className="mt-1 block font-display text-[1rem] leading-[0.8] font-extrabold tracking-[0.02em] uppercase sm:text-[1.5rem]">
              {rest}
            </span>
          </span>
        </motion.span>

        {/* The stub: pulled, ripped from the left (it hinges on the right end of the perforation), then gone. */}
        <motion.span
          aria-hidden="true"
          className="absolute inset-0 block"
          style={{ transformOrigin: `96% ${TEAR}%` }}
          initial={false}
          animate={
            torn
              ? {
                  rotate: [0, 1.5, -1, -11, -22, -62],
                  x: ["0%", "0%", "0%", "-1%", "-3%", "-38%"],
                  y: ["0%", "-1%", "-1%", "-2%", "-3%", "28%"],
                  opacity: [1, 1, 1, 1, 1, 0],
                }
              : { rotate: 0, x: "0%", y: "0%", opacity: 1 }
          }
          transition={
            torn
              ? {
                  duration: TOTAL,
                  times: [0, 0.12, 0.2, 0.42, 0.55, 1],
                  ease: [
                    "easeOut",
                    "easeInOut",
                    "easeIn",
                    "easeOut",
                    [0.55, 0, 0.9, 0.4],
                  ],
                }
              : { duration: 0 }
          }
        >
          {picture(STUB_CLIP)}
          <span className="absolute top-[9%] right-[24%] left-[6%] text-center font-type text-[0.4375rem] tracking-[0.1em] text-[#14110a]/80 uppercase sm:text-[0.5625rem]">
            <span className="hidden sm:inline">{copy.coupon.tabStub}</span>
            <span className="text-[0.625rem] sm:hidden">★</span>
          </span>
        </motion.span>

        {/* Paper bits from the tear. */}
        {torn &&
          BITS.map((b) => (
            <motion.span
              key={b.left}
              aria-hidden="true"
              className="absolute block rounded-[1px] bg-[#d9a02b] shadow-[0_0_0_0.5px_rgba(20,17,10,0.35)]"
              style={{
                left: `${b.left}%`,
                top: `${TEAR}%`,
                width: b.size,
                height: b.size * 0.7,
              }}
              initial={{ x: 0, y: 0, rotate: 0, opacity: 0 }}
              animate={{ x: b.x, y: b.y, rotate: b.r, opacity: [0, 1, 1, 0] }}
              transition={{
                duration: 0.55,
                delay: b.delay,
                ease: [0.3, 0, 0.7, 1],
                opacity: {
                  duration: 0.55,
                  delay: b.delay,
                  times: [0, 0.1, 0.7, 1],
                },
              }}
            />
          ))}
      </span>
      <span className="pointer-events-none absolute inset-0 rounded-sm group-focus-visible:outline-2 group-focus-visible:outline-offset-2 group-focus-visible:outline-gold" />
    </motion.button>
  );
}
