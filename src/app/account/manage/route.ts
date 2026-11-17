import { connection, NextResponse } from "next/server";

import { localRedirect, shopAccountUrl } from "@/lib/customer-account";

/**
 * "Manage account" (and sign-in when the site's own sign-in is not connected): Shopify's account
 * pages, reached through the store's primary domain. The page links here, so no Shopify address
 * ever appears in the site's HTML.
 */
export async function GET() {
  // Asks Shopify for the current primary domain: never a redirect frozen at build time.
  await connection();
  const url = await shopAccountUrl();
  return url ? NextResponse.redirect(url) : localRedirect("/account");
}
