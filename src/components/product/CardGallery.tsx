"use client";

import { useInView } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { useMotionEnabled } from "@/components/motion/motion-preference";
import { ArrowRightIcon } from "@/components/ui/Icons";
import { copy } from "@/config/copy";
import { useMediaQuery } from "@/lib/browser";
import { cn } from "@/lib/cn";

export interface GalleryImage {
  url: string;
  alt: string;
}

interface CardGalleryProps {
  title: string;
  href: string;
  /** The turntable: first is what the card shows at rest. */
  images: GalleryImage[];
  /** On-model shot that fades in over the first slide while a hover-capable pointer is on the card. */
  hover?: GalleryImage | null;
  priority?: boolean;
  sizes: string;
  /** Roomier collection card: bigger arrows and the "On model" tag. */
  lg?: boolean;
  soldOut?: boolean;
  /**
   * The card sits in a horizontally scrolling rail on phones. A second swipe area would fight the
   * rail, so below md the card keeps its first picture and the rail owns the gesture.
   */
  rail?: boolean;
}

/**
 * The picture of a product card. A snap-scrolling strip of the product's angles: swipe on a
 * phone, arrows on hover on a desktop. Only the first picture is loaded up front; the rest
 * load once the visitor touches the card or has had it on screen for a moment, and fade in.
 */
export function CardGallery({ title, href, images, hover, priority = false, sizes, lg = false, soldOut = false, rail = false }: CardGalleryProps) {
  const frame = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const motionOn = useMotionEnabled();
  const total = images.length;
  const [index, setIndex] = useState(0);
  const [armed, setArmed] = useState(false);
  const wide = useMediaQuery("(min-width: 768px)");
  const swipeable = !rail || wide;

  // Warm the other angles once the card has been comfortably on screen.
  const onScreen = useInView(frame, { amount: 0.6 });
  useEffect(() => {
    if (!onScreen || armed || total < 2 || !swipeable) return;
    const timer = setTimeout(() => setArmed(true), 900);
    return () => clearTimeout(timer);
  }, [onScreen, armed, total, swipeable]);

  const arm = () => setArmed(true);

  const onScroll = () => {
    const el = track.current;
    if (el) setIndex(Math.round(el.scrollLeft / el.clientWidth));
  };

  const go = (to: number) => {
    const el = track.current;
    if (!el) return;
    arm();
    el.scrollTo({ left: Math.max(0, Math.min(total - 1, to)) * el.clientWidth, behavior: motionOn ? "smooth" : "auto" });
  };

  const arrow = cn(
    "absolute top-1/2 z-[3] hidden -translate-y-1/2 place-items-center bg-white/90 text-black shadow-[0_2px_10px_rgba(0,0,0,0.25)] transition-[opacity,background-color] duration-200 hover:bg-white focus-visible:opacity-100 [@media(hover:hover)]:grid",
    "opacity-0 group-hover/card:opacity-100 group-focus-within/card:opacity-100",
    lg ? "size-9 rounded-[0.1875rem]" : "size-7 rounded-[0.1875rem]",
  );

  return (
    <div
      ref={frame}
      role="group"
      aria-roledescription="carousel"
      aria-label={copy.product.galleryOf(title)}
      onPointerEnter={arm}
      onTouchStart={arm}
      onFocus={arm}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") go(index + 1);
        if (e.key === "ArrowLeft") go(index - 1);
      }}
      className={cn("shine relative aspect-(--card-ratio) overflow-hidden bg-sand", lg ? "rounded-[0.375rem]" : "rounded-[0.25rem]")}
    >
      <div
        ref={track}
        onScroll={onScroll}
        className={cn(
          "scrollbar-none flex h-full snap-x snap-mandatory overflow-x-auto overscroll-x-contain",
          !swipeable && "overflow-x-hidden",
        )}
      >
        {images.map((image, i) => (
          <div
            key={image.url}
            role="group"
            aria-roledescription="slide"
            aria-label={copy.product.viewCount(i + 1, total)}
            aria-hidden={i === index ? undefined : true}
            className="relative h-full w-full flex-none snap-center"
          >
            {i === 0 ? (
              <Link href={href} tabIndex={-1} aria-hidden="true" className="absolute inset-0 block">
                <Image
                  src={image.url}
                  alt={image.alt}
                  fill
                  priority={priority}
                  sizes={sizes}
                  className={cn(
                    "object-cover transition-[opacity,transform] duration-500 ease-out",
                    hover
                      ? "group-hover/card:scale-[1.03] group-hover/card:opacity-0 group-focus-within/card:opacity-0"
                      : "group-hover/card:scale-[1.05]",
                  )}
                />
                {hover && (
                  <Image
                    src={hover.url}
                    alt={hover.alt}
                    fill
                    sizes={sizes}
                    className="object-cover opacity-0 transition-[opacity,transform] duration-500 ease-out group-hover/card:opacity-100 group-focus-within/card:opacity-100"
                  />
                )}
              </Link>
            ) : (
              armed && (
                <Link href={href} tabIndex={-1} aria-hidden="true" className="absolute inset-0 block">
                  <LazySlide image={image} sizes={sizes} />
                </Link>
              )
            )}
          </div>
        ))}
      </div>

      {total > 1 && swipeable && (
        <>
          {/* Desktop arrows, shown on hover or keyboard focus */}
          <button
            type="button"
            aria-label={copy.product.previousView}
            onClick={() => go(index - 1)}
            tabIndex={index === 0 ? -1 : 0}
            className={cn(arrow, "left-2", index === 0 && "!opacity-0 pointer-events-none")}
          >
            <ArrowRightIcon size={lg ? 18 : 15} strokeWidth={1.6} className="rotate-180" />
          </button>
          <button
            type="button"
            aria-label={copy.product.nextView}
            onClick={() => go(index + 1)}
            tabIndex={index === total - 1 ? -1 : 0}
            className={cn(arrow, "right-2", index === total - 1 && "!opacity-0 pointer-events-none")}
          >
            <ArrowRightIcon size={lg ? 18 : 15} strokeWidth={1.6} />
          </button>

          {/* Position: one tick per angle */}
          <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-1.5 z-[2] flex justify-center gap-1">
            {images.map((image, i) => (
              <span
                key={image.url}
                className={cn(
                  "h-[0.1875rem] rounded-full transition-[width,background-color] duration-300",
                  i === index ? "w-4 bg-black/80" : "w-1.5 bg-black/25",
                )}
              />
            ))}
          </div>
          <p className="sr-only" aria-live="polite">
            {copy.product.viewCount(index + 1, total)}: {images[index]?.alt}
          </p>
        </>
      )}

      {hover && lg && (
        <span
          aria-hidden="true"
          className={cn(
            "absolute bottom-3 left-2 z-[2] bg-black px-2 py-1 font-nav text-[0.625rem] font-semibold tracking-[0.12em] text-white uppercase opacity-0 transition-opacity duration-300",
            index === 0 && "group-hover/card:opacity-100",
          )}
        >
          {copy.product.onModel}
        </span>
      )}

      {soldOut && (
        <span className="absolute top-2 left-2 z-[3] bg-black px-2 py-1 font-nav text-[0.6875rem] font-semibold tracking-[0.1em] text-white uppercase">
          {copy.product.soldOut}
        </span>
      )}
    </div>
  );
}

/** A later angle: mounted only after the card is armed, so the fade-in always sees its load event. */
function LazySlide({ image, sizes }: { image: GalleryImage; sizes: string }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <Image
      src={image.url}
      alt={image.alt}
      fill
      sizes={sizes}
      onLoad={() => setLoaded(true)}
      className={cn("object-cover transition-opacity duration-500", loaded ? "opacity-100" : "opacity-0")}
    />
  );
}
