// Asks for the "Coupon popup" app's two keys (the secret does not show as it is typed), checks them with Shopify
// and keeps them on Netlify. Nothing is written to a file or shown. Run by a person: node scripts/set-coupon-keys.mjs
import { spawnSync } from "node:child_process";
import readline from "node:readline";

const SITE = "9d466b09-f94d-4fa4-872b-5cd52f52ac2f";
const SCOPES = ["write_discounts", "write_customers", "read_metaobjects"];
if (!process.stdin.isTTY) throw new Error("Run it in a terminal");

const netlify = (...args) => spawnSync("netlify", args, { encoding: "utf8" });
const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
const ask = (question, hidden) =>
  new Promise((resolve) => {
    const write = rl._writeToOutput;
    rl.question(question, (answer) => {
      rl._writeToOutput = write;
      if (hidden) process.stdout.write("\n");
      resolve(answer.trim());
    });
    if (hidden) rl._writeToOutput = () => {};
  });
const stop = (why) => {
  console.error(`\n${why}\nNothing was changed.`);
  process.exit(1);
};

const domain = netlify("env:get", "SHOPIFY_STORE_DOMAIN", "--site", SITE, "--context", "production").stdout.trim();
if (!/^[a-z0-9-]+\.myshopify\.com$/.test(domain)) stop("Could not read the store from Netlify. Is the netlify command signed in?");

const id = await ask("Client ID: ", false);
const secret = await ask("Client secret (it does not show): ", true);
rl.close();
if (!/^[0-9a-f]{32}$/.test(id)) stop("That is not a Client ID (32 characters).");
if (secret.length < 30 || /\s/.test(secret)) stop("That is not a Client secret.");

const res = await fetch(`https://${domain}/admin/oauth/access_token`, {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({ grant_type: "client_credentials", client_id: id, client_secret: secret }),
});
if (!res.ok) stop(`Shopify did not accept the keys (${res.status}).`);
const { access_token, scope = "" } = await res.json();
const has = scope.split(",");
const missing = SCOPES.filter((s) => !has.includes(s));
if (missing.length) stop(`The app has no permission for: ${missing.join(", ")}`);
console.log("Shopify: the keys work and the permissions are right.");

// Protected customer data (name and email) is a separate approval: reading one says whether it is there.
const probe = await fetch(`https://${domain}/admin/api/2026-07/graphql.json`, {
  method: "POST",
  headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": access_token },
  body: JSON.stringify({ query: `{ customers(first: 1) { nodes { firstName defaultEmailAddress { emailAddress } } } }` }),
});
const errors = (await probe.json()).errors;
console.log(errors ? `Customer data: NOT allowed yet (${errors[0].message.slice(0, 160)})` : "Customer data: allowed.");

for (const [key, value, ...more] of [["SHOPIFY_COUPON_CLIENT_ID", id], ["SHOPIFY_COUPON_CLIENT_SECRET", secret, "--secret"]]) {
  const r = netlify("env:set", key, value, "--context", "production", "--site", SITE, "--force", ...more);
  if (r.status !== 0) {
    console.error(`Netlify did not keep ${key}: ${(r.stderr || r.stdout).replaceAll(value, "***").slice(0, 300)}`);
    process.exit(1);
  }
  console.log(`Netlify: ${key} kept.`);
}
const build = netlify("api", "createSiteBuild", "--data", JSON.stringify({ site_id: SITE }));
console.log(build.status === 0 ? "Netlify is publishing the site again (a few minutes). Done." : "Now publish the site again on Netlify (Deploys > Trigger deploy).");
