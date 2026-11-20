import Link from "next/link";

import { copy } from "@/config/copy";
import type { Product } from "@/lib/catalog";
import { isWomens } from "@/lib/catalog/order";
import { Price } from "@/components/ui/Price";
import { listPrice, numericId } from "@/lib/catalog/variants";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/format";

import { CardGallery } from "./CardGallery";
import { productColors, Swatches } from "./Swatches";

/** Angles shown in a card carousel, so a store with many product photos stays light. */
const MAX_ANGLES = 6;

interface ProductCardProps {
  product: Product;
  priority?: boolean;
  /** "sm" is the 6-up home grid at design scale; "lg" is the roomier collection grid. */
  size?: "sm" | "lg";
  /** True when the card is in a phone rail (horizontal scroller): no inner swipe there. */
  rail?: boolean;
  /** Open the product on this variant (e.g. the colour a list is filtered by). */
  variantId?: string | null;
  className?: string;
}

/** Sizes offered by the product, in the order the merchant listed them. */
function sizeList(product: Product): string[] {
  return product.options.find((o) => o.name.toLowerCase() === "size")?.values ?? [];
}

/**
 * Sand tile with the name and price underneath. The picture is a carousel of the product's
 * angles (see CardGallery); on a hover-capable device the first slide cross-fades to the
 * on-model shot. Touch devices keep the garment and swipe through the angles.
 */
export function ProductCard({ product, priority = false, size = "sm", rail = false, variantId, className }: ProductCardProps) {
  const lg = size === "lg";
  const href = `/products/${product.handle}${variantId ? `?variant=${numericId(variantId)}` : ""}`;
  const hover = product.hoverImage;
  // The product's show, and "Women's" for pieces cut for women: Shopify's collection and category fields.
  const label = [product.collectionLabel, isWomens(product) ? copy.product.womens : null].filter(Boolean).join(" · ");
  const sizes = lg ? sizeList(product) : [];
  const { price, from, compareAt } = listPrice(product);
  const imageSizes = lg
    ? "(min-width: 1326px) 20.4vw, (min-width: 1024px) 270px, (min-width: 640px) 33vw, 50vw"
    : "(min-width: 1326px) 13vw, (min-width: 1024px) 173px, (min-width: 640px) 33vw, 50vw";

  // The carousel is the product's own angles; the on-model shot lives on hover, so it is left out here.
  const angles = product.images
    .filter((image) => image.url !== hover?.url)
    .slice(0, MAX_ANGLES)
    .map((image) => ({ url: image.url, alt: image.altText || product.title }));

  return (
    <article className={cn("group/card", className)}>
      <CardGallery
        title={product.title}
        href={href}
        images={angles.length ? angles : [{ url: product.featuredImage.url, alt: product.featuredImage.altText || product.title }]}
        hover={hover ? { url: hover.url, alt: hover.altText || copy.product.onModel } : null}
        priority={priority}
        sizes={imageSizes}
        lg={lg}
        soldOut={!product.availableForSale}
        rail={rail}
      />

      <Link href={href} className="block focus-visible:outline-offset-4">
        {/*
          Every card has the same rows above the price (one for the show, two for the name, kept
          even when empty or short), so the prices of a row line up at the same height.
        */}
        <p
          aria-hidden={label ? undefined : true}
          className={cn(
            "truncate px-[0.1875rem] font-nav font-semibold tracking-[0.1em] text-gold-soft uppercase",
            lg ? "mt-2.5 text-[0.625rem] leading-[0.875rem]" : "mt-[0.375rem] text-[0.5rem] leading-[0.6875rem]",
          )}
        >
          {label || " "}
        </p>
        <h3
          className={cn(
            "line-clamp-2 min-h-[2lh] px-[0.1875rem] text-black group-hover/card:underline group-hover/card:underline-offset-2",
            lg ? "mt-0.5 text-[0.875rem] leading-[1.25rem]" : "mt-px text-[0.6625rem] leading-[1rem]",
          )}
        >
          {product.title}
        </h3>
        {/* The price leads: the display type, big, under the name (like the Showroom's tape). */}
        <div className={cn("flex items-baseline justify-between gap-2 px-[0.1875rem]", lg ? "mt-1.5" : "mt-1")}>
          <p className="flex min-w-0 flex-wrap items-baseline gap-x-1.5 text-black">
            {from && (
              <span className={cn("font-nav leading-none font-semibold tracking-[0.12em] text-black/55 uppercase", lg ? "text-[0.625rem]" : "text-[0.5625rem]")}>
                {copy.product.from}
              </span>
            )}
            <Price amount={price.amount} currency={price.currencyCode} className={lg ? "text-[1.5625rem] sm:text-[1.75rem]" : "text-[0.875rem] [--price-minor:0.6em]"} />
            {compareAt && (
              <s className={cn("leading-none text-black/45", lg ? "text-[0.875rem]" : "text-[0.6875rem]")}>
                {formatMoney(compareAt.amount, compareAt.currencyCode)}
              </s>
            )}
          </p>
          <Swatches colors={productColors(product)} size={size} />
        </div>

        {sizes.length > 1 && (
          <p
            className="px-[0.1875rem] pt-0.5 font-nav text-[0.6875rem] tracking-[0.12em] text-black/45 uppercase opacity-0 transition-opacity duration-300 group-hover/card:opacity-100 pointer-coarse:opacity-100"
            aria-label={`${copy.product.sizes}: ${sizes.join(", ")}`}
          >
            {sizes.join(" · ")}
          </p>
        )}
      </Link>
    </article>
  );
}
