import "server-only";

import { getStore, type Store } from "@netlify/blobs";

/**
 * How much shoppers engage with each product: views of its page and adds to the cart, counted per
 * day in Netlify Blobs (one small JSON document per product, so a busy product never blocks another).
 * The showroom ranks products by these counts over the last month.
 *
 * Outside Netlify (local `next dev`) there is no store: interactions are not recorded and the
 * ranking falls back to Shopify's own order (best selling).
 */

export type Interaction = "view" | "cart";

const WEIGHT: Record<Interaction, number> = { view: 1, cart: 4 };
const WINDOW_DAYS = 30;
const KEEP_DAYS = 60;

type Counts = Partial<Record<Interaction, number>>;
interface ProductStats {
  days: Record<string, Counts>;
}

function store(): Store | null {
  try {
    return getStore({ name: "product-popularity", consistency: "strong" });
  } catch {
    return null;
  }
}

const day = (offset = 0) => new Date(Date.now() - offset * 86_400_000).toISOString().slice(0, 10);

/** Returns false when the interaction could not be stored (no store in this environment). */
export async function recordInteraction(handle: string, kind: Interaction): Promise<boolean> {
  const s = store();
  if (!s) return false;
  try {
    const stats = ((await s.get(handle, { type: "json" })) as ProductStats | null) ?? { days: {} };
    const today = day();
    const counts = (stats.days[today] ??= {});
    counts[kind] = (counts[kind] ?? 0) + 1;
    const oldest = day(KEEP_DAYS);
    for (const d of Object.keys(stats.days)) if (d < oldest) delete stats.days[d];
    await s.setJSON(handle, stats);
    return true;
  } catch {
    return false;
  }
}

/** Weighted interactions per product handle over the last month. Empty when there is no store. */
export async function getPopularity(): Promise<Map<string, number>> {
  const scores = new Map<string, number>();
  const s = store();
  if (!s) return scores;
  try {
    const { blobs } = await s.list();
    const since = day(WINDOW_DAYS);
    await Promise.all(
      blobs.map(async ({ key }) => {
        const stats = (await s.get(key, { type: "json" })) as ProductStats | null;
        let score = 0;
        for (const [d, counts] of Object.entries(stats?.days ?? {})) {
          if (d < since) continue;
          for (const [kind, n] of Object.entries(counts) as [Interaction, number][]) score += (WEIGHT[kind] ?? 0) * n;
        }
        if (score > 0) scores.set(key, score);
      }),
    );
  } catch {
    // No store in this environment, or it is unreachable: fall back to Shopify's order.
  }
  return scores;
}
