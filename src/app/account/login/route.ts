import { connection, NextResponse, type NextRequest } from "next/server";

import { ACCOUNT_PATHS, accountsConnected, localRedirect, loginCookie, loginRedirect, publicOrigin } from "@/lib/customer-account";

/** "Sign in" and "Create account": off to Shopify's sign-in page (it creates the account if new). */
export async function GET(request: NextRequest) {
  // Every sign-in gets its own state and PKCE codes: never a prerendered response.
  await connection();
  // Without the site's own sign-in, Shopify's account pages handle it.
  if (!accountsConnected) return localRedirect(ACCOUNT_PATHS.manage);
  const { url, login } = await loginRedirect(publicOrigin(request.nextUrl.origin));
  const res = NextResponse.redirect(url);
  res.cookies.set(loginCookie.name, JSON.stringify(login), loginCookie.options);
  return res;
}
