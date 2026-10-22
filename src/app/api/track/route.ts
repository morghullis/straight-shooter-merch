import { after } from "next/server";

import { isKnownProduct } from "@/lib/catalog";
import { recordInteraction, type Interaction } from "@/lib/popularity";

/**
 * Receives { handle, kind } from the storefront (`lib/track.ts`) when a shopper views a product or
 * adds it to the cart, and counts it for the showroom's ranking. Only known products and known
 * kinds are counted; crawlers are ignored. Answers at once and stores after the response.
 */

const KINDS: readonly Interaction[] = ["view", "cart"];
const BOTS = /bot|crawl|spider|slurp|preview|headless|lighthouse|monitor/i;

export async function POST(request: Request) {
  if (BOTS.test(request.headers.get("user-agent") ?? "")) return new Response(null, { status: 204 });
  if (Number(request.headers.get("content-length") ?? 0) > 1024) return new Response(null, { status: 413 });

  let handle: unknown;
  let kind: unknown;
  try {
    ({ handle, kind } = JSON.parse(await request.text()) as { handle?: unknown; kind?: unknown });
  } catch {
    return Response.json({ error: "Invalid body" }, { status: 400 });
  }
  const validKind = KINDS.find((k) => k === kind);
  if (typeof handle !== "string" || !validKind) return Response.json({ error: "Invalid body" }, { status: 400 });
  const product = handle;
  if (!(await isKnownProduct(product))) return Response.json({ error: "Unknown product" }, { status: 404 });

  after(() => recordInteraction(product, validKind));
  return new Response(null, { status: 202 });
}
