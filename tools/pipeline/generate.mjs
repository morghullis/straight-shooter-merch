// Makes the storefront assets of every Shopify product that has none yet, in the background (the
// scheduled GitHub Action runs this, and a Shopify webhook can start it as soon as a product is created):
//
//   1. Meshy image to image: the product alone, straight on, on a plain background   (12 credits)
//   2. Meshy image to 3D: a textured 3D model of it, 8K, Ultra geometry, PBR         (40 credits)
//   3. Meshy image to image: an on-model photo for the hover (a generic model, never a
//      real person), unless the product already has one                              (12 credits)
//   4. the GLB optimised for the web and for big screens, and its turntable rendered on sand (../3d)
//   5. everything uploaded to Shopify, and the product's custom fields filled in
//
// A product is left alone when it is tagged "no-3d", has no photo yet, already has its assets, or
// failed 3 times. Its `custom.asset_pipeline` field records what happened; delete that field to make
// the product run again.
//
//   node generate.mjs [handle | product gid ...] [--max 3] [--dry-run] [--from-glb file.glb] [--local dir]
//
//   handles / gids   only these products (even if they already have assets: they are redone)
//   --max n          products per run (default 3), so one run never spends more than planned
//   --dry-run        list what would run, spend nothing, write nothing
//   --from-glb file  skip Meshy and use this GLB (re-render a product, or test without credits)
//   --local dir      write the renders and GLBs to dir instead of Shopify (with --from-glb: a free test)
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { optimizeGlb } from "../3d/lib/optimize.mjs";
import { FRONT_FIRST, openTurntable } from "../3d/lib/turntable.mjs";
import { loadEnvFile } from "./lib/env.mjs";
import * as meshy from "./lib/meshy.mjs";
import { NAMESPACE, PRODUCT_FIELDS as F } from "./lib/schema.mjs";
import { attachToProduct, createFiles, gql, setMetafields } from "./lib/shopify.mjs";

loadEnvFile();

const MAX_ATTEMPTS = 3;
const STALE_RUN_MS = 2 * 60 * 60 * 1000;
const CREDITS_PER_PRODUCT = 64;
const MIN_BALANCE = Number(process.env.MESHY_MIN_BALANCE ?? 100);

const args = (() => {
  const out = { targets: [], max: 3, dryRun: false, fromGlb: null, local: null };
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--max") out.max = Math.max(1, Number.parseInt(argv[++i], 10) || 1);
    else if (a === "--dry-run") out.dryRun = true;
    else if (a === "--from-glb") out.fromGlb = path.resolve(argv[++i]);
    else if (a === "--local") out.local = path.resolve(argv[++i]);
    else if (/^(gid:\/\/shopify\/Product\/\d+|[a-z0-9][a-z0-9-]{0,127})$/.test(a)) out.targets.push(a);
    else throw new Error(`Unexpected argument: ${a}`);
  }
  return out;
})();

const log = (...m) => console.log(...m);

const FIELDS = `
  id handle title productType tags
  images(first: 3) { nodes { url } }
  model: metafield(namespace: "${NAMESPACE}", key: "${F.model.key}") { id }
  onModel: metafield(namespace: "${NAMESPACE}", key: "${F.onModel.key}") { reference { __typename } }
  pipeline: metafield(namespace: "${NAMESPACE}", key: "${F.pipeline.key}") { value }
`;

async function loadProducts() {
  if (args.targets.length) {
    const found = [];
    for (const t of args.targets) {
      const data = t.startsWith("gid://")
        ? await gql(`query($id: ID!) { product(id: $id) { ${FIELDS} } }`, { id: t })
        : await gql(`query($h: String!) { productByIdentifier(identifier: { handle: $h }) { ${FIELDS} } }`, { h: t });
      const p = data.product ?? data.productByIdentifier;
      if (p) found.push(p);
      else log(`not found: ${t}`);
    }
    return found;
  }
  const all = [];
  let after = null;
  do {
    const data = await gql(
      `query($after: String) { products(first: 100, after: $after, sortKey: CREATED_AT, query: "status:active OR status:draft") {
        nodes { ${FIELDS} } pageInfo { hasNextPage endCursor } } }`,
      { after },
    );
    all.push(...data.products.nodes);
    after = data.products.pageInfo.hasNextPage ? data.products.pageInfo.endCursor : null;
  } while (after);
  return all;
}

const stateOf = (p) => {
  try {
    return JSON.parse(p.pipeline?.value ?? "{}");
  } catch {
    return {};
  }
};

/** Why a product should not run now, or null when it should. */
function reasonToSkip(p) {
  const explicit = args.targets.length > 0;
  const state = stateOf(p);
  if (p.tags.includes("no-3d")) return 'tagged "no-3d"';
  if (state.state === "running" && Date.now() - Date.parse(state.startedAt ?? 0) < STALE_RUN_MS) return "already running";
  if (explicit) return null;
  if (p.model) return "has its assets";
  if (state.state === "failed" && (state.attempts ?? 0) >= MAX_ATTEMPTS) return `failed ${state.attempts} times (delete its asset_pipeline field to retry)`;
  if (!p.images.nodes.length && !args.fromGlb) return "no photo yet";
  return null;
}

const PROMPT_ALONE = (title, type) =>
  `Studio product photo of exactly this ${type} ("${title}"): only the item itself, seen straight from the front, centred, ` +
  `filling most of the frame, on a plain light grey background with soft even light. No person, no mannequin, no hanger, ` +
  `no props. Keep every print, logo, text, colour and detail exactly as in the photo.`;

const PROMPT_ON_MODEL = (title, type) =>
  `E-commerce lifestyle photo of an adult model wearing this exact ${type} ("${title}"), or holding it if it is not clothing. ` +
  `Framed from the shoulders to the hips, the face out of frame or turned away; a generic model, not a real or famous person. ` +
  `Neutral studio or urban background, natural light. Keep the ${type}'s print, logo, text and colours exactly as in the reference.`;

const extOf = (url) => path.extname(new URL(url).pathname) || ".png";

async function setPipeline(productId, value) {
  await setMetafields([{ ownerId: productId, namespace: NAMESPACE, key: F.pipeline.key, type: F.pipeline.type, value: JSON.stringify(value) }]);
}

async function processProduct(p, turntable) {
  const work = fs.mkdtempSync(path.join(os.tmpdir(), `assets-${p.handle}-`));
  const record = { state: "running", attempts: (stateOf(p).attempts ?? 0) + 1, startedAt: new Date().toISOString() };
  if (!args.local) await setPipeline(p.id, record);
  const progress = (m) => log(`  ${m}`);

  try {
    let glb = args.fromGlb;
    const tasks = {};
    let onModelFile = null;

    if (!glb) {
      const type = (p.productType || "product").toLowerCase();
      const photo = p.images.nodes[0].url;
      progress("1/5 product alone (Meshy image to image)");
      const alone = await meshy.imageToImage({ prompt: PROMPT_ALONE(p.title, type), imageUrls: [photo], log: progress });
      tasks.alone = alone.taskId;

      progress("2/5 3D model (Meshy image to 3D)");
      const model = await meshy.imageTo3d({ imageUrl: alone.url, log: progress });
      tasks.model = model.taskId;
      glb = await meshy.download(model.glbUrl, path.join(work, `${p.handle}-original.glb`));

      if (!p.onModel?.reference) {
        progress("3/5 on-model photo (Meshy image to image)");
        const shot = await meshy.imageToImage({ prompt: PROMPT_ON_MODEL(p.title, type), imageUrls: [alone.url, photo], aspectRatio: "4:3", log: progress });
        tasks.onModel = shot.taskId;
        onModelFile = await meshy.download(shot.url, path.join(work, `${p.handle}-on-model${extOf(shot.url)}`));
      }
    }

    progress("4/5 optimise the GLB and render the turntable");
    const { web, hd } = await optimizeGlb(glb, work, p.handle, { log: progress });
    const renders = await turntable.render(glb, path.join(work, "turntable"), { angles: FRONT_FIRST, pitch: 4 });

    if (args.local) {
      const out = path.join(args.local, p.handle);
      fs.mkdirSync(out, { recursive: true });
      for (const f of [web, hd, ...renders.map((r) => r.file), ...(onModelFile ? [onModelFile] : [])]) fs.copyFileSync(f, path.join(out, path.basename(f)));
      progress(`written to ${out}`);
      return;
    }

    progress("5/5 upload to Shopify");
    const turntableIds = await createFiles(
      renders.map((r, i) => ({ source: r.file, kind: "image", alt: `${p.title}, ${r.name.replace(/-/g, " ")} view`, filename: `${p.handle}-${i + 1}.webp` })),
    );
    const [onModelId] = onModelFile
      ? await createFiles([{ source: onModelFile, kind: "image", alt: `${p.title} on a model`, filename: path.basename(onModelFile) }])
      : [];
    const [webId, hdId] = await createFiles([
      { source: web, kind: "file", alt: `${p.title} 3D model`, filename: `${p.handle}.glb` },
      { source: hd, kind: "file", alt: `${p.title} 3D model (hd)`, filename: `${p.handle}-hd.glb` },
    ]);

    const mf = (field, value) => ({ ownerId: p.id, namespace: NAMESPACE, key: F[field].key, type: F[field].type, value });
    await setMetafields([
      mf("turntable", JSON.stringify(turntableIds)),
      ...(onModelId ? [mf("onModel", onModelId)] : []),
      mf("model", webId),
      mf("modelHd", hdId),
      mf("view", JSON.stringify({ fit: 2.35, yaw: 0 })),
    ]);
    // The same pictures in Shopify: the renders and the on-model photo lead the product's own photos.
    await attachToProduct(p.id, [...turntableIds, ...(onModelId ? [onModelId] : [])]);
    await setPipeline(p.id, { ...record, state: "done", finishedAt: new Date().toISOString(), tasks });
    progress("done");
  } catch (err) {
    if (!args.local) await setPipeline(p.id, { ...record, state: "failed", error: String(err.message).slice(0, 500), finishedAt: new Date().toISOString() });
    throw err;
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
}

const products = await loadProducts();
const queue = [];
for (const p of products) {
  const reason = reasonToSkip(p);
  if (reason) {
    if (args.targets.length || args.dryRun) log(`skip  ${p.handle}: ${reason}`);
  } else queue.push(p);
}
const batch = queue.slice(0, args.max);
log(`${queue.length} product(s) need assets; this run does ${batch.length}${queue.length > batch.length ? ` (the next runs do the rest)` : ""}.`);
for (const p of batch) log(`  - ${p.handle}`);
if (args.dryRun || batch.length === 0) process.exit(0);
if (!args.fromGlb && !process.env.MESHY_API_KEY) {
  // Without Meshy nothing can be made: leave the products untouched (no failed attempts counted).
  log("MESHY_API_KEY is not set: nothing generated. Add it (a GitHub secret for the Action) and the next run does these.");
  process.exit(1);
}

let failures = 0;
const turntable = await openTurntable();
try {
  for (const p of batch) {
    if (!args.fromGlb) {
      const credits = await meshy.balance();
      if (credits !== null && credits < MIN_BALANCE + CREDITS_PER_PRODUCT) {
        log(`Stopping: Meshy has ${credits} credits, below the ${MIN_BALANCE} kept in reserve plus ${CREDITS_PER_PRODUCT} for a product.`);
        break;
      }
    }
    log(`${p.handle} (${p.title})`);
    try {
      await processProduct(p, turntable);
    } catch (err) {
      failures++;
      log(`  failed: ${err.message}`);
    }
  }
} finally {
  await turntable.close();
}
process.exit(failures ? 1 : 0);
