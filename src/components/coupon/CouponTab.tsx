"use client";

import { motion } from "motion/react";
import Image from "next/image";
import { useRef, useState, type CSSProperties, type Ref } from "react";

import { useMotionEnabled } from "@/components/motion/motion-preference";
import { art } from "@/config/art";
import { copy } from "@/config/copy";
import { cn } from "@/lib/cn";

/** Where the perforation runs, as a share of the ticket's height (the Meshy art). */
const TEAR = 27;
/** How long the punch takes before the form opens. */
const PUNCH_MS = 640;

/**
 * The offer, always at hand: the gold ticket (Meshy art) half tucked behind the right edge of the page.
 * It slides out under the pointer. Chosen, it is punched like at the door (a hole through it, the stub
 * torn off along the perforation) and the coupon form opens. The site writes the figure, so it follows
 * the discount in Shopify.
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
  const [punched, setPunched] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  // "10% off" -> "10%" and "off".
  const [, figure = label, rest = ""] = /^(\S*\d\S*)\s+(.+)$/.exec(label) ?? [];
  const { src, width, height } = art.ticket;

  const choose = () => {
    if (punched) return;
    if (!motionOn) return onOpen();
    setPunched(true);
    timers.current.forEach(clearTimeout);
    // The form opens once the stub is off; the ticket is whole again by the time the form closes.
    timers.current = [
      setTimeout(onOpen, PUNCH_MS),
      setTimeout(() => setPunched(false), PUNCH_MS + 700),
    ];
  };

  const picture = (clip: string) => (
    <Image
      src={src}
      alt=""
      width={width}
      height={height}
      sizes="(min-width: 640px) 88px, 68px"
      className="block h-auto w-full"
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
        "group fixed top-[58%] right-0 z-[60] w-[3.75rem] -translate-y-1/2 transition-opacity sm:top-1/2 sm:w-[5.5rem]",
        hidden && "pointer-events-none invisible opacity-0",
      )}
    >
      <span
        className={cn(
          "relative block drop-shadow-[0_0.75rem_1rem_rgba(0,0,0,0.7)] transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]",
          punched
            ? "translate-x-[2%] -rotate-[2deg] scale-110"
            : "translate-x-[22%] -rotate-[7deg] group-hover:translate-x-[6%] group-hover:-rotate-[3deg] group-focus-visible:translate-x-[6%] group-focus-visible:-rotate-[3deg]",
        )}
      >
        {/* The body: what stays in the hand, with the punched hole. */}
        <motion.span
          className="relative block"
          initial={false}
          animate={
            punched
              ? { "--hole": "9%", x: [0, -3, 2, 0] }
              : { "--hole": "0%", x: 0 }
          }
          transition={{
            "--hole": { duration: 0.16, delay: 0.12, ease: "easeOut" },
            x: { duration: 0.3, delay: 0.12 },
          }}
          style={
            {
              "--hole": "0%",
              maskImage:
                "radial-gradient(circle at 44% 40%, transparent var(--hole), #000 calc(var(--hole) + 0.5px))",
            } as CSSProperties
          }
        >
          {picture(`inset(${TEAR}% 0 0 0)`)}
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

        {/* The stub: torn off along the perforation and thrown away. */}
        <motion.span
          aria-hidden="true"
          className="absolute inset-0 block origin-[85%_27%]"
          initial={false}
          animate={
            punched
              ? { y: "-38%", x: "-34%", rotate: -32, opacity: 0 }
              : { y: 0, x: 0, rotate: 0, opacity: 1 }
          }
          transition={
            punched
              ? {
                  duration: 0.5,
                  delay: 0.24,
                  ease: [0.4, 0, 0.6, 1],
                  opacity: { duration: 0.3, delay: 0.44 },
                }
              : { duration: 0 }
          }
        >
          {picture(`inset(0 0 ${100 - TEAR}% 0)`)}
          <span className="absolute top-[9%] right-[24%] left-[6%] text-center font-type text-[0.4375rem] tracking-[0.1em] text-[#14110a]/80 uppercase sm:text-[0.5625rem]">
            <span className="hidden sm:inline">{copy.coupon.tabStub}</span>
            <span className="text-[0.625rem] sm:hidden">★</span>
          </span>
        </motion.span>
      </span>
      <span className="pointer-events-none absolute inset-0 rounded-sm group-focus-visible:outline-2 group-focus-visible:outline-offset-2 group-focus-visible:outline-gold" />
    </motion.button>
  );
}
