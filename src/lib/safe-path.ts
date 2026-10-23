/**
 * A same-site path to return to (never another site). The value is resolved the way a browser would
 * (which drops tabs and newlines and reads `\` as `/`, so "/\t/evil.com" means "//evil.com") and kept
 * only if it stays on this site; only its path, query and hash are returned.
 */
export function safeReturnPath(value: string | null | undefined, fallback = "/account"): string {
  if (!value || /[\t\n\r\\]/.test(value)) return fallback;
  const base = "https://this-site.invalid";
  try {
    const url = new URL(value, base);
    if (url.origin !== base) return fallback;
    const path = url.pathname + url.search + url.hash;
    // Dot segments can leave a path like "//evil.com" ("/.//evil.com"), which a redirect would read
    // as another site: the result itself must start with a single "/" and still resolve here.
    if (!path.startsWith("/") || path.startsWith("//") || new URL(path, base).origin !== base) return fallback;
    return path;
  } catch {
    return fallback;
  }
}
