import type { Money, Product, ProductVariant } from "./types";

/**
 * Picking a variant from the product's options (Color, Size...). Pure functions, shared by the buy
 * box and tested on their own (tests/variants.test.ts).
 */

export type Selection = Record<string, string>;

export const matches = (variant: ProductVariant, selection: Selection) =>
  variant.selectedOptions.every((o) => selection[o.name] === o.value);

export const selectionOf = (variant: ProductVariant): Selection =>
  Object.fromEntries(variant.selectedOptions.map((o) => [o.name, o.value]));

/** The variant to start with: the one named in the link (`?variant=`), else the first in stock, else the first. */
export function initialVariant(variants: ProductVariant[], param?: string | null): ProductVariant | undefined {
  const wanted = param ? variants.find((v) => numericId(v.id) === param || v.id === param) : undefined;
  return wanted ?? variants.find((v) => v.availableForSale) ?? variants[0];
}

/**
 * The selection after the shopper picks `value` for option `name`. When that exact combination
 * exists it is kept (even sold out: the button then says so). When it does not (e.g. a size the new
 * colour is not made in), the closest variant with the picked value takes over: in stock first,
 * then the one sharing the most of the other options.
 */
export function pick(variants: ProductVariant[], selection: Selection, name: string, value: string): Selection {
  const next = { ...selection, [name]: value };
  if (variants.some((v) => matches(v, next))) return next;
  const withValue = variants.filter((v) => v.selectedOptions.some((o) => o.name === name && o.value === value));
  if (!withValue.length) return next;
  const shared = (v: ProductVariant) => v.selectedOptions.filter((o) => next[o.name] === o.value).length;
  const best = [...withValue].sort((a, b) => Number(b.availableForSale) - Number(a.availableForSale) || shared(b) - shared(a))[0];
  return selectionOf(best);
}

/** Whether picking `value` for `name`, with the other options as they are, gives a variant in stock. */
export function isAvailable(variants: ProductVariant[], selection: Selection, name: string, value: string): boolean {
  return variants.some(
    (v) =>
      v.availableForSale &&
      v.selectedOptions.some((o) => o.name === name && o.value === value) &&
      v.selectedOptions.every((o) => o.name === name || selection[o.name] === o.value),
  );
}

/** "gid://shopify/ProductVariant/123" -> "123", the form Shopify uses in links. */
export const numericId = (gid: string) => gid.split("/").pop() ?? gid;

/** A price on sale: the compare-at price only when it is higher than the price. */
export function onSale(price: { amount: string }, compareAt?: { amount: string } | null): boolean {
  return Boolean(compareAt && Number(compareAt.amount) > Number(price.amount));
}

/**
 * The price a list (cards, search) shows for a product: its lowest, "From" when some options cost
 * more (bigger sizes often do), and the "was" price when that lowest price is on sale in Shopify.
 */
export function listPrice(product: Pick<Product, "price" | "variants">): { price: Money; from: boolean; compareAt: Money | null } {
  const { variants } = product;
  if (!variants.length) return { price: product.price, from: false, compareAt: null };
  const cheapest = variants.reduce((low, v) => (Number(v.price.amount) < Number(low.price.amount) ? v : low));
  return {
    price: cheapest.price,
    from: variants.some((v) => Number(v.price.amount) !== Number(cheapest.price.amount)),
    compareAt: onSale(cheapest.price, cheapest.compareAtPrice) ? (cheapest.compareAtPrice ?? null) : null,
  };
}
