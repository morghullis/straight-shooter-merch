"use server";

import { createShopifyCart, isShopifyConfigured } from "@/lib/catalog/shopify";

export type CheckoutResult = { url: string } | { error: string };

const VARIANT_GID = /^gid:\/\/shopify\/ProductVariant\/\d+$/;

/**
 * Turns the client-side cart into a Shopify cart and returns the hosted
 * checkout URL. Inputs come from the browser, so they are validated here.
 */
export async function createCheckout(
  lines: { variantId: string; quantity: number }[],
): Promise<CheckoutResult> {
  if (!Array.isArray(lines) || lines.length === 0 || lines.length > 50) {
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
    return { url: await createShopifyCart(clean) };
  } catch {
    return { error: "We couldn't start checkout. Please try again in a moment." };
  }
}
