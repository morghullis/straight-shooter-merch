"use server";

import { createShopifyCart, fetchVariants, isShopifyConfigured } from "@/lib/catalog/shopify";

export type CheckoutResult = { url: string } | { error: string; removed?: string[] };

/** A cart line as the store has it right now. */
export interface LiveLine {
  variantId: string;
  handle: string;
  title: string;
  variantTitle: string;
  price: number;
  currency: string;
  image: string;
  imageAlt: string;
}

const VARIANT_GID = /^gid:\/\/shopify\/ProductVariant\/\d+$/;
const MAX_LINES = 50;

const validIds = (ids: unknown): ids is string[] =>
  Array.isArray(ids) && ids.length <= MAX_LINES && ids.every((id) => typeof id === "string" && VARIANT_GID.test(id));

/**
 * The cart lives in the browser, so it can hold items the store no longer has (deleted, or from the
 * demo catalog) and old prices. This returns the lines that still exist, with their current title,
 * price and picture; the browser drops the others. Null = nothing to change (demo mode, or the store
 * could not be reached).
 */
export async function refreshCart(variantIds: string[]): Promise<LiveLine[] | null> {
  if (!isShopifyConfigured || !validIds(variantIds) || variantIds.length === 0) return null;
  try {
    const live = await fetchVariants(variantIds);
    return [...live.values()].map((v) => ({
      variantId: v.id,
      handle: v.handle,
      title: v.productTitle,
      variantTitle: v.title,
      price: Number(v.price.amount),
      currency: v.price.currencyCode,
      image: v.image?.url ?? "",
      imageAlt: v.image?.altText || v.productTitle,
    }));
  } catch {
    return null;
  }
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
  if (!Array.isArray(lines) || lines.length === 0 || lines.length > MAX_LINES) {
    return { error: "Your cart is empty." };
  }

  const clean: { merchandiseId: string; quantity: number }[] = [];
  for (const line of lines) {
    if (
      !line ||
      typeof line.variantId !== "string" ||
      !VARIANT_GID.test(line.variantId) ||
      !Number.isInteger(line.quantity) ||
      line.quantity < 1 ||
      line.quantity > 99
    ) {
      return { error: "Something in your cart is invalid. Please refresh and try again." };
    }
    clean.push({ merchandiseId: line.variantId, quantity: line.quantity });
  }

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
    return { url: await createShopifyCart(clean) };
  } catch {
    return { error: "We couldn't start checkout. Please try again in a moment." };
  }
}
