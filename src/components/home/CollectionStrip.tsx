import Image from "next/image";
import Link from "next/link";

import { PotusWordmark } from "@/components/brand/PotusWordmark";
import { Reveal } from "@/components/motion/Reveal";
import { Carousel } from "@/components/ui/Carousel";
import { ArrowRightIcon } from "@/components/ui/Icons";
import { collectionTiles, home, type CollectionTile, type TileTheme } from "@/config/site";
import { cn } from "@/lib/cn";

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

/** Photo column of a tile. Two-photo tiles (tumbler + hoodie) get their own composition. */
function TileArt({ tile, priority }: { tile: CollectionTile; priority?: boolean }) {
  if (tile.secondaryImage) {
    return (
      <>
        <div className="absolute top-[-0.875rem] right-[-3.875rem] h-[13.125rem] w-[17.5rem] [mask-image:linear-gradient(90deg,transparent,#000_34%)]">
          <Image
            src={tile.secondaryImage}
            alt=""
            fill
            sizes="(min-width: 1326px) 21.1vw, 280px"
            className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
          />
        </div>
        <div className="absolute top-[-0.75rem] left-[-3.375rem] h-[9.375rem] w-[12.5rem] [mask-image:linear-gradient(90deg,#000_66%,transparent)]">
          <Image
            src={tile.image}
            alt={tile.imageAlt}
            fill
            priority={priority}
            sizes="(min-width: 1326px) 15.1vw, 200px"
            className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
          />
        </div>
      </>
    );
  }

  return (
    <div className="absolute inset-y-0 left-0 w-[9.25rem] [mask-image:linear-gradient(90deg,#000_70%,transparent)] max-lg:w-[10rem]">
      <Image
        src={tile.image}
        alt={tile.imageAlt}
        fill
        priority={priority}
        sizes="(min-width: 1326px) 12.1vw, 160px"
        className={cn(
          "object-cover transition-transform duration-500 group-hover:scale-[1.08]",
          tile.imageClassName ?? "scale-[1.04]",
        )}
      />
    </div>
  );
}

function Tile({ tile, priority }: { tile: CollectionTile; priority?: boolean }) {
  const t = themes[tile.theme];
  const wide = Boolean(tile.secondaryImage);

  return (
    <article className={cn("group shine relative isolate h-full overflow-hidden", t.bg)}>
      <TileArt tile={tile} priority={priority} />

      <div
        className={cn(
          "absolute inset-y-0 right-0 flex flex-col justify-center pr-3",
          wide ? "left-[6.3125rem] max-lg:left-[8.125rem]" : "left-[9.1875rem] max-lg:left-[10rem]",
        )}
      >
        <p
          className={cn(
            "flex items-center font-nav text-[0.625rem] leading-[0.625rem] font-semibold tracking-[0.07em] whitespace-nowrap uppercase lg:text-[0.4625rem]",
            t.label,
          )}
        >
          {tile.label}
          {tile.inlineDash && <span aria-hidden="true" className="ml-[0.875rem] h-[0.125rem] w-[1.1875rem] bg-gold-soft" />}
        </p>
        <span aria-hidden="true" className={cn("mt-[0.375rem] h-[0.125rem] w-[1rem]", t.dash)} />

        {tile.wordmark === "potus" ? (
          <PotusWordmark className="mt-[0.5rem]" />
        ) : (
          <h3
            className={cn(
              "mt-[0.5625rem] font-display text-[1.43125rem] leading-[1.1875rem] font-extrabold tracking-[-0.05em] [word-spacing:0.08em] uppercase",
              t.title,
            )}
          >
            {tile.title.map((line) => (
              <span key={line} className="block whitespace-nowrap">
                {line}
              </span>
            ))}
          </h3>
        )}

        <Link
          href={`/collections/${tile.handle}`}
          className={cn(
            "mt-[0.875rem] inline-flex h-10 w-[9.375rem] items-center justify-center gap-[0.375rem] border font-nav text-[0.6875rem] font-semibold tracking-[0.06em] whitespace-nowrap uppercase transition-colors after:absolute after:inset-0 after:content-[''] lg:h-[1.3125rem] lg:w-[7.1875rem] lg:text-[0.4875rem]",
            t.cta,
          )}
        >
          {home.tileCta}
          <ArrowRightIcon size={12} strokeWidth={1.8} className="lg:h-[0.5625rem] lg:w-[0.5625rem]" />
        </Link>
      </div>
    </article>
  );
}

/**
 * Four collection tiles. Desktop: one row on an off-white frame with 2px gutters (the
 * reference). Tablet: 2 x 2. Phones: a snap carousel with the next tile peeking in.
 */
export function CollectionStrip() {
  return (
    <section
      aria-label={home.tilesLabel}
      className="mx-auto mt-[0.5625rem] max-w-(--container) px-(--gutter) md:bg-cream md:p-[0.125rem]"
    >
      <Carousel
        label={home.tilesLabel}
        gapClassName="gap-[0.15625rem]"
        gridClassName="md:grid md:grid-cols-2 lg:grid-cols-(--strip-cols)"
      >
        {collectionTiles.map((tile, i) => (
          <Reveal
            as="li"
            key={tile.handle}
            delay={i * 0.09}
            y={22}
            className="h-[9.375rem] w-[84vw] max-w-[23.75rem] flex-none snap-start md:w-auto md:max-w-none lg:h-(--strip-tile-h)"
          >
            <Tile tile={tile} priority={i < 2} />
          </Reveal>
        ))}
      </Carousel>
    </section>
  );
}
