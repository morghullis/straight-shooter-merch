import { NextResponse, type NextRequest } from "next/server";

import { parseSession, refreshSession, safeReturnPath, sessionCookie } from "@/lib/customer-account";

/** A new access token from the refresh token, then back where the shopper was; signed out if refused. */
export async function GET(request: NextRequest) {
  const to = safeReturnPath(request.nextUrl.searchParams.get("to"));
  const session = parseSession(request.cookies.get(sessionCookie.name)?.value);
  const fresh = session ? await refreshSession(request.nextUrl.origin, session).catch(() => null) : null;

  // Belt and braces: whatever the path, the redirect never leaves this site.
  const target = new URL(to, request.nextUrl.origin);
  const res = NextResponse.redirect(target.origin === request.nextUrl.origin ? target : new URL("/account", request.nextUrl.origin));
  if (fresh) res.cookies.set(sessionCookie.name, JSON.stringify(fresh), sessionCookie.options);
  else res.cookies.delete({ name: sessionCookie.name, path: sessionCookie.options.path });
  return res;
}
