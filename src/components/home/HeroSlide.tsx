import { LatePhoto } from "@/components/home/LatePhoto";
import { ParallaxLayer } from "@/components/motion/ParallaxLayer";
import { ScrollHost, ScrollLayer } from "@/components/motion/ScrollHost";
import { SaleSticker } from "@/components/product/SaleSticker";
import { SaleTag } from "@/components/product/SaleTag";
import { Button } from "@/components/ui/Button";
import { copy } from "@/config/copy";
import type { Collection } from "@/lib/catalog";
import type { Sale } from "@/lib/catalog/announcements";
import type { CollectionHero } from "@/lib/catalog/types";
import { cn } from "@/lib/cn";

const delay = (ms: number) => ({ "--d": ms }) as React.CSSProperties;

/**
 * A collection's slide in the home hero, built like the first one (see Hero): the headline, with its
 * last row in gold, and the tape button in the same places, the collection's photo melting into the
 * black around it. The photo, the texts and the button come from the collection in Shopify; the label
 * shows its current discount.
 */
export function HeroSlide({ collection, hero, sale }: { collection: Collection; hero: CollectionHero; sale: Sale | null }) {
  const id = `hero-${collection.handle}`;
  const kicker = hero.kicker ?? collection.shortTitle ?? collection.title;
  const photo = hero.mobileImage ?? hero.image;

  return (
    <ScrollHost aria-labelledby={id} className="relative isolate flex h-full flex-col overflow-hidden bg-black lg:block lg:h-(--hero-h)">
      <ScrollLayer
        scale={[1, 1.06]}
        opacity={[1, 0.35]}
        origin="60% 0%"
        className="hero-slide-mask relative z-0 h-[min(100vw,27rem)] w-full overflow-hidden sm:h-[24.375rem] lg:absolute lg:top-0 lg:right-0 lg:left-(--hero-slide-left) lg:h-(--hero-h) lg:w-auto"
      >
        <ParallaxLayer depth={6} className="h-full w-full">
          <div className="hero-slide-photo relative h-full w-full">
            {/* Phones: the photo made for them, or the centre of the wide one. */}
            <LatePhoto
              image={photo}
              sizes={hero.mobileImage ? "100vw" : "255vw"}
              className={cn("object-cover sm:hidden", hero.mobileImage ? "object-top" : "object-[50%_100%]")}
              media="(max-width: 639px)"
            />
            <LatePhoto image={hero.image} sizes="(min-width: 1326px) 72vw, (min-width: 1024px) 78vw, 135vw" className="object-cover object-[50%_100%] max-sm:hidden lg:object-[50%_45%]" media="(min-width: 640px)" />
          </div>
        </ParallaxLayer>
      </ScrollLayer>

      <div className="relative z-[3] mx-auto -mt-6 flex w-full flex-1 flex-col px-(--gutter) pb-10 lg:mt-0 lg:block lg:h-full lg:max-w-(--container) lg:p-0">
        <ScrollLayer y={[0, -64]} opacity={[1, 0.1]} during={[0, 0.85]} className="lg:absolute lg:top-(--hero-headline-top) lg:left-(--hero-headline-left)">
          <p className="anim-pop mb-2 flex items-center gap-2.5 font-nav text-[0.75rem] leading-none font-semibold tracking-[0.14em] text-gold uppercase lg:absolute lg:bottom-full lg:mb-2 lg:whitespace-nowrap" style={delay(260)}>
            {kicker}
            {sale && !sale.sticker && (
              <SaleTag className="-rotate-2 text-[1.125rem] lg:text-[1.0625rem]">{copy.product.percentOff(sale.percent, sale.upTo)}</SaleTag>
            )}
          </p>
          <h2
            id={id}
            className="font-display text-[clamp(3.25rem,15vw,5.25rem)] leading-[0.82] font-extrabold uppercase [-webkit-text-stroke:0.03125rem_currentColor] [word-spacing:0.04em] lg:text-(length:--hero-headline-size) lg:leading-(--hero-headline-lh)"
          >
            {hero.title.map((line, i) => (
              <span key={i} className="block">
                <span
                  className={cn("anim-line block tracking-[-0.02em]", hero.title.length > 1 && i === hero.title.length - 1 ? "shimmer-gold" : "text-[#f4f4f0]")}
                  style={delay(320 + i * 130)}
                >
                  {line}
                </span>
              </span>
            ))}
          </h2>
        </ScrollLayer>

        {/* The discount's sticker, stuck beside the headline. */}
        {sale?.sticker && (
          <ScrollLayer
            y={[0, -80]}
            opacity={[1, 0]}
            during={[0, 0.7]}
            className="pointer-events-none absolute top-[2.25rem] right-(--gutter) lg:top-[6.9rem] lg:right-auto lg:left-[12.4rem]"
          >
            <span className="anim-pop block" style={delay(620)}>
              <SaleSticker src={sale.sticker} percent={sale.percent} upTo={sale.upTo} eager className="rotate-[9deg] text-[clamp(1.25rem,6.2vw,1.875rem)] lg:text-[1.3125rem]" />
            </span>
          </ScrollLayer>
        )}

        <ScrollLayer y={[0, -36]} opacity={[1, 0]} during={[0, 0.6]} className="mt-5 sm:mt-7 lg:absolute lg:top-(--hero-cta-top) lg:left-(--hero-headline-left) lg:mt-0">
          <Button
            href={`/collections/${collection.handle}`}
            size="none"
            style={delay(760)}
            className="anim-pop h-12 w-full text-[0.875rem] hover:-translate-y-0.5 sm:w-auto sm:px-8 lg:h-(--hero-cta-h) lg:px-7 lg:text-[0.85625rem] lg:tracking-[0.04em]"
          >
            {hero.cta ?? copy.hero.cta}
          </Button>
        </ScrollLayer>
      </div>
    </ScrollHost>
  );
}
