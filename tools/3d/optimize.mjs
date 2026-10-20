// usage: node process.mjs <in.glb> <outDir> <name>
// Writes <outDir>/<name>.glb (web: showroom / phones) and <outDir>/<name>-hd.glb (product page on desktop).
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { weld, simplify, prune, dedup, textureCompress, meshopt, getBounds } from "@gltf-transform/functions";
import { MeshoptEncoder, MeshoptSimplifier } from "meshoptimizer";
import sharp from "sharp";
import fs from "node:fs";

const [input, outDir, name] = process.argv.slice(2);
await MeshoptEncoder.ready;
await MeshoptSimplifier.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.encoder": MeshoptEncoder });

const variants = [
  { suffix: "", triangles: 60000, base: 2048, normal: 1024, mr: 1024, q: 84 },
  { suffix: "-hd", triangles: 160000, base: 4096, normal: 2048, mr: 1024, q: 88 },
];

for (const v of variants) {
  const doc = await io.read(input);
  const tris = doc.getRoot().listMeshes().flatMap((m) => m.listPrimitives()).reduce((n, p) => n + (p.getIndices()?.getCount() ?? 0) / 3, 0);
  const ratio = Math.min(1, v.triangles / tris);
  await doc.transform(weld({ tolerance: 0 }), simplify({ simplifier: MeshoptSimplifier, ratio, error: 0.002 }), dedup(), prune());
  const enc = (slots, size) => textureCompress({ encoder: sharp, targetFormat: "webp", resize: [size, size], slots, quality: v.q, effort: 6 });
  await doc.transform(
    enc(/^baseColor/, v.base),
    enc(/^normal/, v.normal),
    enc(/^metallicRoughness/, v.mr),
    meshopt({ encoder: MeshoptEncoder, level: "high" }),
  );
  const out = `${outDir}/${name}${v.suffix}.glb`;
  await io.write(out, doc);
  const after = doc.getRoot().listMeshes().flatMap((m) => m.listPrimitives()).reduce((n, p) => n + (p.getIndices()?.getCount() ?? 0) / 3, 0);
  console.log(`${name}${v.suffix}: ${Math.round(tris)} -> ${Math.round(after)} tris, ${(fs.statSync(out).size / 1024).toFixed(0)} KB`);
}
