"use client";

import Image from "next/image";
import { useRef, useState, type PointerEvent } from "react";

import { ModelViewer } from "@/components/three/ModelViewer";
import { Art, textureStyle } from "@/components/ui/Art";
import { copy } from "@/config/copy";
import type { ModelSpec } from "@/config/models";
import { useMediaQuery } from "@/lib/browser";
import { cn } from "@/lib/cn";

interface MediaImage {
  url: string;
  alt: string;
}

interface ProductMediaProps {
  title: string;
  images: MediaImage[];
  /** When present, a 3D tile joins the thumbnails. */
  model: ModelSpec | null;
}

const SWIPE_PX = 44;

/**
 * Product gallery: one big stage, a row of thumbnails (the turntable angles, the on-model shot,
 * and a 3D tile when there is a model). Swipe the stage on a phone, click the tiles anywhere.
 */
export function ProductMedia({ title, images, model }: ProductMediaProps) {
  // Slides: every photo, then the optional 3D view.
  const slides = [...images.map((image) => ({ kind: "photo" as const, image })), ...(model ? [{ kind: "3d" as const }] : [])];
  const [active, setActive] = useState(0);
  const slide = slides[active];
  const startX = useRef<number | null>(null);
  // The detail model (4K texture) only on a big screen with a mouse; phones keep the light one.
  const detail = useMediaQuery("(min-width: 1024px) and (pointer: fine)");

  const go = (delta: number) => setActive((i) => (i + delta + slides.length) % slides.length);

  // Swipe between photos; the 3D stage keeps horizontal drags for rotating.
  const onDown = (e: PointerEvent) => {
    if (e.pointerType === "mouse" || slide.kind === "3d") return;
    startX.current = e.clientX;
  };
  const onUp = (e: PointerEvent) => {
    if (startX.current === null) return;
    const dx = e.clientX - startX.current;
    startX.current = null;
    if (Math.abs(dx) > SWIPE_PX) go(dx < 0 ? 1 : -1);
  };

  return (
    // min-w-0: as a grid child it must not grow to the width of the thumbnail strip.
    <div className="min-w-0">
      <div
        onPointerDown={onDown}
        onPointerUp={onUp}
        className={cn(
          "relative aspect-(--card-ratio) touch-pan-y overflow-hidden rounded-[0.375rem]",
          slide.kind === "3d" ? "bg-[#101010]" : "bg-sand",
        )}
      >
        {slide.kind === "photo" ? (
          <Image
            key={slide.image.url}
            src={slide.image.url}
            alt={slide.image.alt || title}
            fill
            priority={active === 0}
            sizes="(min-width: 1326px) 42.2vw, (min-width: 1024px) 560px, 100vw"
            className="animate-[fade-in_0.4s_ease-out] object-cover"
          />
        ) : (
          model && (
            <>
              <div aria-hidden="true" className="absolute inset-0 opacity-90" style={textureStyle("concrete")} />
              <ModelViewer
                src={detail && model.hd ? model.hd : model.src}
                fit={model.fit}
                rotation={model.rotation}
                fallbackImage={images[0]?.url ?? ""}
                fallbackAlt={images[0]?.alt ?? title}
                className="absolute inset-0 cursor-grab active:cursor-grabbing"
              />
              <Art
                name="stickerOfficial"
                sizes="(min-width: 1326px) 8.3vw, 110px"
                className="pointer-events-none absolute top-3 right-3 h-auto w-[5.25rem] rotate-12 drop-shadow-[0_0.375rem_0.5rem_rgba(0,0,0,0.5)]"
              />
              <p className="pointer-events-none absolute bottom-3 left-3 bg-black px-2.5 py-1 font-nav text-[0.6875rem] font-semibold tracking-[0.12em] text-white uppercase">
                {copy.product.dragToSpin}
              </p>
            </>
          )
        )}
      </div>

      {slides.length > 1 && (
        <ul className="scrollbar-none -mx-(--gutter) mt-2 flex gap-2 overflow-x-auto px-(--gutter) lg:mx-0 lg:grid lg:grid-cols-4 lg:overflow-visible lg:px-0">
          {slides.map((s, i) => (
            <li key={s.kind === "photo" ? s.image.url : "3d"} className="w-[4.5rem] flex-none lg:w-auto">
              <button
                type="button"
                aria-pressed={i === active}
                aria-label={s.kind === "3d" ? copy.product.threeD : copy.product.viewImage(i + 1)}
                onClick={() => setActive(i)}
                className={cn(
                  "relative block aspect-square w-full overflow-hidden rounded-[0.25rem] bg-sand outline-2 -outline-offset-2 transition-[outline-color,opacity]",
                  i === active ? "outline-black" : "opacity-70 outline-transparent hover:opacity-100",
                )}
              >
                {s.kind === "photo" ? (
                  <Image src={s.image.url} alt="" fill sizes="(min-width: 1326px) 8.3vw, 110px" className="object-cover" />
                ) : (
                  <span className="grid size-full place-items-center bg-black font-display text-[1.625rem] leading-none font-extrabold text-gold">
                    {copy.product.threeD}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
