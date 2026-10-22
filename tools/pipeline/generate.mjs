// Makes the storefront assets of Shopify products in the background (the scheduled GitHub Action runs
// this, and a Shopify webhook can start it as soon as a product changes):
//
//   1. Meshy image to image: the product alone, straight on, on a plain background,
//      from the merchant's photos                                                    (12 credits)
//   2. Meshy image to 3D: a textured 3D model of it, Meshy 7.1, 2K texture, PBR       (30 credits)
//   3. Meshy image to image: the on-model photo shown on hover (a generic model,
//      never a real person)                                                          (12 credits)
//   4. the GLB optimised for the web and for big screens, and rendered on sand from the front and the
//      back (../3d); a product tagged "back-print" shows its back first
//   5. everything uploaded to Shopify: the first view, the on-model photo (2nd image = the card's
//      hover) and the other view lead the product's images (the ones from an earlier run are taken
//      off the product, never deleted) and the custom fields are filled in
//
// A product runs when it has photos and no assets yet, when the merchant adds a photo (the photos the
// last run used are recorded in its `custom.asset_pipeline` field; the pipeline's own images do not
// count), or when it is tagged "regenerate-assets" (the tag is removed when done). Editing the title,
// price or stock never spends credits. A product is left alone when it is tagged "no-3d" or failed 3
// times with the same photos.
//
//   node generate.mjs [handle | product gid ...] [--max 3] [--check] [--dry-run] [--from-glb file.glb] [--local dir]
//
//   handles / gids   only these products, and they are redone even if up to date
//   --max n          products per run (default 3), so one run never spends more than planned
//   --check          only report how many products need a run (no Meshy, no 3D tools needed); in a
//                    GitHub Action it sets the step output `pending`
//   --dry-run        list what would run, spend nothing, write nothing
//   --from-glb file  skip Meshy and use this GLB (re-render a product, or test without credits);
//                    the product keeps its on-model photo
//   --local dir      write the renders and GLBs to dir instead of Shopify (with --from-glb: a free test)
//   --smoke          a free end-to-end test of the machinery (the Action's "smoke" option): the named
//                    products' current 3D model goes through the optimiser and the renderer, nothing
//                    is written to Shopify and Meshy is not called
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { loadEnvFile } from "./lib/env.mjs";
import * as meshy from "./lib/meshy.mjs";
import { NAMESPACE, PRODUCT_FIELDS as F } from "./lib/schema.mjs";
import { attachToProduct, createFiles, detachFromProduct, gql, setMetafields, setTag } from "./lib/shopify.mjs";

loadEnvFile();

const MAX_ATTEMPTS = 3;
const STALE_RUN_MS = 2 * 60 * 60 * 1000;
// Two images (12 each) and the 3D model (see meshy.modelSettings).
const CREDITS_PER_PRODUCT = 24 + meshy.modelSettings().credits;
const MIN_BALANCE = Number(process.env.MESHY_MIN_BALANCE ?? 100);
const TAG = { skip: "no-3d", backPrint: "back-print", redo: "regenerate-assets" };

const args = (() => {
  const out = { targets: [], max: 3, check: false, dryRun: false, fromGlb: null, local: null, smoke: false };
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--max") out.max = Math.max(1, Number.parseInt(argv[++i], 10) || 1);
    else if (a === "--check") out.check = true;
    else if (a === "--dry-run") out.dryRun = true;
    else if (a === "--from-glb") out.fromGlb = path.resolve(argv[++i]);
    else if (a === "--local") out.local = path.resolve(argv[++i]);
    else if (a === "--smoke") out.smoke = true;
    else if (/^(gid:\/\/shopify\/Product\/\d+|[a-z0-9][a-z0-9-]{0,127})$/.test(a)) out.targets.push(a);
    else throw new Error(`Unexpected argument: ${a}`);
  }
  if (out.smoke) {
    if (!out.targets.length) throw new Error("--smoke needs the products to test (handles)");
    out.local ??= fs.mkdtempSync(path.join(os.tmpdir(), "smoke-"));
  }
  return out;
})();

const log = (...m) => console.log(...m);

const FIELDS = `
  id handle title productType tags
  media(first: 50) { nodes { id mediaContentType ... on MediaImage { image { url } } } }
  model: metafield(namespace: "${NAMESPACE}", key: "${F.model.key}") { id }
  turntable: metafield(namespace: "${NAMESPACE}", key: "${F.turntable.key}") { value }
  onModel: metafield(namespace: "${NAMESPACE}", key: "${F.onModel.key}") { value }
  view: metafield(namespace: "${NAMESPACE}", key: "${F.view.key}") { value }
  modelHd: metafield(namespace: "${NAMESPACE}", key: "${F.modelHd.key}") { reference { ... on GenericFile { url } } }
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
      `query($after: String) { products(first: 50, after: $after, sortKey: CREATED_AT, query: "status:active OR status:draft OR status:unlisted") {
        nodes { ${FIELDS} } pageInfo { hasNextPage endCursor } } }`,
      { after },
    );
    all.push(...data.products.nodes);
    after = data.products.pageInfo.hasNextPage ? data.products.pageInfo.endCursor : null;
  } while (after);
  return all;
}

const parse = (value, fallback) => {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
};
const stateOf = (p) => parse(p.pipeline?.value, {});
/** The merchant photos the last run started from (a list of media ids), or null if never recorded. */
const photosUsed = (state) => (Array.isArray(state.photos) ? state.photos : null);
const hasTag = (p, tag) => p.tags.some((t) => t.toLowerCase() === tag);

/** The images the pipeline made for the product (recorded, or still referenced by its fields). */
function generatedIds(p) {
  const recorded = stateOf(p).generated;
  const ids = new Set(Array.isArray(recorded) ? recorded : []);
  for (const id of parse(p.turntable?.value, [])) ids.add(id);
  if (p.onModel?.value) ids.add(p.onModel.value);
  return ids;
}

/** The merchant's own photos, in the product's order. */
function merchantPhotos(p) {
  const generated = generatedIds(p);
  return p.media.nodes.filter((m) => m.mediaContentType === "IMAGE" && m.image?.url && !generated.has(m.id));
}

/**
 * What to do with a product: { action: "run" | "adopt" | "skip", reason }. "adopt" records the photos
 * of a product that got its assets before photos were tracked, so only photos added later count.
 */
function plan(p) {
  const state = stateOf(p);
  const photos = merchantPhotos(p).map((m) => m.id);
  const usedBefore = new Set(photosUsed(state) ?? []);
  const newPhotos = photos.filter((id) => !usedBefore.has(id));
  if (hasTag(p, TAG.skip)) return { action: "skip", reason: `tagged "${TAG.skip}"` };
  if (state.state === "running" && Date.now() - Date.parse(state.startedAt ?? 0) < STALE_RUN_MS) return { action: "skip", reason: "already running" };
  if (args.targets.length) return { action: "run", reason: "asked for" };
  if (p.model && !photosUsed(state)) return { action: "adopt", reason: "has its assets; recording its photos" };
  if (!photos.length && !args.fromGlb) return { action: "skip", reason: "no photo yet" };
  if (hasTag(p, TAG.redo)) return { action: "run", reason: `tagged "${TAG.redo}"` };
  if (p.model && !newPhotos.length) return { action: "skip", reason: "up to date" };
  // The same photos failed too often: wait for new photos (or the tag) instead of spending again.
  const failedWith = Array.isArray(state.failedPhotos) ? state.failedPhotos : [];
  const samePhotos = photos.length === failedWith.length && photos.every((id) => failedWith.includes(id));
  if (state.state === "failed" && samePhotos && (state.attempts ?? 0) >= MAX_ATTEMPTS) {
    return { action: "skip", reason: `failed ${state.attempts} times with these photos (add a photo or tag it "${TAG.redo}")` };
  }
  return { action: "run", reason: p.model ? `${newPhotos.length} new photo(s)` : "no assets yet" };
}

const PROMPT_ALONE = (title, type) =>
  `Studio product photo of exactly this ${type} ("${title}"): only the item itself, seen straight from the front, centred, ` +
  `filling most of the frame, on a plain light grey background with soft even light. No person, no mannequin, no hanger, ` +
  `no props. Keep every print, logo, text, colour, material and detail exactly as in the photos.`;

const PROMPT_ON_MODEL = (title, type) =>
  `E-commerce lifestyle photo of an adult model wearing this exact ${type} ("${title}"), or holding it if it is not clothing. ` +
  `Framed from the shoulders to the hips, the face out of frame or turned away; a generic model, not a real or famous person. ` +
  `Neutral studio or urban background, natural light. Keep the ${type}'s print, logo, text and colours exactly as in the reference.`;

const extOf = (url) => path.extname(new URL(url).pathname) || ".png";

async function setPipeline(productId, value) {
  await setMetafields([{ ownerId: productId, namespace: NAMESPACE, key: F.pipeline.key, type: F.pipeline.type, value: JSON.stringify(value) }]);
}

async function processProduct(p, tools) {
  const work = fs.mkdtempSync(path.join(os.tmpdir(), `assets-${p.handle}-`));
  const before = stateOf(p);
  const photos = merchantPhotos(p);
  const source = photos.map((m) => m.id);
  const failedWith = Array.isArray(before.failedPhotos) ? before.failedPhotos : [];
  const sameSource = failedWith.length === source.length && source.every((id) => failedWith.includes(id));
  const record = {
    state: "running",
    attempts: before.state === "failed" && sameSource ? (before.attempts ?? 0) + 1 : 1,
    startedAt: new Date().toISOString(),
    // The photos of the last good run: they change only when this run succeeds, so a failed run
    // with a new photo is tried again.
    photos: photosUsed(before) ?? [],
    generated: Array.isArray(before.generated) ? before.generated : [],
  };
  if (!args.local) await setPipeline(p.id, record);
  const progress = (m) => log(`  ${m}`);

  try {
    let glb = args.fromGlb;
    const tasks = {};
    let onModelFile = null;

    if (args.smoke) {
      const url = p.modelHd?.reference?.url;
      if (!url) throw new Error("the product has no 3D model to test with");
      progress("smoke test: the product's current 3D model, no Meshy, nothing written to Shopify");
      glb = await meshy.download(url, path.join(work, `${p.handle}-current.glb`));
    }

    if (!glb) {
      if (!photos.length) throw new Error("the product has no photo of its own to start from");
      const type = (p.productType || "product").toLowerCase();
      // The product's main photo, then the photos added since the last run, then the rest (4 at most).
      const usedBefore = new Set(photosUsed(before) ?? []);
      const ordered = [photos[0], ...photos.filter((m) => !usedBefore.has(m.id)), ...photos];
      const refs = [...new Set(ordered.map((m) => m.image.url))].slice(0, 4);
      progress(`1/5 product alone (Meshy image to image, from ${refs.length} photo(s))`);
      const alone = await meshy.imageToImage({ prompt: PROMPT_ALONE(p.title, type), imageUrls: refs, log: progress });
      tasks.alone = alone.taskId;

      progress("2/5 3D model (Meshy image to 3D)");
      const model = await meshy.imageTo3d({ imageUrl: alone.url, log: progress });
      tasks.model = model.taskId;
      glb = await meshy.download(model.glbUrl, path.join(work, `${p.handle}-original.glb`));

      progress("3/5 on-model photo for the hover (Meshy image to image)");
      const shot = await meshy.imageToImage({ prompt: PROMPT_ON_MODEL(p.title, type), imageUrls: [alone.url, refs[0]], aspectRatio: "4:3", log: progress });
      tasks.onModel = shot.taskId;
      onModelFile = await meshy.download(shot.url, path.join(work, `${p.handle}-on-model${extOf(shot.url)}`));
    }

    progress("4/5 optimise the GLB and render the front and the back");
    const { web, hd } = await tools.optimizeGlb(glb, work, p.handle, { log: progress });
    const backPrint = hasTag(p, TAG.backPrint);
    const angles = backPrint ? tools.BACK_FRONT : tools.FRONT_BACK;
    const renders = await tools.turntable.render(glb, path.join(work, "views"), { angles, pitch: 4 });

    if (args.local) {
      const out = path.join(args.local, p.handle);
      fs.mkdirSync(out, { recursive: true });
      for (const f of [web, hd, ...renders.map((r) => r.file), ...(onModelFile ? [onModelFile] : [])]) fs.copyFileSync(f, path.join(out, path.basename(f)));
      progress(`written to ${out}`);
      return;
    }

    progress("5/5 upload to Shopify");
    const renderIds = await createFiles(
      renders.map((r) => ({ source: r.file, kind: "image", alt: `${p.title}, ${r.name} view`, filename: `${p.handle}-${r.name}.webp` })),
    );
    const [newOnModelId] = onModelFile
      ? await createFiles([{ source: onModelFile, kind: "image", alt: `${p.title} on a model`, filename: path.basename(onModelFile) }])
      : [];
    const [webId, hdId] = await createFiles([
      { source: web, kind: "file", alt: `${p.title} 3D model`, filename: `${p.handle}.glb` },
      { source: hd, kind: "file", alt: `${p.title} 3D model (hd)`, filename: `${p.handle}-hd.glb` },
    ]);
    const onModelId = newOnModelId ?? p.onModel?.value ?? null;

    const mf = (field, value) => ({ ownerId: p.id, namespace: NAMESPACE, key: F[field].key, type: F[field].type, value });
    await setMetafields([
      mf("turntable", JSON.stringify(renderIds)),
      ...(onModelId ? [mf("onModel", onModelId)] : []),
      mf("model", webId),
      mf("modelHd", hdId),
      // A new model replaces any older showroom model too, so the showroom shows the same product.
      mf("modelShowroom", webId),
      // How the model faces the 3D viewer: its graphic towards the camera. Re-rendering a given GLB
      // keeps the framing set before.
      mf("view", args.fromGlb && p.view?.value ? p.view.value : JSON.stringify({ fit: 2.35, yaw: backPrint ? 180 : 0 })),
    ]);
    // The same pictures in Shopify: the first view, the on-model photo (the second image is what a
    // card shows on hover) and the other view lead the merchant's photos, and the images of earlier
    // runs come off the product (they stay in Files).
    const lead = [renderIds[0], onModelId, ...renderIds.slice(1)].filter(Boolean);
    const old = [...generatedIds(p)].filter((id) => !lead.includes(id) && p.media.nodes.some((m) => m.id === id));
    await detachFromProduct(p.id, old);
    await attachToProduct(p.id, lead);
    if (hasTag(p, TAG.redo)) await setTag(p.id, TAG.redo, false);
    await setPipeline(p.id, { ...record, state: "done", finishedAt: new Date().toISOString(), tasks, photos: source, generated: lead });
    progress("done");
  } catch (err) {
    if (!args.local) {
      await setPipeline(p.id, { ...record, state: "failed", failedPhotos: source, error: String(err.message).slice(0, 500), finishedAt: new Date().toISOString() });
    }
    throw err;
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
}

const products = await loadProducts();
const queue = [];
const adopt = [];
for (const p of products) {
  const { action, reason } = plan(p);
  if (action === "run") queue.push(p);
  else if (action === "adopt") adopt.push(p);
  if (args.targets.length || args.dryRun || action !== "skip") log(`${action.padEnd(5)} ${p.handle}: ${reason}`);
}

// Recording the photos of products made before photos were tracked costs nothing: done right away.
if (!args.dryRun && !args.local) {
  for (const p of adopt) {
    const state = stateOf(p);
    await setPipeline(p.id, { ...state, photos: merchantPhotos(p).map((m) => m.id), generated: [...generatedIds(p)] });
  }
}

const batch = queue.slice(0, args.max);
log(`${queue.length} product(s) need assets; this run does ${batch.length}${queue.length > batch.length ? ` (the next runs do the rest)` : ""}.`);
if (args.check) {
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `pending=${queue.length}\n`);
  process.exit(0);
}
if (args.dryRun || batch.length === 0) process.exit(0);
if (!args.fromGlb && !args.smoke && !process.env.MESHY_API_KEY) {
  // Without Meshy nothing can be made: leave the products untouched (no failed attempts counted).
  log("MESHY_API_KEY is not set: nothing generated. Add it (a GitHub secret for the Action) and the next run does these.");
  process.exit(1);
}

// The 3D tools load only when there is work, so `--check` runs without them installed.
const [{ optimizeGlb }, { FRONT_BACK, BACK_FRONT, openTurntable }] = await Promise.all([
  import("../3d/lib/optimize.mjs"),
  import("../3d/lib/turntable.mjs"),
]);
let failures = 0;
const turntable = await openTurntable();
try {
  for (const p of batch) {
    if (!args.fromGlb && !args.smoke) {
      const credits = await meshy.balance();
      if (credits !== null && credits < MIN_BALANCE + CREDITS_PER_PRODUCT) {
        log(`Stopping: Meshy has ${credits} credits, below the ${MIN_BALANCE} kept in reserve plus ${CREDITS_PER_PRODUCT} for a product.`);
        break;
      }
    }
    log(`${p.handle} (${p.title})`);
    try {
      await processProduct(p, { optimizeGlb, FRONT_BACK, BACK_FRONT, turntable });
    } catch (err) {
      failures++;
      log(`  failed: ${err.message}`);
    }
  }
} finally {
  await turntable.close();
}
process.exit(failures ? 1 : 0);
