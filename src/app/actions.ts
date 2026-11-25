"use server";

import { getDiscounts } from "@/lib/catalog";
import { quoteOf, type CartQuote } from "@/lib/catalog/discounts";
import { createShopifyCart, fetchVariants, isShopifyConfigured, priceCart } from "@/lib/catalog/shopify";
import { isFresh, readSession } from "@/lib/customer-account";

export type CheckoutResult = { url: string } | { error: string; removed?: string[] };

/** A cart line as the store has it right now. */
export interface LiveLine {
  variantId: string;
  handle: string;
  title: string;
  variantTitle: string;
  /** What one unit costs, with its automatic discount. */
  price: number;
  /** The price without that discount, and the discount's name; null when it has none. */
  regular: number | null;
  discount: string | null;
  currency: string;
  image: string;
  imageAlt: string;
}

/** The cart as the store has it: its lines, and (when asked for) Shopify's own total with every discount. */
export interface LiveCart {
  lines: LiveLine[];
  quote: CartQuote | null;
}

const VARIANT_GID = /^gid:\/\/shopify\/ProductVariant\/\d+$/;
const MAX_LINES = 50;

/** The lines as Shopify takes them, or null when one is not valid (they come from the browser). */
function cleanLines(lines: unknown): { merchandiseId: string; quantity: number }[] | null {
  if (!Array.isArray(lines) || lines.length === 0 || lines.length > MAX_LINES) return null;
  const valid = lines.every(
    (line) =>
      line &&
      typeof line.variantId === "string" &&
      VARIANT_GID.test(line.variantId) &&
      Number.isInteger(line.quantity) &&
      line.quantity >= 1 &&
      line.quantity <= 99,
  );
  return valid ? lines.map((line) => ({ merchandiseId: line.variantId, quantity: line.quantity })) : null;
}

/**
 * The cart lives in the browser, so it can hold items the store no longer has (deleted, or from the
 * demo catalog) and old prices. This returns the lines that still exist, with their current title,
 * price (its discount included) and picture; the browser drops the others. `withQuote` also has Shopify
 * total the cart, discounts on quantity or on the whole order included. Null = nothing to change (demo
 * mode, or the store could not be reached).
 */
export async function refreshCart(lines: { variantId: string; quantity: number }[], withQuote = false): Promise<LiveCart | null> {
  const clean = cleanLines(lines);
  if (!isShopifyConfigured || !clean) return null;
  try {
    const [live, discounts, quote] = await Promise.all([
      fetchVariants(clean.map((l) => l.merchandiseId)),
      getDiscounts(),
      withQuote ? quoteCart(clean) : null,
    ]);
    return {
      quote,
      lines: [...live.values()].map((v) => {
        const found = discounts[v.id];
        const discount = found && Number(found.price.amount) < Number(v.price.amount) ? found : null;
        return {
          variantId: v.id,
          handle: v.handle,
          title: v.productTitle,
          variantTitle: v.title,
          price: Number((discount?.price ?? v.price).amount),
          regular: discount ? Number(v.price.amount) : null,
          discount: discount?.title || null,
          currency: v.price.currencyCode,
          image: v.image?.url ?? "",
          imageAlt: v.image?.altText || v.productTitle,
        };
      }),
    };
  } catch {
    return null;
  }
}

/** Shopify's total of these lines; null when it cannot price all of them. */
async function quoteCart(lines: { merchandiseId: string; quantity: number }[]): Promise<CartQuote | null> {
  const priced = await priceCart(lines).catch(() => null);
  return priced && lines.every((l) => priced.some((p) => p.variantId === l.merchandiseId)) ? quoteOf(priced) : null;
}

/**
 * Turns the client-side cart into a Shopify cart and returns the hosted
 * checkout URL. Inputs come from the browser, so they are validated here, and every line is
 * checked against the store first: an item it no longer sells is reported (and removed by the
 * browser) instead of failing the whole checkout.
 */
export async function createCheckout(
  lines: { variantId: string; quantity: number }[],
): Promise<CheckoutResult> {
  if (!Array.isArray(lines) || lines.length === 0) return { error: "Your cart is empty." };

  const clean = cleanLines(lines);
  if (!clean) return { error: "Something in your cart is invalid. Please refresh and try again." };

  if (!isShopifyConfigured) {
    return {
      error:
        "Checkout is in demo mode. Add your Shopify credentials to .env.local to enable it (see README).",
    };
  }

  try {
    const live = await fetchVariants(clean.map((l) => l.merchandiseId));
    const removed = clean.filter((l) => !live.get(l.merchandiseId)?.availableForSale).map((l) => l.merchandiseId);
    if (removed.length) {
      return {
        error: removed.length === clean.length
          ? "These items are no longer available, so we took them out of your cart."
          : "Some items are no longer available, so we took them out of your cart. Check it and try again.",
        removed,
      };
    }
    // A signed-in shopper reaches checkout signed in.
    const session = await readSession();
    return { url: await createShopifyCart(clean, session && isFresh(session) ? session.accessToken : null) };
  } catch {
    return { error: "We couldn't start checkout. Please try again in a moment." };
  }
}
