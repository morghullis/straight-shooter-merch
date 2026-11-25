// Gives every Shopify discount its own sticker (the site writes the percentage on it). Runs in the same
// GitHub Action as generate.mjs.
//
//   node stickers.mjs [--check] [--from-image file.png --for "HBCU 10"]
//
//   --check        only report how many discounts need a sticker (nothing installed, no credits); in a
//                  GitHub Action it sets the step output `stickers`
//   --from-image   use this picture (magenta background) instead of asking Meshy
//
// The discounts come from the site (`SITE_URL`/api/discounts: the ones shoppers see now). The stickers are
// kept in the store's `custom.discount_stickers` field, by the discount's name:
//   { "HBCU 10": { "url": "https://cdn.shopify.com/...", "file": "gid://...", "attempts": 1 } }
// 9 credits each. A picture that does not pass the checks is tried once more; after two tries the site
// keeps its plain label. Remove an entry to have it made again.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { loadEnvFile } from "./lib/env.mjs";
import * as meshy from "./lib/meshy.mjs";
import { NAMESPACE, SHOP_FIELDS } from "./lib/schema.mjs";
import { createFiles, gql, setMetafields } from "./lib/shopify.mjs";
import { CREDITS, cutOut, prompt } from "./lib/sticker.mjs";

loadEnvFile();

const F = SHOP_FIELDS.discountStickers;
const MAX_ATTEMPTS = 2;
const MIN_BALANCE = Number(process.env.MESHY_MIN_BALANCE ?? 100);
const SITE = (process.env.SITE_URL || "https://straightshootershop.com").replace(/\/$/, "");
const argv = process.argv.slice(2);
const value = (flag) => (argv.includes(flag) ? argv[argv.indexOf(flag) + 1] : null);
const check = argv.includes("--check");
const fromImage = value("--from-image");
const only = value("--for");
if (fromImage && !only) throw new Error("--from-image needs --for <discount name>");

async function readStickers() {
  const { shop } = await gql(`query { shop { id metafield(namespace: "${NAMESPACE}", key: "${F.key}") { value } } }`);
  let stickers = {};
  try {
    stickers = JSON.parse(shop.metafield?.value ?? "{}");
  } catch {
    /* written by hand and broken: start again */
  }
  return { shopId: shop.id, stickers };
}

/** Read again right before writing, so an entry changed meanwhile is kept. */
async function saveSticker(title, entry) {
  const { shopId, stickers } = await readStickers();
  await setMetafields([{ ownerId: shopId, namespace: NAMESPACE, key: F.key, type: F.type, value: JSON.stringify({ ...stickers, [title]: entry }) }]);
}

/** [{ title, image }]: the discounts on now, with a photo of a product each one covers. */
async function activeDiscounts() {
  if (fromImage) return [{ title: only, image: null }];
  const res = await fetch(`${SITE}/api/discounts`);
  if (!res.ok) throw new Error(`${SITE}/api/discounts answered ${res.status}`);
  const { discounts } = await res.json();
  return discounts.filter((d) => typeof d.title === "string" && typeof d.image === "string" && d.image.startsWith("https://cdn.shopify.com/"));
}
const discounts = await activeDiscounts();
const { stickers } = await readStickers();
const needs = discounts.filter((d) => {
  if (only) return d.title === only;
  return d.title && d.image && !stickers[d.title]?.url && (stickers[d.title]?.attempts ?? 0) < MAX_ATTEMPTS;
});

console.log(`${discounts.length} discount(s) on, ${needs.length} without a sticker${needs.length ? `: ${needs.map((d) => d.title).join(", ")}` : "."}`);
if (check) {
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `stickers=${needs.length}\n`);
  process.exit(0);
}

let failures = 0;
for (const d of needs) {
  const work = fs.mkdtempSync(path.join(os.tmpdir(), "sticker-"));
  let attempts = stickers[d.title]?.attempts ?? 0;
  try {
    for (;;) {
      let source = fromImage;
      if (!source) {
        const credits = await meshy.balance();
        if (credits !== null && credits < MIN_BALANCE + CREDITS) throw new Error(`Meshy has ${credits} credits, below the ${MIN_BALANCE} kept in reserve`);
        attempts++;
        await saveSticker(d.title, { attempts });
        console.log(`${d.title}: asking Meshy (try ${attempts} of ${MAX_ATTEMPTS}, ${CREDITS} credits)`);
        const image = await meshy.imageToImage({ prompt: prompt(), imageUrls: [d.image], aspectRatio: "1:1", model: "nano-banana-pro" });
        source = await meshy.download(image.url, path.join(work, "sticker.png"));
      }
      const { webp, ok, why } = await cutOut(source);
      if (ok) {
        const file = path.join(work, `sticker-${d.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "discount"}.webp`);
        fs.writeFileSync(file, webp);
        const [id] = await createFiles([{ source: file, kind: "image", alt: `${d.title} sticker` }]);
        const { node } = await gql(`query($id: ID!) { node(id: $id) { ... on MediaImage { image { url } } } }`, { id });
        await saveSticker(d.title, { url: node.image.url, file: id, attempts });
        console.log(`${d.title}: done`);
        break;
      }
      console.log(`${d.title}: not usable, ${why}`);
      if (fromImage || attempts >= MAX_ATTEMPTS) throw new Error(why);
    }
  } catch (err) {
    failures++;
    console.log(`${d.title}: failed, ${err.message}`);
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
}
process.exit(failures ? 1 : 0);
