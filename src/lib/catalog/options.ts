import { isColorOption } from "./colors";
import type { CatalogImage, Product, ProductVariant } from "./types";
import type { Selection } from "./variants";

/**
 * How an option shows on the product page, worked out from what Shopify has for it, so an option made in
 * the admin gets its look by itself: an option whose values each have their own photo (a printed
 * quote, a design) shows the photos. Pure functions, tested in tests/options.test.ts.
 */

const has = (variant: ProductVariant, name: string, value: string) => variant.selectedOptions.some((o) => o.name === name && o.value === value);

/** The photo of one value: the variant with the other choices as they are, else any with that value. */
export function valuePhoto(variants: ProductVariant[], selection: Selection, name: string, value: string): CatalogImage | null {
  const withValue = variants.filter((v) => has(v, name, value));
  const exact = withValue.find((v) => v.selectedOptions.every((o) => o.name === name || selection[o.name] === o.value));
  return exact?.image ?? withValue.find((v) => v.image)?.image ?? null;
}

/**
 * The photo of each value of an option, when they are all there and all different: then the photo tells
 * the values apart. Not for sizes (they share a photo) nor colours (they have their dots).
 */
export function optionPhotos(product: Pick<Product, "options" | "variants">, selection: Selection, name: string): Map<string, CatalogImage> | null {
  const option = product.options.find((o) => o.name === name);
  if (!option || option.values.length < 2 || isColorOption(name)) return null;
  const photos = new Map<string, CatalogImage>();
  for (const value of option.values) {
    const photo = valuePhoto(product.variants, selection, name, value);
    if (!photo) return null;
    photos.set(value, photo);
  }
  return new Set([...photos.values()].map((p) => p.url)).size === photos.size ? photos : null;
}
