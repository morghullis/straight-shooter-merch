// Turns a Meshy GLB into what the storefront ships: <name>.glb (web: showroom and phones) and
// <name>-hd.glb (product page on a big screen). Simplified with smooth normals, Meshopt compressed,
// WebP textures.
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dedup, meshopt, prune, simplify, textureCompress, weld } from "@gltf-transform/functions";
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from "meshoptimizer";
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";

import { smoothNormals } from "./smooth-normals.mjs";

const VARIANTS = [
  { suffix: "", triangles: 60000, base: 2048, normal: 1024, mr: 1024, q: 84 },
  { suffix: "-hd", triangles: 160000, base: 4096, normal: 2048, mr: 1024, q: 88 },
];

const triangleCount = (doc) =>
  doc.getRoot().listMeshes().flatMap((m) => m.listPrimitives()).reduce((n, p) => n + (p.getIndices()?.getCount() ?? 0) / 3, 0);

/** Writes both variants and returns their paths: { web, hd }. */
export async function optimizeGlb(input, outDir, name, { log = console.log } = {}) {
  await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready, MeshoptSimplifier.ready]);
  // The decoder also reads GLBs that were already optimised (a model from Shopify, a smoke test).
  const io = new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ "meshopt.decoder": MeshoptDecoder, "meshopt.encoder": MeshoptEncoder });
  fs.mkdirSync(outDir, { recursive: true });

  const out = {};
  for (const v of VARIANTS) {
    const doc = await io.read(input);
    const tris = triangleCount(doc);
    const ratio = Math.min(1, v.triangles / tris);
    // Simplified, then shaded from its own faces (the dense mesh's fine normals would show as flecks).
    await doc.transform(weld({ tolerance: 0 }), simplify({ simplifier: MeshoptSimplifier, ratio, error: 0.002 }), smoothNormals(), dedup(), prune());
    const enc = (slots, size) => textureCompress({ encoder: sharp, targetFormat: "webp", resize: [size, size], slots, quality: v.q, effort: 6 });
    await doc.transform(enc(/^baseColor/, v.base), enc(/^normal/, v.normal), enc(/^metallicRoughness/, v.mr), meshopt({ encoder: MeshoptEncoder, level: "high" }));
    const file = path.join(outDir, `${name}${v.suffix}.glb`);
    await io.write(file, doc);
    log(`${name}${v.suffix}: ${Math.round(tris)} -> ${Math.round(triangleCount(doc))} tris, ${(fs.statSync(file).size / 1024).toFixed(0)} KB`);
    out[v.suffix ? "hd" : "web"] = file;
  }
  return out;
}
