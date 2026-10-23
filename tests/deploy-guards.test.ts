// Guards for mistakes that already happened once (see docs/INCIDENTS.md): each check fails the build
// before the same mistake can reach production again.
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { test } from "node:test";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("Netlify Git builds run the Next.js runtime (without it every page was a 404)", () => {
  assert.match(read("netlify.toml"), /\[\[plugins\]\]\s*\n\s*package\s*=\s*"@netlify\/plugin-nextjs"/);
  const pkg = JSON.parse(read("package.json")) as { devDependencies?: Record<string, string> };
  const version = pkg.devDependencies?.["@netlify/plugin-nextjs"];
  assert.ok(version, "@netlify/plugin-nextjs must be a devDependency");
  assert.match(version, /^\d+\.\d+\.\d+$/, "pin the tested runtime version exactly");
});

test("a webhook never names products for the asset pipeline (that would force a paid regeneration)", () => {
  const workflow = read(".github/workflows/product-assets.yml");
  assert.doesNotMatch(workflow, /client_payload/, "PRODUCTS must come only from a run started by hand");
});

test("store and Meshy secrets never reach the dependency installs of the asset pipeline", () => {
  const workflow = read(".github/workflows/product-assets.yml");
  const jobEnv = workflow.slice(workflow.indexOf("jobs:"), workflow.indexOf("steps:"));
  assert.doesNotMatch(jobEnv, /secrets\./, "secrets belong to the steps that use them, not the job");
  for (const install of workflow.matchAll(/run: npm ci[^\n]*\n/g)) {
    const step = workflow.slice(workflow.lastIndexOf("- ", install.index), install.index + install[0].length);
    assert.doesNotMatch(step, /secrets\./, `an install step sees a secret: ${step.trim()}`);
  }
});

test("the sign-in route always runs per request (a prerendered one would share its PKCE codes)", () => {
  assert.match(read("src/app/account/login/route.ts"), /await connection\(\)/);
});

test("the account routes give Shopify the public address and redirect within the site relatively", () => {
  const dir = new URL("../src/app/account/", import.meta.url);
  const routes = readdirSync(dir, { recursive: true, encoding: "utf8" }).filter((f) => f.endsWith("route.ts"));
  assert.ok(routes.length >= 4, "the account routes were not found");
  for (const file of routes) {
    const code = read(`src/app/account/${file}`);
    // A deploy address (<deploy-id>--site) is not registered in Shopify: sign-in would fail.
    for (const use of code.matchAll(/nextUrl\.origin/g)) {
      assert.match(code.slice(Math.max(0, use.index - 30), use.index), /publicOrigin\(\s*request\.$/, `${file}: request origin used without publicOrigin()`);
    }
    // An absolute redirect built from the request can move the shopper to a host without their cookies.
    assert.doesNotMatch(code, /request\.url/, `${file}: build same-site redirects with localRedirect()`);
  }
});
