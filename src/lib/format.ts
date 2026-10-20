const formatters = new Map<string, Intl.NumberFormat>();

/** "70.00" + "USD" -> "$70.00" */
export function formatMoney(amount: string | number, currency = "USD"): string {
  let f = formatters.get(currency);
  if (!f) {
    f = new Intl.NumberFormat("en-US", { style: "currency", currency });
    formatters.set(currency, f);
  }
  return f.format(Number(amount));
}

/**
 * Product and collection handles are interpolated into URLs and cache tags; keep them boring.
 * Lowercase only, as Shopify generates them, so one product can never have two cache keys.
 */
export function isSafeHandle(value: string): boolean {
  return /^[a-z0-9][a-z0-9-]{0,127}$/.test(value);
}

/**
 * Search terms are normalised before they reach the cache or Shopify (lowercase, letters, digits,
 * spaces, short), so trivial variations of one query share a single cache entry.
 */
export function normalizeQuery(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9 '-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
}
