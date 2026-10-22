"use client";

import { AnimatePresence, motion } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties } from "react";

import { useMotionEnabled } from "@/components/motion/motion-preference";
import { Reveal } from "@/components/motion/Reveal";
import { Carousel } from "@/components/ui/Carousel";
import { ArrowRightIcon } from "@/components/ui/Icons";
import type { TileTheme } from "@/lib/catalog/types";
import { cn } from "@/lib/cn";

/** One face of a tile: a collection or a product, as plain props. */
export interface StripTile {
  key: string;
  href: string;
  label: string;
  /** One entry per row of the big title. */
  title: string[];
  image: { url: string; alt: string } | null;
  secondaryImage?: { url: string; alt: string } | null;
  /** The tile's colour; without one it takes its slot's. */
  theme?: TileTheme | null;
  cta: string;
}

const themes: Record<TileTheme, { bg: string; label: string; dash: string; title: string; cta: string }> = {
  cream: {
    bg: "bg-tile-cream",
    label: "text-gold-soft",
    dash: "bg-gold-soft",
    title: "text-black",
    cta: "border-[#cfc8ba] bg-[#fcfbf9] text-[#111] hover:border-black",
  },
  dark: {
    bg: "bg-tile-dark",
    label: "text-gold",
    dash: "bg-gold",
    title: "text-white",
    cta: "border-white/30 bg-transparent text-white hover:border-white hover:bg-white/5",
  },
  sand: {
    bg: "bg-[#f1ebe2]",
    label: "text-gold-soft",
    dash: "bg-gold-soft",
    title: "text-black",
    cta: "border-[#cfc8ba] bg-[#fcfbf9] text-[#111] hover:border-black",
  },
};

/** The four slots of the reference design: their colour (for tiles without one of their own) and width. */
const SLOTS: { theme: TileTheme; width: string }[] = [
  { theme: "cream", width: "288fr" },
  { theme: "dark", width: "282fr" },
  { theme: "dark", width: "282fr" },
  { theme: "sand", width: "288fr" },
];

/** A random tile turns every this many ms (the next wait is picked again each time). */
const TURN_EVERY = { min: 2600, spread: 2600 };
const TURN = { duration: 0.75, ease: [0.65, 0, 0.35, 1] as const };

const SIZES = { single: "(min-width: 1326px) 12.1vw, 160px", main: "(min-width: 1326px) 15.1vw, 200px", second: "(min-width: 1326px) 21.1vw, 280px" };

/**
 * Photo column of a tile. Two-photo tiles get their own composition.
 *
 * Sizes are those of the reference (a 288px tile at 1326px), capped by the tile's own width
 * (`cqw`, 1rem = 5.56cqw of a 288px tile): between 1024px and 1326px the tiles are narrower than in
 * the reference, so photo, text and button shrink together instead of the title being cut off.
 */
function TileArt({ tile, priority }: { tile: StripTile; priority?: boolean }) {
  if (!tile.image) return null;

  if (tile.secondaryImage) {
    return (
      <>
        <div className="absolute top-[-0.875rem] right-[max(-3.875rem,-21.5cqw)] h-[13.125rem] w-[min(17.5rem,97.2cqw)] [mask-image:linear-gradient(90deg,transparent,#000_34%)]">
          <Image src={tile.secondaryImage.url} alt="" fill sizes={SIZES.second} className="object-cover transition-transform duration-500 group-hover:scale-[1.04]" />
        </div>
        <div className="absolute top-[-0.75rem] left-[max(-3.375rem,-18.75cqw)] h-[9.375rem] w-[min(12.5rem,69.4cqw)] [mask-image:linear-gradient(90deg,#000_66%,transparent)]">
          <Image src={tile.image.url} alt={tile.image.alt} fill priority={priority} sizes={SIZES.main} className="object-cover transition-transform duration-500 group-hover:scale-[1.04]" />
        </div>
      </>
    );
  }

  return (
    <div className="absolute inset-y-0 left-0 w-[min(9.25rem,51.4cqw)] [mask-image:linear-gradient(90deg,#000_70%,transparent)] max-lg:w-[10rem]">
      <Image
        src={tile.image.url}
        alt={tile.image.alt}
        fill
        priority={priority}
        sizes={SIZES.single}
        className="scale-[1.04] object-cover transition-transform duration-500 group-hover:scale-[1.08]"
      />
    </div>
  );
}

function Tile({ tile, theme, first, priority }: { tile: StripTile; theme: TileTheme; first: boolean; priority?: boolean }) {
  const t = themes[theme];
  const wide = Boolean(tile.secondaryImage);

  return (
    <article className={cn("group shine @container relative isolate h-full overflow-hidden", t.bg)}>
      <TileArt tile={tile} priority={priority} />

      <div
        className={cn(
          "absolute inset-y-0 right-0 flex flex-col justify-center pr-3",
          wide ? "left-[min(6.3125rem,35.1cqw)] max-lg:left-[8.125rem]" : "left-[min(9.1875rem,51cqw)] max-lg:left-[10rem]",
        )}
      >
        <p
          className={cn(
            "flex items-center font-nav text-[0.625rem] leading-[0.625rem] font-semibold tracking-[0.07em] whitespace-nowrap uppercase lg:text-[length:min(0.4625rem,2.57cqw)]",
            t.label,
          )}
        >
          {tile.label}
          {/* Only the first tile has the inline dash in the design. */}
          {first && <span aria-hidden="true" className="ml-[0.875rem] h-[0.125rem] w-[1.1875rem] bg-gold-soft" />}
        </p>
        <span aria-hidden="true" className={cn("mt-[0.375rem] h-[0.125rem] w-[1rem]", t.dash)} />

        <h3
          className={cn(
            "mt-[0.5625rem] font-display text-[length:min(1.43125rem,7.95cqw)] leading-[min(1.1875rem,6.6cqw)] font-extrabold tracking-[-0.05em] [word-spacing:0.08em] uppercase",
            t.title,
          )}
        >
          {tile.title.map((line) => (
            <span key={line} className="block truncate">
              {line}
            </span>
          ))}
        </h3>

        <Link
          href={tile.href}
          className={cn(
            "mt-[0.875rem] inline-flex h-10 w-[9.375rem] items-center justify-center gap-[0.375rem] border font-nav text-[0.6875rem] font-semibold tracking-[0.06em] whitespace-nowrap uppercase transition-colors after:absolute after:inset-0 after:content-[''] lg:h-[1.3125rem] lg:w-[min(7.1875rem,39.9cqw)] lg:text-[length:min(0.4875rem,2.7cqw)]",
            t.cta,
          )}
        >
          {tile.cta}
          <ArrowRightIcon size={12} strokeWidth={1.8} className="lg:h-[0.5625rem] lg:w-[0.5625rem]" />
        </Link>
      </div>
    </article>
  );
}

/**
 * Each face is a side of a cube whose axis sits half a tile behind it: the face leaving turns up
 * and away (rotateX 0 -> 90deg) while the next one rolls up from below (-90deg -> 0).
 */
const face = {
  enter: { rotateX: -90, filter: "brightness(0.55)" },
  center: { rotateX: 0, filter: "brightness(1)" },
  exit: { rotateX: 90, filter: "brightness(0.55)" },
};

/** Loads the pictures of the tiles coming next, so a tile never turns to an empty photo. */
function Preload({ tiles }: { tiles: StripTile[] }) {
  return (
    <div aria-hidden="true" className="invisible absolute h-0 w-0 overflow-hidden">
      {tiles.flatMap((t) => [
        t.image && <Image key={`${t.key}-1`} src={t.image.url} alt="" width={8} height={8} sizes={t.secondaryImage ? SIZES.main : SIZES.single} loading="eager" />,
        t.secondaryImage && <Image key={`${t.key}-2`} src={t.secondaryImage.url} alt="" width={8} height={8} sizes={SIZES.second} loading="eager" />,
      ])}
    </div>
  );
}

/**
 * The strip under the hero: four tiles in the reference design. From time to time a random tile
 * rolls up like a cube and shows another collection or product in the same design, so the strip
 * walks through the whole store. It holds still while the pointer or keyboard focus is on it, while
 * it is off screen, and with reduced motion.
 */
export function RotatingStrip({ tiles, label }: { tiles: StripTile[]; label: string }) {
  const motionOn = useMotionEnabled();
  const slotCount = Math.min(SLOTS.length, tiles.length);
  // `shown`: the tile in each slot; `queue`: the tiles waiting, in the order they will come up.
  const [{ shown, queue }, setDeck] = useState(() => ({
    shown: tiles.slice(0, slotCount).map((_, i) => i),
    queue: tiles.slice(slotCount).map((_, i) => i + slotCount),
  }));
  const section = useRef<HTMLElement>(null);
  const held = useRef(false);
  const inView = useRef(false);
  const lastSlot = useRef(-1);
  const shuffled = useRef(false);
  const [warm, setWarm] = useState(false);
  const canTurn = motionOn && queue.length > 0;

  useEffect(() => {
    const el = section.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        inView.current = entry.isIntersecting;
        // Once the strip has been seen, load the pictures of every tile still to come.
        if (entry.isIntersecting) setWarm(true);
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!canTurn) return;
    let timer: ReturnType<typeof setTimeout>;
    const turn = () => {
      if (!held.current && inView.current && document.visibilityState === "visible") {
        // A random slot, never the same one twice in a row.
        let slot = Math.floor(Math.random() * slotCount);
        if (slotCount > 1 && slot === lastSlot.current) slot = (slot + 1 + Math.floor(Math.random() * (slotCount - 1))) % slotCount;
        lastSlot.current = slot;
        // The rest of the store comes up in a different order on every visit (shuffled at the first
        // turn, so the server's first frame and hydration match).
        const rank = shuffled.current ? null : tiles.map(() => Math.random());
        shuffled.current = true;
        setDeck(({ shown, queue }) => {
          const order = rank ? [...queue].sort((a, b) => rank[a] - rank[b]) : queue;
          const next = [...shown];
          next[slot] = order[0];
          return { shown: next, queue: [...order.slice(1), shown[slot]] };
        });
      }
      timer = setTimeout(turn, TURN_EVERY.min + Math.random() * TURN_EVERY.spread);
    };
    timer = setTimeout(turn, TURN_EVERY.min + Math.random() * TURN_EVERY.spread);
    return () => clearTimeout(timer);
  }, [canTurn, slotCount, tiles]);

  if (slotCount === 0) return null;
  const columns = SLOTS.slice(0, slotCount).map((s) => s.width).join(" ");

  return (
    <section
      ref={section}
      aria-label={label}
      style={{ "--strip-cols": columns } as CSSProperties}
      onPointerEnter={() => (held.current = true)}
      onPointerLeave={() => (held.current = false)}
      onFocus={() => (held.current = true)}
      onBlur={() => (held.current = false)}
      className="mx-auto mt-[0.5625rem] max-w-(--container) px-(--gutter) md:bg-cream md:p-[0.125rem]"
    >
      <Carousel label={label} gapClassName="gap-[0.15625rem]" gridClassName="md:grid md:grid-cols-2 lg:grid-cols-(--strip-cols)">
        {shown.map((tileIndex, slot) => {
          const tile = tiles[tileIndex];
          return (
            <Reveal
              as="li"
              key={slot}
              delay={slot * 0.09}
              y={22}
              className="h-[9.375rem] w-[84vw] max-w-[23.75rem] flex-none snap-start [perspective:56rem] md:w-auto md:max-w-none lg:h-(--strip-tile-h)"
            >
              <div className="relative h-full [transform-style:preserve-3d]">
                <AnimatePresence initial={false}>
                  <motion.div
                    key={tile.key}
                    variants={face}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={TURN}
                    className="absolute inset-0 [backface-visibility:hidden] [transform-origin:50%_50%_-4.6875rem] lg:[transform-origin:50%_50%_calc(var(--strip-tile-h)/-2)]"
                  >
                    <Tile tile={tile} theme={tile.theme ?? SLOTS[slot].theme} first={slot === 0} priority={slot < 2} />
                  </motion.div>
                </AnimatePresence>
              </div>
            </Reveal>
          );
        })}
      </Carousel>
      {canTurn && warm && <Preload tiles={queue.map((i) => tiles[i])} />}
    </section>
  );
}
