"use client";

import { AnimatePresence, motion, useScroll } from "motion/react";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState, type PointerEvent } from "react";

import { useMotionEnabled } from "@/components/motion/motion-preference";
import { ModelViewer } from "@/components/three/ModelViewer";
import { Art, textureStyle } from "@/components/ui/Art";
import { ArrowRightIcon } from "@/components/ui/Icons";
import { copy } from "@/config/copy";
import type { ModelSpec } from "@/config/models";
import { useMediaQuery } from "@/lib/browser";
import { cn } from "@/lib/cn";

import { useOptionalVariant } from "./VariantContext";

/** Same picture, whatever version query Shopify's CDN added. */
const samePicture = (a: string, b: string) => a.split("?")[0] === b.split("?")[0];

interface MediaImage {
  url: string;
  alt: string;
}

type Slide = { kind: "photo"; image: MediaImage } | { kind: "3d" };

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
  const slides: Slide[] = [...images.map((image) => ({ kind: "photo" as const, image })), ...(model ? [{ kind: "3d" as const }] : [])];
  const [active, setActive] = useState(0);
  const slide = slides[active];
  const motionOn = useMotionEnabled();
  const startX = useRef<number | null>(null);
  // The detail model (4K texture) only on a big screen with a mouse; phones keep the light one.
  const detail = useMediaQuery("(min-width: 1024px) and (pointer: fine)");

  const go = (delta: number) => setActive((i) => (i + delta + slides.length) % slides.length);

  // Picking a colour (or any variant with its own picture) in the buy box shows that picture: when
  // the chosen variant's picture changes, the stage moves to it (adjusted during render). It starts
  // as the first variant's picture, so the page opens on the merchant's first photo.
  const variantImage = useOptionalVariant()?.variant?.image?.url ?? null;
  const [shownVariantImage, setShownVariantImage] = useState<string | null>(variantImage);
  if (variantImage !== shownVariantImage) {
    setShownVariantImage(variantImage);
    const index = variantImage ? images.findIndex((image) => samePicture(image.url, variantImage)) : -1;
    if (index >= 0) setActive(index);
  }

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
        {/* Photos cross-fade: the next one fades in over the last, never through an empty frame. */}
        <AnimatePresence initial={false}>
          {slide.kind === "photo" && (
            <motion.div
              key={slide.image.url}
              className="absolute inset-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={motionOn ? { duration: 0.55, ease: [0.22, 1, 0.36, 1] } : { duration: 0 }}
            >
              <Image
                src={slide.image.url}
                alt={slide.image.alt || title}
                fill
                priority={active === 0}
                sizes="(min-width: 1326px) 42.2vw, (min-width: 1024px) 560px, 100vw"
                className="object-contain"
              />
            </motion.div>
          )}
        </AnimatePresence>
        {slide.kind === "photo" ? null : (
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

      {slides.length > 1 && <ThumbStrip slides={slides} active={active} onPick={setActive} />}
    </div>
  );
}

const VISIBLE_THUMBS = 4;

const STRIP_ARROW =
  "absolute top-1/2 z-[2] hidden size-8 -translate-y-1/2 place-items-center rounded-[0.1875rem] bg-white/90 text-black shadow-[0_2px_10px_rgba(0,0,0,0.25)] transition-[opacity,background-color] duration-300 hover:bg-white [@media(hover:hover)]:grid";

/**
 * The thumbnails: one row as wide as the photo, four at a time, the rest a swipe (or an arrow,
 * with a mouse) away, with the site's gold progress rule under it. The thumbnail of the picture on
 * the stage always slides into view (after a swipe on the stage or a colour pick).
 */
function ThumbStrip({ slides, active, onPick }: { slides: Slide[]; active: number; onPick: (index: number) => void }) {
  const motionOn = useMotionEnabled();
  const strip = useRef<HTMLUListElement>(null);
  const { scrollXProgress } = useScroll({ container: strip });
  const [edges, setEdges] = useState({ prev: false, next: false });

  const measure = useCallback(() => {
    const el = strip.current;
    if (!el) return;
    const prev = el.scrollLeft > 2;
    const next = el.scrollLeft + el.clientWidth < el.scrollWidth - 2;
    setEdges((e) => (e.prev === prev && e.next === next ? e : { prev, next }));
  }, []);

  useEffect(() => {
    const el = strip.current;
    if (!el) return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [measure]);

  // Keep the active thumbnail in view, moving the row only (never the page).
  useEffect(() => {
    const el = strip.current;
    const item = el?.children[active] as HTMLElement | undefined;
    if (!el || !item) return;
    const left = item.offsetLeft;
    const right = left + item.offsetWidth;
    const behavior = motionOn ? "smooth" : "auto";
    if (left < el.scrollLeft) el.scrollTo({ left, behavior });
    else if (right > el.scrollLeft + el.clientWidth) el.scrollTo({ left: right - el.clientWidth, behavior });
  }, [active, motionOn]);

  const page = (direction: 1 | -1) => strip.current?.scrollBy({ left: direction * strip.current.clientWidth, behavior: motionOn ? "smooth" : "auto" });
  // Always four across, so more than four means a row to scroll (known at render: no late shift).
  const more = slides.length > VISIBLE_THUMBS;

  return (
    <div className="mt-2">
      <div className="relative">
        <ul
          ref={strip}
          onScroll={measure}
          className="scrollbar-none relative flex snap-x snap-mandatory gap-2 overflow-x-auto overscroll-x-contain"
        >
          {slides.map((s, i) => (
            // Four across: a quarter of the row less its three 0.5rem gaps.
            <li key={s.kind === "photo" ? s.image.url : "3d"} className="w-[calc((100%-1.5rem)/4)] flex-none snap-start">
              <button
                type="button"
                aria-pressed={i === active}
                aria-label={s.kind === "3d" ? copy.product.threeD : copy.product.viewImage(i + 1)}
                onClick={() => onPick(i)}
                className={cn(
                  "relative block aspect-square w-full overflow-hidden rounded-[0.25rem] bg-sand outline-2 -outline-offset-2 transition-[outline-color,opacity] duration-300 ease-out",
                  i === active ? "outline-black" : "opacity-70 outline-transparent hover:opacity-100",
                )}
              >
                {s.kind === "photo" ? (
                  <Image src={s.image.url} alt="" fill sizes="(min-width: 1326px) 10vw, (min-width: 1024px) 134px, 25vw" className="object-contain" />
                ) : (
                  <span className="grid size-full place-items-center bg-black font-display text-[1.625rem] leading-none font-extrabold text-gold">
                    {copy.product.threeD}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>

        {more && (
          <>
            <button
              type="button"
              aria-label={copy.product.previousView}
              onClick={() => page(-1)}
              tabIndex={edges.prev ? 0 : -1}
              className={cn(STRIP_ARROW, "left-1.5", !edges.prev && "pointer-events-none opacity-0")}
            >
              <ArrowRightIcon size={15} strokeWidth={1.6} className="rotate-180" />
            </button>
            <button
              type="button"
              aria-label={copy.product.nextView}
              onClick={() => page(1)}
              tabIndex={edges.next ? 0 : -1}
              className={cn(STRIP_ARROW, "right-1.5", !edges.next && "pointer-events-none opacity-0")}
            >
              <ArrowRightIcon size={15} strokeWidth={1.6} />
            </button>
          </>
        )}
      </div>

      {/* How far along the row is: the site's carousel rule. */}
      {more && (
        <div aria-hidden="true" className="mt-2 h-[0.125rem] w-full bg-black/10">
          <motion.div style={{ scaleX: scrollXProgress }} className="h-full origin-left bg-gold" />
        </div>
      )}
    </div>
  );
}
