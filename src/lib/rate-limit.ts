import "server-only";

import { createHash } from "node:crypto";

import { getStore } from "@netlify/blobs";

/**
 * At most `limit` goes per `windowMs` for each visitor (their address, hashed: it is never stored as it
 * is). Kept in Netlify Blobs; where there is no store (local) nothing is limited.
 */
export async function allow(name: string, visitor: string, limit: number, windowMs: number): Promise<boolean> {
  try {
    const store = getStore({ name: "rate-limit", consistency: "strong" });
    const window = Math.floor(Date.now() / windowMs);
    const key = `${name}/${createHash("sha256").update(`${name}:${window}:${visitor}`).digest("hex").slice(0, 32)}`;
    const used = Number((await store.get(key)) ?? 0);
    if (used >= limit) return false;
    await store.set(key, String(used + 1));
    return true;
  } catch {
    return true;
  }
}
