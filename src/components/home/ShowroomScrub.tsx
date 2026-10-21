"use client";

import { AnimatePresence, motion, useInView, useMotionValueEvent } from "motion/react";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";

import { useMotionEnabled } from "@/components/motion/motion-preference";
import { TextSwap } from "@/components/motion/TextSwap";
import { useProductPager } from "@/components/motion/useProductPager";
import type { StageSlot } from "@/components/three/ScrubStage";
import { Art, textureStyle } from "@/components/ui/Art";
import { Button } from "@/components/ui/Button";
import { Tape } from "@/components/ui/Tape";
import { copy } from "@/config/copy";
import { showroomMotion as motionCfg } from "@/config/showroom";
import { useAfterLoad, useMediaQuery } from "@/lib/browser";
import { cn } from "@/lib/cn";

import type { ShowroomItem } from "./showroom-types";

// Three.js downloads once the page has loaded, or earlier if the visitor is already close to the showroom.
const ScrubStage = dynamic(() => import("@/components/three/ScrubStage"), { ssr: false });

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

/** Space kept between the product and the title above it / the rail below it on phones, in px. */
const SLOT_GAP = 12;

/**
 * Pinned 3D showroom, one product per gesture. Each scroll, swipe or arrow key spins the current
 * product on its axis and carries it off the stage while the next one spins in from the other side,
 * always at the same easy pace (`useProductPager`). Only the number, name, price and spec text change;
 * the tape, rules and button stay put. Drag a product to turn it.
 */
export function ShowroomScrub({ items }: { items: ShowroomItem[] }) {
  const n = items.length;
  const sectionRef = useRef<HTMLElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLElement>(null);
  const motionOn = useMotionEnabled();
  const desktop = useMediaQuery("(min-width: 1024px)", true);

  const loaded = useAfterLoad();
  const near = useInView(sectionRef, { once: true, margin: "100% 0px" });
  const visible = useInView(sectionRef, { margin: "120px 0px" });

  const [anyReady, setAnyReady] = useState(false);
  const onItemReady = useCallback(() => setAnyReady(true), []);

  const { position, goTo } = useProductPager({
    section: sectionRef,
    frame: frameRef,
    count: n,
    stepSeconds: motionCfg.stepSeconds,
    settleSeconds: motionCfg.settleSeconds,
    wheelMinPx: motionCfg.wheelMinPx,
    swipeMinPx: motionCfg.swipeMinPx,
    enabled: motionOn,
  });
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  useMotionValueEvent(position, "change", (v) => {
    const next = clamp(Math.round(v), 0, n - 1);
    if (next === index) return;
    setDirection(next > index ? 1 : -1);
    setIndex(next);
  });

  // Phones: the product rests in the free space between the title and the rail.
  const [slot, setSlot] = useState<StageSlot | null>(null);
  useEffect(() => {
    const frame = frameRef.current;
    const title = titleRef.current;
    const rail = railRef.current;
    if (!frame || !title || !rail) return;
    const measure = () => {
      const box = frame.getBoundingClientRect();
      const top = title.getBoundingClientRect().bottom - box.top + SLOT_GAP;
      const bottom = rail.getBoundingClientRect().top - box.top - SLOT_GAP;
      if (box.height <= 0 || bottom - top < 80) return;
      setSlot({ x: 0.5, y: (top + bottom) / 2 / box.height, w: 0.88, h: (bottom - top) / box.height });
    };
    const observer = new ResizeObserver(measure);
    observer.observe(frame);
    observer.observe(title);
    observer.observe(rail);
    return () => observer.disconnect();
  }, []);

  const stickerKey = items[index].handle;

  return (
    <section
      ref={sectionRef}
      aria-labelledby="showroom-title"
      style={{ height: `calc(${(n - 1) * motionCfg.pageSvh}svh + 100svh)` }}
      className="relative mt-[0.625rem] w-full"
    >
      <div ref={frameRef} className="sticky top-0 flex h-svh flex-col overflow-hidden bg-[#0d0d0d]">
        {/* Concrete studio wall */}
        <div aria-hidden="true" className="absolute inset-0 opacity-90" style={textureStyle("concrete")} />
        <div aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.55),rgba(0,0,0,0.1)_40%,rgba(0,0,0,0.65))]" />

        {/* 3D stage: the products move with the scroll */}
        <div
          role="img"
          aria-label={copy.showroom.stage(items[index].title)}
          className="absolute inset-0 z-[1] cursor-grab active:cursor-grabbing"
        >
          <div data-showroom-stage className="absolute inset-0">
            {(loaded || near) && (
              <ScrubStage
                models={items.map((i) => i.model)}
                position={position}
                index={index}
                active={visible}
                slot={desktop ? null : slot}
                offsetX={desktop ? 0.95 : 0}
                offsetY={desktop ? 0 : 0.55}
                onItemReady={onItemReady}
              />
            )}
          </div>
          <div
            aria-hidden={anyReady}
            className={cn(
              "pointer-events-none absolute inset-0 grid place-items-center transition-opacity duration-500",
              anyReady ? "opacity-0" : "opacity-100",
            )}
          >
            <span className="relative grid h-10 w-10 place-items-center">
              <span className="absolute inset-0 rounded-full border border-gold [animation:pulse-ring_1.6s_ease-out_infinite]" />
              <span className="h-2 w-2 rounded-full bg-gold" />
            </span>
            <span className="sr-only">{copy.showroom.loading3d}</span>
          </div>
        </div>

        <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-0 z-[2] hidden w-[58%] bg-gradient-to-r from-black/75 via-black/40 to-transparent lg:block" />

        {/* Everything below is aligned to the content column. The wrapper ignores the pointer so the model stays draggable. */}
        <div className="pointer-events-none relative z-10 mx-auto flex h-full w-full max-w-(--container) flex-col px-(--gutter) xl:px-1">
        {/* Stamp or sticker stuck on the stage: peeled off with the product, the next one pressed on */}
        <AnimatePresence initial={false}>
          {items[index].art && (
            <motion.div
              key={stickerKey}
              aria-hidden="true"
              initial={{ opacity: 0, scale: 0.6, rotate: -12 }}
              animate={{ opacity: 1, scale: 1, rotate: 0, transition: { delay: 0.35, type: "spring", stiffness: 260, damping: 18 } }}
              exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.25 } }}
              className={cn("pointer-events-none absolute z-[2]", items[index].art.className)}
            >
              <Art
                name={items[index].art.art}
                sizes="(min-width: 1326px) 19.6vw, 260px"
                className="h-auto w-full drop-shadow-[0_8px_14px_rgba(0,0,0,0.5)]"
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Title on a strip of tape */}
        <div ref={titleRef} className="pointer-events-auto pt-[calc(var(--header-h)+1rem)] lg:pt-10">
          <Tape className="-rotate-[1.6deg]">
            <h2
              id="showroom-title"
              className="font-display text-[clamp(1.875rem,6vw,3.25rem)] leading-none font-extrabold tracking-[-0.01em] uppercase"
            >
              {copy.showroom.title}
            </h2>
          </Tape>
          <p className="mt-3 hidden max-w-[34ch] text-[0.875rem] leading-relaxed text-white/70 sm:block">{copy.showroom.lead}</p>
        </div>

        {/* Rail: one stop per product */}
        <nav
          ref={railRef}
          aria-label={copy.showroom.pickLabel}
          className="pointer-events-auto relative z-10 mt-auto -mb-14 flex gap-1.5 lg:absolute lg:top-auto lg:right-(--gutter) xl:right-1 lg:bottom-8 lg:mt-0 lg:mb-0 lg:gap-6"
        >
          {items.map((it, i) => (
            <button
              key={it.handle}
              type="button"
              onClick={() => goTo(i)}
              aria-label={copy.showroom.goTo(it.model.label)}
              aria-current={i === index ? "step" : undefined}
              className={cn(
                "group flex h-10 min-w-10 flex-col items-center justify-center border px-2 font-nav text-[0.75rem] font-semibold tracking-[0.1em] uppercase transition-colors lg:h-auto lg:min-w-0 lg:items-start lg:border-0 lg:px-0",
                i === index
                  ? "border-gold bg-gold text-[#14110a] lg:bg-transparent lg:text-gold"
                  : "border-white/25 bg-black/50 text-white/70 hover:border-white hover:text-white lg:bg-transparent lg:text-white/45",
              )}
            >
              <span className="tabular-nums lg:hidden">{String(i + 1).padStart(2, "0")}</span>
              <span className="hidden lg:block">
                <span className="tabular-nums">{String(i + 1).padStart(2, "0")}</span> {it.model.label}
              </span>
              <span
                aria-hidden="true"
                className={cn(
                  "mt-2 hidden h-[0.125rem] transition-all duration-300 lg:block",
                  i === index ? "w-16 bg-gold" : "w-8 bg-white/30 group-hover:w-12",
                )}
              />
            </button>
          ))}
        </nav>

        {/* Copy */}
        <div className="pointer-events-auto relative -mx-(--gutter) bg-[linear-gradient(0deg,#000_30%,rgba(0,0,0,0.85)_70%,transparent)] px-(--gutter) pt-16 pb-[calc(var(--gutter)+env(safe-area-inset-bottom))] lg:absolute lg:inset-y-[12.5rem] lg:left-(--gutter) xl:left-1 lg:mx-0 lg:mt-0 lg:flex lg:w-[40%] lg:items-start lg:bg-none lg:px-0 lg:pt-0 lg:pb-[2.5rem]">
          {/* The frame (tape, rules, button) stays put; only the product's text rolls to the next one. */}
          <div aria-live="polite" className="w-full">
            <Tape className="-rotate-[2deg] py-1 [--tape-end:1.1rem] lg:[--tape-end:1.5rem]">
              <p className="flex items-baseline gap-2 font-display leading-none font-extrabold uppercase">
                <span className="text-[3.5rem] lg:text-[min(7rem,13svh)]">
                  <TextSwap value={String(index + 1).padStart(2, "0")} direction={direction} />
                </span>
                <span className="text-[1.25rem] text-[#14110a]/60 lg:text-[1.875rem]">/{String(n).padStart(2, "0")}</span>
              </p>
            </Tape>
            <h3 className="mt-3 font-display text-[clamp(2.375rem,9vw,4rem)] leading-[0.92] font-extrabold tracking-[-0.01em] [word-spacing:0.05em] uppercase lg:mt-5">
              <TextSwap value={items[index].title} direction={direction} display="block" />
            </h3>
            <p className="mt-2 text-[1.0625rem] text-white/85">
              <TextSwap value={items[index].price} direction={direction} />
            </p>

            <ul aria-label={copy.showroom.specs} className="mt-4 hidden border-t border-white/20 lg:block [@media(max-height:48rem)]:lg:hidden [@media(min-aspect-ratio:8/5)_and_(min-width:1326px)]:lg:hidden">
              {[0, 1, 2].map((row) => {
                const spec = items[index].specs[row] ?? "";
                return (
                  <li
                    key={row}
                    className={cn("flex gap-3 border-b border-white/15 py-3 text-[0.875rem] leading-snug text-white/75", !spec && "hidden")}
                  >
                    <span aria-hidden="true" className="mt-[0.4375rem] size-1.5 flex-none bg-gold" />
                    <TextSwap value={spec} direction={direction} display="block" />
                  </li>
                );
              })}
            </ul>

            <Button href={items[index].href} arrow className="mt-5 w-full sm:w-auto">
              {copy.showroom.shop}
            </Button>
          </div>
        </div>
        </div>
      </div>
    </section>
  );
}
