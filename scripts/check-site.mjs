// Health check of a deployed site (production by default), with Node 20+ and nothing installed:
//
//   node scripts/check-site.mjs [https://site]
//   PUBLIC_SITE_URL=https://straightshootershop.com node scripts/check-site.mjs https://deploy-preview-8--straight-shooter-merch.netlify.app
//
// It checks what broke or could have broken before (see docs/INCIDENTS.md): pages answer, every
// optimised image is a real and distinct picture (one image everywhere = broken image route), no page
// shows the store's .myshopify.com name, the Shopify webhook has its secret, sign-in redirects only to
// Shopify with the site's public callback, Shopify's account pages are reached on the store's own
// domain, and the return path after signing in never leads to another site. Exits 1 on any failure.
//
// PUBLIC_SITE_URL: the address the site was built for (NEXT_PUBLIC_SITE_URL), when checking a deploy
// preview of it: sign-in hands Shopify that address's callback, not the preview's.
// REDIRECT_DOMAINS: addresses that must forward to the site, same path, in one permanent redirect
// (comma-separated, e.g. https://stephenasmithshop.com,https://www.straightshootershop.com).
import { createHash } from "node:crypto";

const target = process.argv[2] || process.env.SITE_URL || "https://straightshootershop.com";
if (!URL.canParse(target) || !/^https?:$/.test(new URL(target).protocol)) {
  console.error(`Not a site address: ${JSON.stringify(target)} (expected something like https://my-site.netlify.app)`);
  process.exit(2);
}
const site = new URL(target);
const origin = site.origin;
const UA = { "User-Agent": "Mozilla/5.0 (site-health-check)" };
const failures = [];
const ok = (msg) => console.log(`ok    ${msg}`);
// Netlify serves one site under several names (<deploy-id>--site, deploy-preview-<n>--site): same site.
const siteName = (host) => (host.includes("--") ? host.slice(host.lastIndexOf("--") + 2) : host);
const sameSite = (url) => url.protocol === site.protocol && siteName(url.hostname) === siteName(site.hostname);
const fail = (msg) => {
  failures.push(msg);
  console.log(`FAIL  ${msg}`);
};
const publicSite = process.env.PUBLIC_SITE_URL ? new URL(process.env.PUBLIC_SITE_URL) : null;
const myshopify = /[a-z0-9-]+\.myshopify\.com/i;
const redirectDomains = (process.env.REDIRECT_DOMAINS ?? "").split(",").map((d) => d.trim()).filter(Boolean);
for (const d of redirectDomains) {
  if (!URL.canParse(d) || !/^https?:$/.test(new URL(d).protocol)) {
    console.error(`Not an address in REDIRECT_DOMAINS: ${JSON.stringify(d)}`);
    process.exit(2);
  }
}
const knownHosts = new Set([site.hostname, ...redirectDomains.map((d) => new URL(d).hostname)]);

async function get(path, init = {}) {
  return fetch(new URL(path, origin), { redirect: "manual", headers: UA, ...init, signal: AbortSignal.timeout(30_000) });
}

async function page(path) {
  const res = await get(path, { redirect: "follow" });
  const html = await res.text();
  if (res.status === 200 && /<title>/.test(html)) ok(`${path} -> 200`);
  else fail(`${path} -> ${res.status}`);
  // Shoppers only see the store's own domains (the .myshopify.com name is for API calls).
  const leak = html.match(myshopify);
  if (leak) fail(`${path} shows the store's Shopify name (${leak[0]})`);
  return html;
}

const decode = (s) => s.replaceAll("&amp;", "&");

async function images(path, html) {
  const srcs = new Map();
  for (const m of html.matchAll(/<img[^>]+src="([^"]+)"/g)) {
    const src = decode(m[1]);
    if (!src.includes("/_next/image")) continue;
    const original = new URL(src, origin).searchParams.get("url");
    if (original && !srcs.has(original)) srcs.set(original, src);
  }
  const seen = new Map();
  let bad = 0;
  for (const [original, src] of [...srcs].slice(0, 25)) {
    const res = await get(src, { redirect: "follow" });
    const body = Buffer.from(await res.arrayBuffer());
    const hash = createHash("md5").update(body).digest("hex");
    if (res.status !== 200 || !(res.headers.get("content-type") ?? "").startsWith("image/")) {
      bad++;
      fail(`${path}: image ${original} -> ${res.status} ${res.headers.get("content-type")}`);
    } else if (seen.has(hash) && seen.get(hash) !== original) {
      bad++;
      fail(`${path}: ${original} came back as the same picture as ${seen.get(hash)}`);
    }
    seen.set(hash, original);
  }
  if (!srcs.size) fail(`${path}: no optimised images found`);
  else if (!bad) ok(`${path}: ${Math.min(srcs.size, 25)} images, all real and distinct`);
}

async function staysOnSite(to) {
  const res = await get(`/account/refresh?to=${encodeURIComponent(to)}`);
  const location = res.headers.get("location") ?? "";
  const target = location ? new URL(location, origin) : null;
  if (res.status >= 300 && res.status < 400 && target && sameSite(target)) ok(`return path ${JSON.stringify(to)} stays on the site`);
  else fail(`return path ${JSON.stringify(to)} -> ${res.status} ${location}`);
}

try {
  const home = await page("/");
  await page("/account");
  await images("/", home);
  const all = await page("/collections/all");
  await images("/collections/all", all);
  const product = all.match(/href="(\/products\/[a-z0-9-]+)"/)?.[1];
  if (product) await page(product);
  else fail("no product link on /collections/all");

  const hook = await get("/api/revalidate", { method: "POST", body: "{}", headers: { ...UA, "x-shopify-topic": "products/update" } });
  if (hook.status === 401) ok("webhook receiver rejects unsigned requests (its secret is set)");
  else fail(`webhook receiver answered ${hook.status} to an unsigned request (501 = secret missing)`);

  const login = await get("/account/login");
  const to = new URL(login.headers.get("location") ?? "/", origin);
  if (login.status >= 300 && login.status < 400 && (to.hostname === "shopify.com" || to.hostname.endsWith(".myshopify.com"))) {
    const redirect = to.searchParams.get("redirect_uri");
    // Strict: Shopify only accepts the registered callback, on the site's public address.
    const expected = publicSite ? new URL("/account/authorize", publicSite).toString() : `https://${siteName(site.hostname)}/account/authorize`;
    if (redirect && redirect !== expected) fail(`sign-in callback is ${redirect}, Shopify expects ${expected}`);
    else ok(`sign-in goes to Shopify (${to.hostname}${to.pathname.includes("oauth") ? ", OAuth" : ", hosted account"})`);
  } else fail(`/account/login -> ${login.status} ${login.headers.get("location")}`);

  const manage = await get("/account/manage");
  const account = URL.canParse(manage.headers.get("location") ?? "") ? new URL(manage.headers.get("location")) : null;
  if (manage.status >= 300 && manage.status < 400 && account?.protocol === "https:" && !myshopify.test(account.hostname)) {
    ok(`Shopify's account pages open on ${account.hostname}`);
  } else fail(`/account/manage -> ${manage.status} ${manage.headers.get("location")} (expected the store's own domain)`);

  for (const from of redirectDomains) {
    // A real path, so a redirect that drops the path (to the home page) is caught too. Permanent
    // redirects only (301/308), at most 3 (http -> https -> the site), ending on the same page.
    const expected = new URL("/collections/all?ref=check", origin).toString();
    let at = new URL("/collections/all?ref=check", from).toString();
    const hops = [];
    while (hops.length < 3 && at !== expected) {
      const res = await fetch(at, { redirect: "manual", headers: UA, signal: AbortSignal.timeout(30_000) });
      const location = res.headers.get("location");
      hops.push(`${res.status}`);
      if (![301, 308].includes(res.status) || !location || !URL.canParse(location, at)) break;
      const next = new URL(location, at);
      // Only ever follow to the addresses named here: a redirect elsewhere is a failure, never fetched.
      if (!/^https?:$/.test(next.protocol) || !knownHosts.has(next.hostname)) {
        at = next.toString();
        hops.push("off-site");
        break;
      }
      at = next.toString();
    }
    if (at === expected) ok(`${new URL(from).origin} forwards to the site (${hops.join(" -> ")})`);
    else fail(`${new URL(from).origin} ended on ${at} (${hops.join(" -> ")}), expected a permanent redirect to ${expected}`);
  }

  for (const trick of ["//example.com", "/\t/example.com", "/.//example.com", "/..//example.com", "https://example.com"]) await staysOnSite(trick);
} catch (err) {
  // "fetch failed" alone says nothing: the cause tells a DNS or TLS problem (e.g. a resolver still
  // giving the domain's old address right after a DNS change) from the site being down.
  const cause = err.cause ? ` (${[err.cause.code, err.cause.message?.split("\n")[0]].filter(Boolean).join(": ")})` : "";
  fail(`check crashed: ${err.message}${cause}`);
}

console.log(failures.length ? `\n${failures.length} problem(s) on ${origin}` : `\nall good on ${origin}`);
process.exit(failures.length ? 1 : 0);
