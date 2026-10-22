import { connection, NextResponse, type NextRequest } from "next/server";

import { accountsConnected, hostedAccountUrl, loginCookie, loginRedirect } from "@/lib/customer-account";

/** "Sign in" and "Create account": off to Shopify's sign-in page (it creates the account if new). */
export async function GET(request: NextRequest) {
  // Every sign-in gets its own state and PKCE codes: never a prerendered response.
  await connection();
  if (!accountsConnected) return NextResponse.redirect(hostedAccountUrl ?? new URL("/account", request.url));
  const { url, login } = await loginRedirect(request.nextUrl.origin);
  const res = NextResponse.redirect(url);
  res.cookies.set(loginCookie.name, JSON.stringify(login), loginCookie.options);
  return res;
}
