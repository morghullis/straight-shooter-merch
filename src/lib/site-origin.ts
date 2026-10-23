/**
 * The site's public address, for everything Shopify must recognise (the sign-in callback, the
 * JavaScript origin, the address after signing out). Netlify can hand a function the deploy's own
 * address (`<deploy-id>--site.netlify.app`) instead of the one the shopper typed, and Shopify only
 * accepts the registered addresses. So: NEXT_PUBLIC_SITE_URL (set at build time), else Netlify's `URL`
 * (the site's main address), whichever is an https address first; local runs use the request's origin.
 */
export function publicOrigin(
  requestOrigin: string,
  candidates: (string | undefined)[] = [process.env.NEXT_PUBLIC_SITE_URL, process.env.URL],
): string {
  for (const candidate of candidates) {
    if (candidate && URL.canParse(candidate)) {
      const url = new URL(candidate);
      if (url.protocol === "https:") return url.origin;
    }
  }
  return requestOrigin;
}
