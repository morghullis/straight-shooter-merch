// Health check of a deployed site (production by default), with Node 20+ and nothing installed:
//
//   node scripts/check-site.mjs [https://site]
//
// It checks what broke or could have broken before (see docs/INCIDENTS.md): pages answer, every
// optimised image is a real and distinct picture (one image everywhere = broken image route), the
// Shopify webhook has its secret, sign-in redirects only to Shopify, and the return path after
// signing in never leads to another site. Exits 1 on any failure.
import { createHash } from "node:crypto";

const target = process.argv[2] || process.env.SITE_URL || "https://straight-shooter-merch.netlify.app";
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

async function get(path, init = {}) {
  return fetch(new URL(path, origin), { redirect: "manual", headers: UA, ...init, signal: AbortSignal.timeout(30_000) });
}

async function page(path) {
  const res = await get(path, { redirect: "follow" });
  const html = await res.text();
  if (res.status === 200 && /<title>/.test(html)) ok(`${path} -> 200`);
  else fail(`${path} -> ${res.status}`);
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
    const expected = `https://${siteName(site.hostname)}/account/authorize`;
    if (redirect && redirect !== expected) fail(`sign-in callback is ${redirect}, Shopify expects ${expected}`);
    else ok(`sign-in goes to Shopify (${to.hostname}${to.pathname.includes("oauth") ? ", OAuth" : ", hosted account"})`);
  } else fail(`/account/login -> ${login.status} ${login.headers.get("location")}`);

  for (const trick of ["//example.com", "/\t/example.com", "/.//example.com", "/..//example.com", "https://example.com"]) await staysOnSite(trick);
} catch (err) {
  fail(`check crashed: ${err.message}`);
}

console.log(failures.length ? `\n${failures.length} problem(s) on ${origin}` : `\nall good on ${origin}`);
process.exit(failures.length ? 1 : 0);
