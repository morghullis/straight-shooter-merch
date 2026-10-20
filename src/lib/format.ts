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

/** Product handles/ids are interpolated into URLs and cache tags; keep them boring. */
export function isSafeHandle(value: string): boolean {
  return /^[a-z0-9][a-z0-9-]{0,127}$/i.test(value);
}
