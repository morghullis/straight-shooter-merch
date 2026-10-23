import type { NextRequest } from "next/server";

import { localRedirect, parseSession, publicOrigin, refreshSession, safeReturnPath, sessionCookie } from "@/lib/customer-account";

/** A new access token from the refresh token, then back where the shopper was; signed out if refused. */
export async function GET(request: NextRequest) {
  const to = safeReturnPath(request.nextUrl.searchParams.get("to"));
  const session = parseSession(request.cookies.get(sessionCookie.name)?.value);
  const fresh = session ? await refreshSession(publicOrigin(request.nextUrl.origin), session).catch(() => null) : null;

  // A relative, re-checked path: the redirect never leaves this site.
  const res = localRedirect(to);
  if (fresh) res.cookies.set(sessionCookie.name, JSON.stringify(fresh), sessionCookie.options);
  else res.cookies.delete({ name: sessionCookie.name, path: sessionCookie.options.path });
  return res;
}
