import "server-only";

import { createHash } from "node:crypto";

import { getStore, type Store } from "@netlify/blobs";

const TRIES = 6;

function storage(): Store | null {
  try {
    return getStore({ name: "rate-limit", consistency: "strong" });
  } catch {
    return null;
  }
}

/**
 * At most `limit` goes per `windowMs` for `who` (hashed: an address or an email is never stored as it
 * is). Counted in Netlify Blobs with conditional writes, so two requests at once cannot take the same
 * go. In production, when it cannot count, it says no; without a store locally nothing is limited.
 */
export async function allow(name: string, who: string, limit: number, windowMs: number): Promise<boolean> {
  const store = storage();
  if (!store) return process.env.NODE_ENV !== "production";
  const window = Math.floor(Date.now() / windowMs);
  const key = `${name}/${createHash("sha256").update(`${name}:${window}:${who}`).digest("hex").slice(0, 32)}`;
  try {
    for (let i = 0; i < TRIES; i++) {
      const now = await store.getWithMetadata(key);
      const used = Number(now?.data ?? 0);
      if (used >= limit) return false;
      const { modified } = await store.set(key, String(used + 1), now?.etag ? { onlyIfMatch: now.etag } : { onlyIfNew: true });
      if (modified) return true;
      await new Promise((r) => setTimeout(r, 20 + Math.random() * 80));
    }
  } catch (error) {
    console.error(`[rate-limit] ${error instanceof Error ? error.message : error}`);
  }
  return false;
}
