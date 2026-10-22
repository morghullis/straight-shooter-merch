import { createHmac, timingSafeEqual } from "node:crypto";

import { revalidateTag } from "next/cache";
import { after } from "next/server";

import { isSafeHandle } from "@/lib/format";

/**
 * Shopify webhook receiver. Point these topics at `https://<your-domain>/api/revalidate`:
 * products/create, products/update, products/delete, collections/create,
 * collections/update, collections/delete, inventory_levels/update
 * (tools/pipeline/register-webhooks.mjs does it).
 *
 * Every request is verified against `x-shopify-hmac-sha256` using SHOPIFY_WEBHOOK_SECRET (for
 * webhooks registered by the app, the app's client secret).
 *
 * A new product also starts its asset pipeline right away (the GitHub Action in
 * .github/workflows/product-assets.yml) when GITHUB_DISPATCH_TOKEN and GITHUB_DISPATCH_REPO are set;
 * otherwise the Action's half-hourly run picks it up.
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
  let handle: string | null = null;
  try {
    const value = (JSON.parse(body) as { handle?: unknown }).handle;
    if (typeof value === "string" && isSafeHandle(value)) handle = value;
  } catch {
    /* body was not JSON: the broad tags are enough */
  }

  if (topic.startsWith("products/") || topic.startsWith("inventory_levels/")) {
    tags.add("products");
    if (handle) tags.add(`product:${handle}`);
  } else if (topic.startsWith("collections/")) {
    tags.add("collections");
    tags.add("products");
  } else {
    return Response.json({ revalidated: false, reason: `Ignored topic "${topic}"` }, { status: 202 });
  }

  // "max" = stale-while-revalidate: visitors keep getting the cached page while it refreshes.
  for (const tag of tags) revalidateTag(tag, "max");
  if (topic === "products/create" && handle) {
    const product = handle;
    after(() => startAssetPipeline(product));
  }
  return Response.json({ revalidated: true, tags: [...tags] });
}

/** Asks GitHub to run the product-assets workflow for one product now. */
async function startAssetPipeline(handle: string) {
  const token = process.env.GITHUB_DISPATCH_TOKEN;
  const repo = process.env.GITHUB_DISPATCH_REPO;
  if (!token || !repo || !/^[\w.-]+\/[\w.-]+$/.test(repo)) return;
  try {
    await fetch(`https://api.github.com/repos/${repo}/dispatches`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify({ event_type: "shopify-product-created", client_payload: { product: handle } }),
    });
  } catch {
    // The half-hourly run will pick the product up.
  }
}
