import { NextResponse, type NextRequest } from "next/server";

import { finishLogin, loginCookie, parseLogin, sessionCookie } from "@/lib/customer-account";

/** Shopify sends the shopper back here after signing in: trade the code for their tokens. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const login = parseLogin(request.cookies.get(loginCookie.name)?.value);
  const code = searchParams.get("code");
  const failed = (reason: string) => {
    const res = NextResponse.redirect(new URL(`/account?signin=${reason}`, request.url));
    res.cookies.delete({ name: loginCookie.name, path: loginCookie.options.path });
    return res;
  };

  if (searchParams.get("error")) return failed("cancelled");
  if (!login || !code || searchParams.get("state") !== login.state) return failed("expired");

  const session = await finishLogin(origin, code, login).catch(() => null);
  if (!session) return failed("failed");

  const res = NextResponse.redirect(new URL("/account", request.url));
  res.cookies.delete({ name: loginCookie.name, path: loginCookie.options.path });
  res.cookies.set(sessionCookie.name, JSON.stringify(session), sessionCookie.options);
  return res;
}
