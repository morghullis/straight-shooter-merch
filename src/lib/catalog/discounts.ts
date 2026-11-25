import type { Money, Product } from "./types";
import { onSale } from "./variants";

/**
 * Shopify's automatic discounts (admin > Discounts) are not part of a product's price: Shopify only
 * works them out in a cart. The store asks a Shopify cart what each variant would cost
 * (`fetchDiscounts` in shopify.ts) and puts the answer on the catalog here, so every price on the site
 * is the one the shopper pays. Nothing is calculated from the discount's own rules. Pure functions,
 * tested in tests/discounts.test.ts.
 */

/** A discount on a cart line: its name in Shopify and how much it takes off the line. */
export interface LineDiscount {
  title: string;
  amount: number;
  /** Taken off every unit (a product discount), not a one-off amount shared by the whole cart. */
  each: boolean;
  /** On the line itself, not on the whole order. */
  lineLevel: boolean;
}

/** A line of a Shopify cart, as Shopify priced it. */
export interface PricedLine {
  variantId: string;
  quantity: number;
  /** Before any discount. */
  subtotal: number;
  currencyCode: string;
  discounts: LineDiscount[];
}

/** What one unit of a variant costs with its discount. */
export interface VariantDiscount {
  price: Money;
  title: string;
  /** The discount's sticker (made by the asset pipeline), without text. */
  sticker?: string | null;
}

/** By variant id: only the variants that have a discount. */
export type Discounts = Record<string, VariantDiscount>;

const cents = (n: number) => Math.round(n * 100) / 100;

/** The line's price per unit with its product discounts, or null when nothing comes off every unit. */
export function unitDiscount(line: PricedLine): VariantDiscount | null {
  const discounts = line.discounts.filter((d) => d.lineLevel && d.each && d.amount > 0);
  if (!discounts.length || line.quantity < 1) return null;
  const off = discounts.reduce((n, d) => n + d.amount, 0);
  const unit = cents(Math.max(0, line.subtotal - off) / line.quantity);
  return {
    price: { amount: unit.toFixed(2), currencyCode: line.currencyCode },
    title: [...new Set(discounts.map((d) => d.title).filter(Boolean))].join(" + "),
  };
}

/**
 * The lines worth buying alone to be sure of their discount. Each product is priced in one cart with
 * all its variants, which can reach a discount a single unit does not ("buy 3", "over $50"). Variants
 * of a product with the same price and the same discount behave the same, so one of each stands for
 * the rest.
 */
export function toConfirm(lines: PricedLine[]): { variantId: string; sameAs: string[] }[] {
  const groups = new Map<string, string[]>();
  for (const line of lines) {
    const found = unitDiscount(line);
    if (!found) continue;
    const key = `${line.subtotal / line.quantity}|${found.price.amount}|${found.title}`;
    groups.set(key, [...(groups.get(key) ?? []), line.variantId]);
  }
  return [...groups.values()].map((ids) => ({ variantId: ids[0], sameAs: ids }));
}

/** The product with its discounts in: each discounted variant costs less, its usual price becomes the "was" price. */
export function withDiscounts(product: Product, discounts: Discounts): Product {
  let changed = false;
  const variants = product.variants.map((v) => {
    const discount = discounts[v.id];
    if (!discount || Number(discount.price.amount) >= Number(v.price.amount)) return v;
    changed = true;
    return {
      ...v,
      price: discount.price,
      compareAtPrice: onSale(v.price, v.compareAtPrice) ? v.compareAtPrice : v.price,
      discount: { title: discount.title, regular: v.price, sticker: discount.sticker ?? null },
    };
  });
  if (!changed) return product;
  const cheapest = variants.reduce((low, v) => (Number(v.price.amount) < Number(low.price.amount) ? v : low));
  return { ...product, variants, price: cheapest.price };
}

/** 31.50 instead of 34.99 -> 10 (a whole percentage, as it reads on a label). */
export function percentOff(price: { amount: string }, was: { amount: string }): number {
  const full = Number(was.amount);
  return full > 0 ? Math.max(0, Math.round((1 - Number(price.amount) / full) * 100)) : 0;
}

/** The product's sale label: how much comes off, "up to" when some variants have less (or nothing) off. */
export function saleOf(product: Pick<Product, "variants">): { percent: number; upTo: boolean; sticker: string | null } | null {
  const percents = product.variants.map((v) => (v.compareAtPrice && onSale(v.price, v.compareAtPrice) ? percentOff(v.price, v.compareAtPrice) : 0));
  const percent = Math.max(0, ...percents);
  if (percent < 1) return null;
  const sticker = product.variants[percents.indexOf(percent)].discount?.sticker ?? null;
  return { percent, upTo: percents.some((p) => p !== percent), sticker };
}

/** A cart's amounts, for the cart drawer. */
export interface CartQuote {
  /** By variant id: the line before and after its own discounts, and their names. */
  lines: Record<string, { subtotal: number; total: number; discounts: string[] }>;
  subtotal: number;
  total: number;
  /** Everything taken off the cart, by name. */
  discounts: { title: string; amount: number }[];
  currency: string;
}

/** A cart as Shopify priced it. */
export function quoteOf(priced: PricedLine[]): CartQuote {
  const lines: CartQuote["lines"] = {};
  const byTitle = new Map<string, number>();
  let subtotal = 0;
  let off = 0;
  for (const line of priced) {
    const own = line.discounts.filter((d) => d.lineLevel);
    const ownOff = own.reduce((n, d) => n + d.amount, 0);
    const known = lines[line.variantId];
    // Shopify can split a line (part of the units discounted): the drawer shows it as one.
    lines[line.variantId] = {
      subtotal: cents((known?.subtotal ?? 0) + line.subtotal),
      total: cents((known?.total ?? 0) + line.subtotal - ownOff),
      discounts: [...new Set([...(known?.discounts ?? []), ...own.map((d) => d.title).filter(Boolean)])],
    };
    subtotal += line.subtotal;
    for (const d of line.discounts) {
      off += d.amount;
      byTitle.set(d.title, (byTitle.get(d.title) ?? 0) + d.amount);
    }
  }
  return {
    lines,
    subtotal: cents(subtotal),
    total: cents(Math.max(0, subtotal - off)),
    discounts: [...byTitle].filter(([, amount]) => amount > 0).map(([title, amount]) => ({ title, amount: cents(amount) })),
    currency: priced[0]?.currencyCode ?? "USD",
  };
}

/** What a cart line needs for its amounts to be known before Shopify answers. */
export interface LocalLine {
  variantId: string;
  quantity: number;
  /** Per unit, with its discount. */
  price: number;
  /** Per unit without the discount, when it has one. */
  regular?: number | null;
  discount?: string | null;
  currency: string;
}

/** The cart from the catalog's own prices: what the drawer shows until Shopify's quote arrives. */
export function estimateOf(lines: LocalLine[]): CartQuote {
  return quoteOf(
    lines.map((l) => {
      const regular = l.regular && l.regular > l.price ? l.regular : l.price;
      const amount = cents((regular - l.price) * l.quantity);
      return {
        variantId: l.variantId,
        quantity: l.quantity,
        subtotal: cents(regular * l.quantity),
        currencyCode: l.currency,
        discounts: amount > 0 ? [{ title: l.discount ?? "", amount, each: true, lineLevel: true }] : [],
      };
    }),
  );
}
