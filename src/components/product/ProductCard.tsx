import Link from "next/link";

import { copy } from "@/config/copy";
import type { Product } from "@/lib/catalog";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/format";

import { CardGallery } from "./CardGallery";

/** Angles shown in a card carousel, so a store with many product photos stays light. */
const MAX_ANGLES = 6;

interface ProductCardProps {
  product: Product;
  priority?: boolean;
  /** "sm" is the 6-up home grid at design scale; "lg" is the roomier collection grid. */
  size?: "sm" | "lg";
  /** True when the card is in a phone rail (horizontal scroller): no inner swipe there. */
  rail?: boolean;
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
export function ProductCard({ product, priority = false, size = "sm", rail = false, className }: ProductCardProps) {
  const lg = size === "lg";
  const hover = product.hoverImage;
  const sizes = lg ? sizeList(product) : [];
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
        href={`/products/${product.handle}`}
        images={angles.length ? angles : [{ url: product.featuredImage.url, alt: product.featuredImage.altText || product.title }]}
        hover={hover ? { url: hover.url, alt: hover.altText || copy.product.onModel } : null}
        priority={priority}
        sizes={imageSizes}
        lg={lg}
        soldOut={!product.availableForSale}
        rail={rail}
      />

      <Link href={`/products/${product.handle}`} className="block focus-visible:outline-offset-4">
        <h3
          className={cn(
            "px-[0.1875rem] text-black group-hover/card:underline group-hover/card:underline-offset-2",
            lg ? "mt-2 text-[0.875rem] leading-[1.25rem]" : "mt-[0.3125rem] text-[0.6625rem] leading-[1rem]",
          )}
        >
          {product.title}
        </h3>
        <p className={cn("px-[0.1875rem] text-black", lg ? "text-[0.875rem] leading-[1.25rem]" : "text-[0.6625rem] leading-[1rem]")}>
          {formatMoney(product.price.amount, product.price.currencyCode)}
        </p>

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
