/**
 * Tells the server a shopper engaged with a product, for the showroom's ranking (see
 * `lib/popularity.ts`). Fire and forget: it never blocks or breaks the page. A product view
 * counts once per browser session.
 */
export function trackInteraction(handle: string, kind: "view" | "cart"): void {
  if (typeof window === "undefined") return;
  if (kind === "view") {
    const key = `ssm-viewed:${handle}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      // Storage blocked (private mode): count the view anyway.
    }
  }

  const body = JSON.stringify({ handle, kind });
  try {
    if (navigator.sendBeacon?.("/api/track", new Blob([body], { type: "application/json" }))) return;
  } catch {
    // fall through to fetch
  }
  void fetch("/api/track", { method: "POST", body, headers: { "Content-Type": "application/json" }, keepalive: true }).catch(() => {});
}
