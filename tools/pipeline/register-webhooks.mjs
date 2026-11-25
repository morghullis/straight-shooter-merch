// Points the store's product and collection webhooks at the storefront, so changes in Shopify show on
// the site within seconds and new products start the asset pipeline. Safe to run again.
//
//   node register-webhooks.mjs https://your-site.example     register, and move them from an old address
//   node register-webhooks.mjs --list                         only list what is registered
//
// Moving the site to a new address (a custom domain): run it with the new address once it serves
// https. The same topics sent to another site's /api/revalidate are removed afterwards: Shopify does
// not follow redirects, so a webhook left on the old address would only fail.
//
// Shopify signs these with the app's client secret: set the site's SHOPIFY_WEBHOOK_SECRET to it.
import { loadEnvFile } from "./lib/env.mjs";
import { check, gql } from "./lib/shopify.mjs";

loadEnvFile();

const TOPICS = [
  "PRODUCTS_CREATE",
  "PRODUCTS_UPDATE",
  "PRODUCTS_DELETE",
  "COLLECTIONS_CREATE",
  "COLLECTIONS_UPDATE",
  "COLLECTIONS_DELETE",
  "INVENTORY_LEVELS_UPDATE",
];
// Need the app's read_discounts scope; without it the site still notices a discount within a minute or two.
const DISCOUNT_TOPICS = ["DISCOUNTS_CREATE", "DISCOUNTS_UPDATE", "DISCOUNTS_DELETE"];

async function registered() {
  const data = await gql(`{ webhookSubscriptions(first: 100) { nodes { id topic uri } } }`);
  return data.webhookSubscriptions.nodes;
}

const arg = process.argv[2];
if (!arg || arg === "--list") {
  for (const w of await registered()) console.log(`${w.topic.padEnd(24)} ${w.uri}`);
  process.exit(0);
}

const site = new URL(arg);
if (site.protocol !== "https:") throw new Error("The site must be served over https");
const uri = new URL("/api/revalidate", site).toString();
const existing = await registered();

const { currentAppInstallation } = await gql(`{ currentAppInstallation { accessScopes { handle } } }`);
if (currentAppInstallation.accessScopes.some((s) => /^(read|write)_discounts$/.test(s.handle))) TOPICS.push(...DISCOUNT_TOPICS);
else console.log(`skipped  ${DISCOUNT_TOPICS.join(", ")}: the app needs the read_discounts scope`);

for (const topic of TOPICS) {
  if (existing.some((w) => w.topic === topic && w.uri === uri)) {
    console.log(`ok       ${topic}`);
    continue;
  }
  const data = await gql(
    `mutation($topic: WebhookSubscriptionTopic!, $sub: WebhookSubscriptionInput!) {
      webhookSubscriptionCreate(topic: $topic, webhookSubscription: $sub) { webhookSubscription { id } userErrors { field message } }
    }`,
    { topic, sub: { uri, format: "JSON" } },
  );
  check(data.webhookSubscriptionCreate, topic);
  console.log(`created  ${topic} -> ${uri}`);
}

// Only after every topic reaches the new address: the old subscriptions of these topics.
const stale = existing.filter((w) => TOPICS.includes(w.topic) && w.uri !== uri && URL.canParse(w.uri) && new URL(w.uri).pathname === "/api/revalidate");
for (const w of stale) {
  const data = await gql(
    `mutation($id: ID!) { webhookSubscriptionDelete(id: $id) { deletedWebhookSubscriptionId userErrors { field message } } }`,
    { id: w.id },
  );
  check(data.webhookSubscriptionDelete, w.topic);
  console.log(`removed  ${w.topic} -> ${w.uri}`);
}
