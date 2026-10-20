import { createHmac, timingSafeEqual } from "node:crypto";

import { revalidateTag } from "next/cache";

import { isSafeHandle } from "@/lib/format";

/**
 * Shopify webhook receiver. Point these topics at `https://<your-domain>/api/revalidate`:
 * products/create, products/update, products/delete, collections/create,
 * collections/update, collections/delete, inventory_levels/update.
 *
 * Every request is verified against `x-shopify-hmac-sha256` using
 * SHOPIFY_WEBHOOK_SECRET (Shopify admin > Settings > Notifications > Webhooks).
 */
export async function POST(request: Request) {
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET;
  if (!secret) {
    return Response.json({ error: "Webhook secret is not configured" }, { status: 501 });
  }

  const body = await request.text();
  const given = Buffer.from(request.headers.get("x-shopify-hmac-sha256") ?? "", "base64");
  const expected = createHmac("sha256", secret).update(body, "utf8").digest();

  // Constant-time comparison; lengths must match first or timingSafeEqual throws.
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return Response.json({ error: "Invalid signature" }, { status: 401 });
  }

  const topic = request.headers.get("x-shopify-topic") ?? "";
  const tags = new Set<string>();

  if (topic.startsWith("products/") || topic.startsWith("inventory_levels/")) {
    tags.add("products");
    try {
      const handle = (JSON.parse(body) as { handle?: unknown }).handle;
      if (typeof handle === "string" && isSafeHandle(handle)) tags.add(`product:${handle}`);
    } catch {
      /* body was not JSON: the broad tag is enough */
    }
  } else if (topic.startsWith("collections/")) {
    tags.add("collections");
    tags.add("products");
  } else {
    return Response.json({ revalidated: false, reason: `Ignored topic "${topic}"` }, { status: 202 });
  }

  // "max" = stale-while-revalidate: visitors keep getting the cached page while it refreshes.
  for (const tag of tags) revalidateTag(tag, "max");
  return Response.json({ revalidated: true, tags: [...tags] });
}
