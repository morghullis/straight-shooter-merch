import type { Product, ProductColor } from "./types";

export const isColorOption = (name: string) => ["color", "colour"].includes(name.toLowerCase());

/**
 * The colours a product comes in: its "Color" option values (what can be bought), with the swatch
 * Shopify has for each in the product's category field "Color"; without a Color option, the
 * category field itself. Colours without a swatch keep their name (hex null).
 */
export function productColors(product: Product): ProductColor[] {
  const known = new Map((product.colors ?? []).map((c) => [c.label.toLowerCase(), c]));
  const option = product.options.find((o) => isColorOption(o.name));
  if (!option) return product.colors ?? [];
  return option.values.map((value) => known.get(value.toLowerCase()) ?? { label: value, hex: null });
}
