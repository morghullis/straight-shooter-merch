"use client";

import { motion, useInView, useMotionValueEvent, useScroll, useTransform } from "motion/react";
import dynamic from "next/dynamic";
import { useCallback, useRef, useState } from "react";

import { useMotionEnabled } from "@/components/motion/motion-preference";
import { useSequencedChange } from "@/components/motion/useSequencedChange";
import { Art, textureStyle } from "@/components/ui/Art";
import { Button } from "@/components/ui/Button";
import { Tape } from "@/components/ui/Tape";
import { copy } from "@/config/copy";
import { showroomMotion as motionCfg } from "@/config/showroom";
import { useAfterLoad, useMediaQuery } from "@/lib/browser";
import { cn } from "@/lib/cn";

import type { ShowroomItem } from "./showroom-types";

// Three.js only downloads when the section is about to be reached.
const ScrubStage = dynamic(() => import("@/components/three/ScrubStage"), { ssr: false });

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

/** Maps the page scroll (0..1 across the section) to a position along the products: 0 = first, n-1 = last. */
function productAt(scrollProgress: number, n: number): number {
  const steps = n - 1;
  const stepsLength = steps * motionCfg.pageSvh;
  return clamp((scrollProgress * (stepsLength + motionCfg.tailSvh)) / stepsLength, 0, 1) * steps;
}

/**
 * Pinned scroll story. The section is N screens tall and the stage stays put. The scroll only
 * decides WHICH product belongs on stage; `useSequencedChange` performs every change the same calm
 * way (leave, swap while invisible, arrive, rest), so the speed of the scroll never changes the speed
 * of the show and only one product is ever on screen. Scrolling inside a product's page turns it a
 * little; dragging turns it further. The rail jumps to a product.
 */
export function ShowroomScrub({ items }: { items: ShowroomItem[] }) {
  const n = items.length;
  const section = useRef<HTMLElement>(null);
  const motionOn = useMotionEnabled();
  const desktop = useMediaQuery("(min-width: 1024px)", true);

  const { scrollYProgress } = useScroll({ target: section, offset: ["start start", "end end"] });
  const near = useInView(section, { once: true, margin: "700px 0px" });
  const loaded = useAfterLoad();
  const visible = useInView(section, { margin: "120px 0px" });

  // Which models are loaded and uploaded, as reported by the 3D stage.
  const readyItems = useRef(new Set<number>());
  const [anyReady, setAnyReady] = useState(false);
  const onItemReady = useCallback((i: number) => {
    readyItems.current.add(i);
    setAnyReady(true);
  }, []);
  const onItemGone = useCallback((i: number) => {
    readyItems.current.delete(i);
  }, []);
  const isReady = useCallback((i: number) => readyItems.current.has(i), []);

  const { active, settled, reveal, slide, waiting, request, touch } = useSequencedChange({ timing: motionCfg, isReady });
  const [wanted, setWanted] = useState(0);
  const wantedNow = useRef(0);
  const jumping = useRef<number | null>(null);

  const want = (i: number) => {
    wantedNow.current = i;
    setWanted(i);
    request(i);
  };

  // The scroll position along the products. A product gives way only once the scroll is clearly past
  // the halfway point (hysteresis), so a hovering scroll never flips back and forth.
  const position = useTransform(scrollYProgress, (p) => productAt(p, n));
  useMotionValueEvent(position, "change", (v) => {
    touch();
    if (jumping.current !== null) {
      if (Math.abs(v - jumping.current) < 0.2) jumping.current = null;
      return;
    }
    if (Math.abs(v - wantedNow.current) > 0.5 + motionCfg.hysteresis) want(clamp(Math.round(v), 0, n - 1));
  });

  // What leaves and arrives with the change.
  const copyShift = useTransform(slide, (v) => `${v * 1.4}rem`);
  const stickerScale = useTransform(reveal, [0, 1], [0.9, 1]);

  const jumpTo = (i: number) => {
    const el = section.current;
    if (!el) return;
    // While the page scrolls there, the scroll must not "vote" for the products it passes.
    jumping.current = i;
    window.setTimeout(() => {
      jumping.current = null;
    }, 3000);
    want(i);
    touch();
    const top = el.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({ top: top + (i * motionCfg.pageSvh * window.innerHeight) / 100, behavior: motionOn ? "smooth" : "auto" });
  };

  return (
    <section
      ref={section}
      aria-labelledby="showroom-title"
      style={{ height: `calc(${(n - 1) * motionCfg.pageSvh + motionCfg.tailSvh}svh + 100svh)` }}
      className="relative mt-[0.625rem] w-full"
    >
      <div className="sticky top-0 flex h-svh flex-col overflow-hidden bg-[#0d0d0d]">
        {/* Concrete studio wall */}
        <div aria-hidden="true" className="absolute inset-0 opacity-90" style={textureStyle("concrete")} />
        <div aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.55),rgba(0,0,0,0.1)_40%,rgba(0,0,0,0.65))]" />

        {/* 3D stage: the canvas fades as a whole, so the models stay opaque and never blend with each other */}
        <div
          role="img"
          aria-label={copy.showroom.stage(items[active].title)}
          className="absolute inset-0 z-[1] cursor-grab active:cursor-grabbing"
        >
          <motion.div data-showroom-stage style={{ opacity: reveal }} className="absolute inset-0">
            {near && loaded && (
              <ScrubStage
                models={items.map((i) => i.model)}
                activeIndex={active}
                anchorIndex={settled}
                wantedIndex={wanted}
                position={position}
                reveal={reveal}
                slide={slide}
                active={visible}
                offsetX={desktop ? 0.95 : 0}
                offsetY={desktop ? 0 : 0.55}
                onItemReady={onItemReady}
                onItemGone={onItemGone}
              />
            )}
          </motion.div>
          <div
            aria-hidden={anyReady && !waiting}
            className={cn(
              "pointer-events-none absolute inset-0 grid place-items-center transition-opacity duration-500",
              anyReady && !waiting ? "opacity-0" : "opacity-100",
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
        {/* Stamp or sticker stuck on the stage: it comes and goes with the product */}
        {items[active].art && (
          <div aria-hidden="true" className={cn("pointer-events-none absolute z-[2]", items[active].art.className)}>
            <motion.div style={{ opacity: reveal, scale: stickerScale }}>
              <Art
                name={items[active].art.art}
                sizes="(min-width: 1326px) 19.6vw, 260px"
                className="h-auto w-full drop-shadow-[0_8px_14px_rgba(0,0,0,0.5)]"
              />
            </motion.div>
          </div>
        )}

        {/* Title on a strip of tape */}
        <div className="pointer-events-auto pt-[calc(var(--header-h)+1rem)] lg:pt-10">
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
          aria-label={copy.showroom.pickLabel}
          className="pointer-events-auto relative z-10 mt-auto -mb-14 flex gap-1.5 lg:absolute lg:top-auto lg:right-(--gutter) xl:right-1 lg:bottom-8 lg:mt-0 lg:mb-0 lg:gap-6"
        >
          {items.map((it, i) => (
            <button
              key={it.handle}
              type="button"
              onClick={() => jumpTo(i)}
              aria-label={copy.showroom.goTo(it.model.label)}
              aria-current={i === active ? "step" : undefined}
              className={cn(
                "group flex h-10 min-w-10 flex-col items-center justify-center border px-2 font-nav text-[0.75rem] font-semibold tracking-[0.1em] uppercase transition-colors lg:h-auto lg:min-w-0 lg:items-start lg:border-0 lg:px-0",
                i === active
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
                  i === active ? "w-16 bg-gold" : "w-8 bg-white/30 group-hover:w-12",
                )}
              />
            </button>
          ))}
        </nav>

        {/* Copy */}
        <div className="pointer-events-auto relative -mx-(--gutter) bg-[linear-gradient(0deg,#000_30%,rgba(0,0,0,0.85)_70%,transparent)] px-(--gutter) pt-16 pb-[calc(var(--gutter)+env(safe-area-inset-bottom))] lg:absolute lg:inset-y-[12.5rem] lg:left-(--gutter) xl:left-1 lg:mx-0 lg:mt-0 lg:flex lg:w-[40%] lg:items-start lg:bg-none lg:px-0 lg:pt-0 lg:pb-[2.5rem]">
          {/* The copy belongs to the product on stage and comes and goes with it (same clock as the 3D). */}
          <motion.div
            aria-live="polite"
            style={{ opacity: reveal, y: copyShift }}
            className="w-full"
          >
            <Tape className="-rotate-[2deg] py-1 [--tape-end:1.1rem] lg:[--tape-end:1.5rem]">
              <p className="flex items-baseline gap-2 font-display leading-none font-extrabold uppercase">
                <span className="text-[3.5rem] lg:text-[min(7rem,13svh)]">{String(active + 1).padStart(2, "0")}</span>
                <span className="text-[1.25rem] text-[#14110a]/60 lg:text-[1.875rem]">/{String(n).padStart(2, "0")}</span>
              </p>
            </Tape>
            <h3 className="mt-3 font-display text-[clamp(2.375rem,9vw,4rem)] leading-[0.92] font-extrabold tracking-[-0.01em] [word-spacing:0.05em] uppercase lg:mt-5">
              {items[active].title}
            </h3>
            <p className="mt-2 text-[1.0625rem] text-white/85">{items[active].price}</p>

            <ul aria-label={copy.showroom.specs} className="mt-4 hidden border-t border-white/20 lg:block [@media(max-height:48rem)]:lg:hidden [@media(min-aspect-ratio:8/5)_and_(min-width:1326px)]:lg:hidden">
              {items[active].specs.map((spec) => (
                <li key={spec} className="flex gap-3 border-b border-white/15 py-3 text-[0.875rem] leading-snug text-white/75">
                  <span aria-hidden="true" className="mt-[0.4375rem] size-1.5 flex-none bg-gold" />
                  {spec}
                </li>
              ))}
            </ul>

            <Button href={items[active].href} arrow className="mt-5 w-full sm:w-auto">
              {copy.showroom.shop}
            </Button>
          </motion.div>
        </div>
        </div>
      </div>
    </section>
  );
}
