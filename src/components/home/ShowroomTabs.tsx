"use client";

import { useRef, useState, type KeyboardEvent } from "react";

import { Art, textureStyle } from "@/components/ui/Art";
import { Button } from "@/components/ui/Button";
import { Tape } from "@/components/ui/Tape";
import { ModelViewer } from "@/components/three/ModelViewer";
import { copy } from "@/config/copy";
import { cn } from "@/lib/cn";

import type { ShowroomItem } from "./showroom-types";

/**
 * The same showroom without scroll-jacking: tabs pick the product, drag spins it. Used when
 * animations are off (OS "reduce motion" or the footer switch) or WebGL scrubbing is not
 * available, so nobody loses the 3D view.
 */
export function ShowroomTabs({ items }: { items: ShowroomItem[] }) {
  const [index, setIndex] = useState(0);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const item = items[index];

  const select = (i: number, focus = false) => {
    setIndex(i);
    if (focus) tabs.current[i]?.focus();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    select((index + step + items.length) % items.length, true);
  };

  return (
    <section aria-labelledby="showroom-title" className="mx-auto mt-[0.625rem] max-w-(--container) px-(--gutter) py-14 xl:px-1">
      <Tape className="-rotate-[1.6deg]">
        <h2
          id="showroom-title"
          className="font-display text-[clamp(1.875rem,6vw,3.25rem)] leading-none font-extrabold tracking-[-0.01em] uppercase"
        >
          {copy.showroom.title}
        </h2>
      </Tape>
      <p className="mt-3 max-w-[34ch] text-[0.875rem] leading-relaxed text-white/70">{copy.showroom.lead}</p>

      <div className="relative mt-8 grid overflow-hidden bg-[#0d0d0d] lg:grid-cols-[1fr_1.2fr]">
        <div aria-hidden="true" className="absolute inset-0 opacity-90" style={textureStyle("concrete")} />

        <div className="relative z-10 order-2 flex flex-col p-6 lg:order-1 lg:p-10">
          <p className="font-display text-[1.375rem] leading-none font-extrabold text-gold uppercase">
            {String(index + 1).padStart(2, "0")}
            <span className="text-white/40">/{String(items.length).padStart(2, "0")}</span>
          </p>
          <h3 className="mt-2 font-display text-[clamp(2.375rem,6vw,3.5rem)] leading-[0.92] font-extrabold uppercase">{item.title}</h3>
          <p className="mt-2 text-[1.0625rem] text-white/85">{item.price}</p>
          <Button href={item.href} arrow className="mt-5 self-start">
            {copy.showroom.shop}
          </Button>

          <div role="tablist" aria-label={copy.showroom.pickLabel} onKeyDown={onKeyDown} className="mt-6 flex flex-wrap gap-1.5">
            {items.map((it, i) => (
              <button
                key={it.handle}
                ref={(el) => {
                  tabs.current[i] = el;
                }}
                role="tab"
                aria-selected={i === index}
                tabIndex={i === index ? 0 : -1}
                onClick={() => select(i)}
                className={cn(
                  "h-10 max-w-[14rem] truncate border px-4 font-nav text-[0.75rem] font-semibold tracking-[0.1em] uppercase transition-colors",
                  i === index
                    ? "border-gold bg-gold text-[#14110a]"
                    : "border-white/25 bg-black/50 text-white/75 hover:border-white hover:text-white",
                )}
              >
                {it.model.label}
              </button>
            ))}
          </div>
        </div>

        <div className="relative z-10 order-1 h-[22.5rem] cursor-grab active:cursor-grabbing lg:order-2 lg:h-[32.5rem]">
          <ModelViewer
            src={item.model.src}
            fit={item.model.fit}
            rotation={item.model.rotation}
            fallbackImage={item.image}
            fallbackAlt={item.imageAlt}
            className="absolute inset-0"
          />
          {item.art && (
            <div aria-hidden="true" className={cn("pointer-events-none absolute", item.art.className)}>
              <Art name={item.art.art} sizes="(min-width: 1326px) 19.6vw, 260px" className="h-auto w-full drop-shadow-[0_8px_14px_rgba(0,0,0,0.5)]" />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
