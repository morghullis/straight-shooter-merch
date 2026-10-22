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

/** "The Stephen A. Smith Show" -> ["The Stephen", "A. Smith Show"]: at most two rows, as even as a word break allows. */
export function balancedRows(text: string): string[] {
  const words = text.trim().split(/\s+/);
  if (words.length < 2) return [text.trim()];
  let best: string[] = [];
  let longest = Infinity;
  for (let i = 1; i < words.length; i++) {
    const rows = [words.slice(0, i).join(" "), words.slice(i).join(" ")];
    const width = Math.max(...rows.map((r) => r.length));
    if (width < longest) [best, longest] = [rows, width];
  }
  return best;
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
