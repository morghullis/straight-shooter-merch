// Points the store's product and collection webhooks at the storefront, so changes in Shopify show on
// the site within seconds and new products start the asset pipeline. Safe to run again.
//
//   node register-webhooks.mjs https://your-site.example     register (and list)
//   node register-webhooks.mjs --list                         only list what is registered
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
