import "server-only";

import { createHash, randomBytes } from "node:crypto";

import { cacheLife } from "next/cache";
import { cookies } from "next/headers";

/**
 * Shopify customer accounts on this site, through the Customer Account API (OAuth 2.0 + PKCE).
 * A shopper signs in or creates an account on Shopify's own page (an emailed code, no password),
 * comes back here signed in, sees their orders on the account page, and checkout knows who they are
 * (so the store's abandoned-checkout reminders reach them).
 *
 * Needs SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_ID (Shopify admin > Sales channels > Headless > Customer
 * Account API settings), plus SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_SECRET for a confidential client.
 * Without the client ID the account buttons open Shopify's hosted account pages instead.
 *
 * The tokens live in an httpOnly cookie: only the server reads them.
 */

const domain = (process.env.SHOPIFY_STORE_DOMAIN ?? "").replace(/^https?:\/\//, "").replace(/\/+$/, "");
const clientId = process.env.SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_ID ?? "";
const clientSecret = process.env.SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_SECRET ?? "";

/** Sign in happens on this site (true) or on Shopify's hosted account pages (false). */
export const accountsConnected = Boolean(domain && clientId);
/** Shopify's hosted account pages (sign in, create an account, orders), or null in demo mode. */
export const hostedAccountUrl = domain ? `https://${domain}/account` : null;

export const ACCOUNT_PATHS = { login: "/account/login", callback: "/account/authorize", refresh: "/account/refresh", logout: "/account/logout" };

const SESSION_COOKIE = "ss_customer";
const LOGIN_COOKIE = "ss_customer_login";
const SCOPE = "openid email customer-account-api:full";
const secure = process.env.NODE_ENV === "production";

export const sessionCookie = { name: SESSION_COOKIE, options: { httpOnly: true, secure, sameSite: "lax" as const, path: "/", maxAge: 60 * 60 * 24 * 30 } };
export const loginCookie = { name: LOGIN_COOKIE, options: { httpOnly: true, secure, sameSite: "lax" as const, path: "/account", maxAge: 60 * 10 } };

interface Endpoints {
  authorize: string;
  token: string;
  logout: string;
  graphql: string;
}

/** The store's OAuth and API endpoints, from its discovery documents (they rarely change). */
async function endpoints(): Promise<Endpoints> {
  "use cache";
  cacheLife("days");
  const get = async (path: string) => {
    const res = await fetch(`https://${domain}/.well-known/${path}`);
    if (!res.ok) throw new Error(`Customer accounts discovery failed (${res.status})`);
    return (await res.json()) as Record<string, string>;
  };
  const [oidc, api] = await Promise.all([get("openid-configuration"), get("customer-account-api")]);
  return { authorize: oidc.authorization_endpoint, token: oidc.token_endpoint, logout: oidc.end_session_endpoint, graphql: api.graphql_api };
}

const base64url = (buf: Buffer) => buf.toString("base64url");

export interface LoginState {
  verifier: string;
  state: string;
  nonce: string;
}

/** Where to send the shopper to sign in, and what to remember until they come back. */
export async function loginRedirect(origin: string): Promise<{ url: URL; login: LoginState }> {
  const login = { verifier: base64url(randomBytes(32)), state: base64url(randomBytes(16)), nonce: base64url(randomBytes(16)) };
  const url = new URL((await endpoints()).authorize);
  url.searchParams.set("scope", SCOPE);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", origin + ACCOUNT_PATHS.callback);
  url.searchParams.set("state", login.state);
  url.searchParams.set("nonce", login.nonce);
  url.searchParams.set("code_challenge", base64url(createHash("sha256").update(login.verifier).digest()));
  url.searchParams.set("code_challenge_method", "S256");
  return { url, login };
}

export interface CustomerSession {
  accessToken: string;
  refreshToken: string | null;
  idToken: string | null;
  /** Epoch milliseconds. */
  expiresAt: number;
}

interface TokenResponse {
  access_token?: string;
  refresh_token?: string;
  id_token?: string;
  expires_in?: number;
  error?: string;
}

async function tokenRequest(origin: string, params: Record<string, string>): Promise<TokenResponse> {
  const headers: Record<string, string> = {
    "Content-Type": "application/x-www-form-urlencoded",
    // Shopify asks for both: the origin must be one of the client's JavaScript origins.
    Origin: origin,
    "User-Agent": "straight-shooter-storefront",
  };
  if (clientSecret) headers.Authorization = `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`;
  const res = await fetch((await endpoints()).token, {
    method: "POST",
    headers,
    body: new URLSearchParams({ client_id: clientId, ...params }),
    cache: "no-store",
  });
  return (await res.json().catch(() => ({ error: `token request failed (${res.status})` }))) as TokenResponse;
}

const toSession = (t: TokenResponse, previous?: CustomerSession): CustomerSession | null =>
  t.access_token
    ? {
        accessToken: t.access_token,
        refreshToken: t.refresh_token ?? previous?.refreshToken ?? null,
        idToken: t.id_token ?? previous?.idToken ?? null,
        expiresAt: Date.now() + (t.expires_in ?? 3600) * 1000,
      }
    : null;

/** The nonce inside the id token (a JWT straight from Shopify's token endpoint over TLS). */
function nonceOf(idToken: string | undefined): string | null {
  try {
    const payload = JSON.parse(Buffer.from(idToken?.split(".")[1] ?? "", "base64url").toString()) as { nonce?: string };
    return payload.nonce ?? null;
  } catch {
    return null;
  }
}

/** Trades the code Shopify sent back for the customer's tokens. Null when anything does not match. */
export async function finishLogin(origin: string, code: string, login: LoginState): Promise<CustomerSession | null> {
  const tokens = await tokenRequest(origin, {
    grant_type: "authorization_code",
    redirect_uri: origin + ACCOUNT_PATHS.callback,
    code,
    code_verifier: login.verifier,
  });
  if (tokens.id_token && nonceOf(tokens.id_token) !== login.nonce) return null;
  return toSession(tokens);
}

export async function refreshSession(origin: string, session: CustomerSession): Promise<CustomerSession | null> {
  if (!session.refreshToken) return null;
  return toSession(await tokenRequest(origin, { grant_type: "refresh_token", refresh_token: session.refreshToken }), session);
}

/** Shopify's sign-out page (it ends the Shopify session too), then back to `returnTo`. */
export async function logoutUrl(session: CustomerSession | null, returnTo: string): Promise<string> {
  if (!session?.idToken) return returnTo;
  const url = new URL((await endpoints()).logout);
  url.searchParams.set("id_token_hint", session.idToken);
  url.searchParams.set("post_logout_redirect_uri", returnTo);
  return url.toString();
}

export function parseSession(raw: string | undefined): CustomerSession | null {
  if (!raw) return null;
  try {
    const s = JSON.parse(raw) as Partial<CustomerSession>;
    return typeof s.accessToken === "string" && typeof s.expiresAt === "number"
      ? { accessToken: s.accessToken, refreshToken: s.refreshToken ?? null, idToken: s.idToken ?? null, expiresAt: s.expiresAt }
      : null;
  } catch {
    return null;
  }
}

export function parseLogin(raw: string | undefined): LoginState | null {
  try {
    const l = JSON.parse(raw ?? "") as Partial<LoginState>;
    return l.verifier && l.state && l.nonce ? { verifier: l.verifier, state: l.state, nonce: l.nonce } : null;
  } catch {
    return null;
  }
}

/** The signed-in shopper's session (request time: read inside a Suspense boundary). */
export async function readSession(): Promise<CustomerSession | null> {
  return parseSession((await cookies()).get(SESSION_COOKIE)?.value);
}

/** A session that is still good for at least a minute. */
export const isFresh = (s: CustomerSession) => s.expiresAt - Date.now() > 60_000;

export interface CustomerOrder {
  id: string;
  name: string;
  processedAt: string;
  financialStatus: string | null;
  fulfillmentStatus: string;
  cancelledAt: string | null;
  totalPrice: { amount: string; currencyCode: string };
  statusPageUrl: string;
}

export interface Customer {
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  orders: CustomerOrder[];
}

const CUSTOMER_QUERY = /* GraphQL */ `
  query Account {
    customer {
      firstName
      lastName
      emailAddress { emailAddress }
      orders(first: 20, sortKey: PROCESSED_AT, reverse: true) {
        nodes { id name processedAt financialStatus fulfillmentStatus cancelledAt totalPrice { amount currencyCode } statusPageUrl }
      }
    }
  }
`;

/** The shopper's name, email and recent orders. Null when the token is no longer accepted. */
export async function fetchCustomer(accessToken: string): Promise<Customer | null> {
  const res = await fetch((await endpoints()).graphql, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: accessToken },
    body: JSON.stringify({ query: CUSTOMER_QUERY }),
    cache: "no-store",
  });
  if (res.status === 401 || res.status === 403) return null;
  if (!res.ok) throw new Error(`Customer Account API ${res.status}`);
  const json = (await res.json()) as {
    data?: { customer?: { firstName: string | null; lastName: string | null; emailAddress?: { emailAddress: string } | null; orders: { nodes: CustomerOrder[] } } };
    errors?: { message: string }[];
  };
  const c = json.data?.customer;
  if (!c) {
    if (json.errors?.length) throw new Error(json.errors.map((e) => e.message).join("; "));
    return null;
  }
  return { firstName: c.firstName, lastName: c.lastName, email: c.emailAddress?.emailAddress ?? null, orders: c.orders.nodes };
}

/**
 * A same-site path to return to (never another site). The value is resolved the way a browser would
 * (which drops tabs and newlines and reads `\` as `/`, so "/\t/evil.com" means "//evil.com") and kept
 * only if it stays on this site; only its path, query and hash are returned.
 */
export function safeReturnPath(value: string | null | undefined, fallback = "/account"): string {
  if (!value || /[\t\n\r\\]/.test(value)) return fallback;
  const base = "https://this-site.invalid";
  try {
    const url = new URL(value, base);
    return url.origin === base ? url.pathname + url.search + url.hash : fallback;
  } catch {
    return fallback;
  }
}
