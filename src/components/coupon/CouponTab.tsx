"use client";

import { motion } from "motion/react";
import Image from "next/image";
import type { Ref } from "react";

import { useMotionEnabled } from "@/components/motion/motion-preference";
import { art } from "@/config/art";
import { copy } from "@/config/copy";
import { cn } from "@/lib/cn";

/**
 * The offer, always at hand: the gold ticket (Meshy art) half tucked behind the right edge of the page.
 * It slides out under the pointer and opens the popup. The site writes the figure, so it follows the
 * discount in Shopify.
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
  // "10% off" -> "10%" and "off".
  const [, figure = label, rest = ""] = /^(\S*\d\S*)\s+(.+)$/.exec(label) ?? [];
  const { src, width, height } = art.ticket;

  return (
    <motion.button
      ref={ref}
      type="button"
      onClick={onOpen}
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
      <span className="relative block translate-x-[22%] -rotate-[7deg] drop-shadow-[0_0.75rem_1rem_rgba(0,0,0,0.7)] transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-x-[6%] group-hover:-rotate-[3deg] group-focus-visible:translate-x-[6%] group-focus-visible:-rotate-[3deg]">
        <Image
          src={src}
          alt=""
          width={width}
          height={height}
          sizes="(min-width: 640px) 88px, 68px"
          className="block h-auto w-full"
        />
        <span
          aria-hidden="true"
          className="absolute top-[9%] right-[24%] left-[6%] text-center font-type text-[0.4375rem] tracking-[0.1em] text-[#14110a]/80 uppercase sm:text-[0.5625rem]"
        >
          <span className="hidden sm:inline">{copy.coupon.tabStub}</span>
          <span className="text-[0.625rem] sm:hidden">★</span>
        </span>
        <span
          aria-hidden="true"
          className="absolute top-[34%] right-[24%] bottom-[10%] left-[6%] flex flex-col items-center justify-center text-[#14110a]"
        >
          <span className="block font-display text-[1.5rem] leading-[0.8] font-extrabold tracking-[-0.03em] sm:text-[2.25rem]">
            {figure}
          </span>
          <span className="mt-1 block font-display text-[1rem] leading-[0.8] font-extrabold tracking-[0.02em] uppercase sm:text-[1.5rem]">
            {rest}
          </span>
        </span>
      </span>
      <span className="pointer-events-none absolute inset-0 rounded-sm group-focus-visible:outline-2 group-focus-visible:outline-offset-2 group-focus-visible:outline-gold" />
    </motion.button>
  );
}
