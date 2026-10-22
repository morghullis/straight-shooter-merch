import { NextResponse, type NextRequest } from "next/server";

import { logoutUrl, parseSession, sessionCookie } from "@/lib/customer-account";

/** "Sign out" (a form post, so a link elsewhere cannot sign anyone out): ends the Shopify session too. */
export async function POST(request: NextRequest) {
  const session = parseSession(request.cookies.get(sessionCookie.name)?.value);
  const target = await logoutUrl(session, `${request.nextUrl.origin}/account`).catch(() => "/account");
  const res = NextResponse.redirect(new URL(target, request.url), 303);
  res.cookies.delete({ name: sessionCookie.name, path: sessionCookie.options.path });
  return res;
}
