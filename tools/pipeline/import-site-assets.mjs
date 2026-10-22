// Moves art the site already has (turntable renders, on-model photos, GLBs) into each product's custom
// fields in Shopify, so the storefront reads everything from Shopify. Skips products that already have
// a 3D model unless --force.
//
//   node import-site-assets.mjs <manifest.json> [--force] [handle ...]
//
// The manifest maps product handles to public URLs (or existing Shopify file ids, gid://...):
//   { "<handle>": { "turntable": [{ "url", "alt" }], "onModel": { "url", "alt" }, "model": url,
//                   "modelHd": url, "modelShowroom": url, "view": { "fit", "yaw" } } }
import fs from "node:fs";
import path from "node:path";

import { loadEnvFile } from "./lib/env.mjs";
import { createFiles, gql, setMetafields } from "./lib/shopify.mjs";
import { NAMESPACE, PRODUCT_FIELDS as F } from "./lib/schema.mjs";

loadEnvFile();

const args = process.argv.slice(2);
const manifestPath = args.find((a) => !a.startsWith("--") && a.endsWith(".json"));
if (!manifestPath) throw new Error("Usage: node import-site-assets.mjs <manifest.json> [--force] [handle ...]");
const force = args.includes("--force");
const only = args.filter((a) => !a.startsWith("--") && a !== manifestPath);
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

const ext = (url) => path.extname(new URL(url).pathname) || ".bin";

/** Existing Shopify file ids are used as they are; URLs become new Shopify files. */
async function files(entries) {
  const ids = new Array(entries.length);
  const fresh = [];
  entries.forEach((e, i) => (e.source.startsWith("gid://") ? (ids[i] = e.source) : fresh.push([i, e])));
  if (fresh.length) {
    const created = await createFiles(fresh.map(([, e]) => e));
    fresh.forEach(([i], k) => (ids[i] = created[k]));
  }
  return ids;
}

for (const [handle, art] of Object.entries(manifest)) {
  if (only.length && !only.includes(handle)) continue;
  const data = await gql(
    `query($h: String!) { productByIdentifier(identifier: { handle: $h }) { id title model: metafield(namespace: "${NAMESPACE}", key: "${F.model.key}") { id } } }`,
    { h: handle },
  );
  const product = data.productByIdentifier;
  if (!product) {
    console.log(`skip     ${handle}: not in the store`);
    continue;
  }
  if (product.model && !force) {
    console.log(`skip     ${handle}: already has its assets (use --force to replace)`);
    continue;
  }

  const turntable = await files(art.turntable.map((t, i) => ({ source: t.url, kind: "image", alt: t.alt, filename: `${handle}-${i + 1}${ext(t.url)}` })));
  const [onModel] = art.onModel ? await files([{ source: art.onModel.url, kind: "image", alt: art.onModel.alt, filename: `${handle}-on-model${ext(art.onModel.url)}` }]) : [];
  const glbs = [
    ["model", art.model, ""],
    ["modelHd", art.modelHd, "-hd"],
    ["modelShowroom", art.modelShowroom, "-showroom"],
  ].filter(([, src]) => src);
  const glbIds = await files(glbs.map(([, src, suffix]) => ({ source: src, kind: "file", alt: `${product.title} 3D model${suffix ? ` (${suffix.slice(1)})` : ""}`, filename: `${handle}${suffix}.glb` })));
  const glb = Object.fromEntries(glbs.map(([field], i) => [field, glbIds[i]]));

  const mf = (field, type, value) => ({ ownerId: product.id, namespace: NAMESPACE, key: F[field].key, type, value });
  await setMetafields([
    mf("turntable", F.turntable.type, JSON.stringify(turntable)),
    ...(onModel ? [mf("onModel", F.onModel.type, onModel)] : []),
    ...Object.entries(glb).map(([field, id]) => mf(field, F[field].type, id)),
    ...(art.view ? [mf("view", "json", JSON.stringify(art.view))] : []),
    mf("pipeline", "json", JSON.stringify({ state: "done", source: "site-import", at: new Date().toISOString() })),
  ]);
  console.log(`imported ${handle}: ${turntable.length} renders, ${onModel ? "on-model photo, " : ""}${glbIds.length} GLB`);
}
