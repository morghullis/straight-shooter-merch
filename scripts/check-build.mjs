// After `next build`: routes that must run on every request were not prerendered. A prerendered
// sign-in route would hand every shopper the same state and PKCE codes (see docs/INCIDENTS.md).
import { readFileSync } from "node:fs";

const manifest = JSON.parse(readFileSync(new URL("../.next/prerender-manifest.json", import.meta.url), "utf8"));
const prerendered = Object.keys(manifest.routes ?? {});
const mustBeDynamic = ["/account/login", "/account/authorize", "/account/refresh", "/account/logout", "/api/revalidate", "/api/track"];
const wrong = mustBeDynamic.filter((route) => prerendered.includes(route));

if (wrong.length) {
  console.error(`These routes were prerendered but must run per request: ${wrong.join(", ")}`);
  process.exit(1);
}
console.log(`ok: ${mustBeDynamic.length} per-request routes are not prerendered (${prerendered.length} prerendered routes checked)`);
