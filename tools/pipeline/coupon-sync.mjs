// Keeps what is already on offer out of the coupon codes: tags the products an automatic discount covers
// (auto-discounted) and takes the tag off when it ends. The automatic collection "Coupon eligible", which the
// coupon's discount applies to, leaves out that tag, the tag no-coupon and anything with a compare-at price.
// No credits. Runs in the same GitHub Action as generate.mjs.
//
//   node coupon-sync.mjs [--dry-run]
import { ELIGIBLE, AUTO_TAG, tagChanges } from "./lib/coupon-scope.mjs";
import { loadEnvFile, sleep } from "./lib/env.mjs";
import { check, gql, setTag } from "./lib/shopify.mjs";

loadEnvFile();
const SITE = (process.env.SITE_URL || "https://straightshootershop.com").replace(/\/$/, "");
const dryRun = process.argv.includes("--dry-run");

async function discountedNow() {
  const res = await fetch(`${SITE}/api/discounts`, { cache: "no-store" });
  if (!res.ok) throw new Error(`${SITE}/api/discounts answered ${res.status}`);
  const { discounts } = await res.json();
  if (!Array.isArray(discounts) || discounts.some((d) => !Array.isArray(d.products))) throw new Error("the site does not list the discounted products yet");
  return discounts.flatMap((d) => d.products);
}

async function products() {
  const all = [];
  let after = null;
  do {
    const { products: page } = await gql(`query($after: String) { products(first: 100, after: $after, query: "status:active OR status:unlisted") { nodes { id handle tags } pageInfo { hasNextPage endCursor } } }`, { after });
    all.push(...page.nodes);
    after = page.pageInfo.hasNextPage ? page.pageInfo.endCursor : null;
  } while (after);
  return all;
}

async function eligibleCollection() {
  const { collectionByIdentifier: c } = await gql(`query($h: String!) { collectionByIdentifier(identifier: { handle: $h }) { id ruleSet { appliedDisjunctively rules { column relation condition } } } }`, { h: ELIGIBLE.handle });
  const ruleSet = { appliedDisjunctively: false, rules: ELIGIBLE.rules };
  const key = (rules) => JSON.stringify(rules.map((r) => [r.column, r.relation, r.condition ?? ""]).sort());
  if (c && key(c.ruleSet?.rules ?? []) === key(ELIGIBLE.rules)) return;
  console.log(`${c ? "update" : "create"} the collection ${ELIGIBLE.handle}`);
  if (dryRun) return;
  if (c) check((await gql(`mutation($i: CollectionInput!) { collectionUpdate(input: $i) { userErrors { message } } }`, { i: { id: c.id, ruleSet } })).collectionUpdate, "collection");
  else check((await gql(`mutation($i: CollectionInput!) { collectionCreate(input: $i) { userErrors { message } } }`, { i: { title: ELIGIBLE.title, handle: ELIGIBLE.handle, ruleSet } })).collectionCreate, "collection");
}

await eligibleCollection();
const list = await products();
let discounted = await discountedNow();
let changes = tagChanges(list, discounted);
if (changes.remove.length) {
  // A discount that seems over: asked again in a while (the site shows usual prices when Shopify stumbles).
  await sleep(dryRun ? 0 : 150_000);
  discounted = await discountedNow();
  changes = tagChanges(list, discounted);
}
for (const [on, group] of [[true, changes.add], [false, changes.remove]]) {
  for (const p of group) {
    console.log(`${on ? "+" : "-"} ${AUTO_TAG}  ${p.handle}`);
    if (!dryRun) await setTag(p.id, AUTO_TAG, on);
  }
}
console.log(`${discounted.length} product(s) on offer; ${changes.add.length} tagged, ${changes.remove.length} untagged.`);
