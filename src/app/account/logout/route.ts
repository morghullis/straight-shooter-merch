import { NextResponse, type NextRequest } from "next/server";

import { localRedirect, logoutUrl, parseSession, publicOrigin, sessionCookie } from "@/lib/customer-account";

/** "Sign out" (a form post, so a link elsewhere cannot sign anyone out): ends the Shopify session too. */
export async function POST(request: NextRequest) {
  const session = parseSession(request.cookies.get(sessionCookie.name)?.value);
  const target = await logoutUrl(session, `${publicOrigin(request.nextUrl.origin)}/account`).catch(() => null);
  // Shopify's sign-out page (absolute), or straight back to the account page (relative).
  const res = target && /^https:\/\//.test(target) ? NextResponse.redirect(target, 303) : localRedirect("/account", 303);
  res.cookies.delete({ name: sessionCookie.name, path: sessionCookie.options.path });
  return res;
}
