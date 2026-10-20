// Paints the invented front of the Silhouette hoodie plain black: base colour, normal map and
// roughness/metal map are flattened wherever a triangle faces the front (+Z).
// usage: ITER=0 node repair-front.mjs <in.glb> <out.glb>   (ITER = optional geometry smoothing passes, 0 recommended)
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import sharp from "sharp";

const [input, output] = process.argv.slice(2);
sharp.cache(false);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(input);
const prim = doc.getRoot().listMeshes()[0].listPrimitives()[0];
const pos = prim.getAttribute("POSITION").getArray();
const uv = prim.getAttribute("TEXCOORD_0").getArray();
const idx = prim.getIndices().getArray();
const M = 2048;
const mask = new Uint8Array(M * M);

// rasterise front-facing triangles into UV space
const tri = (a, b, c) => {
  const ax = uv[a * 2] * M, ay = uv[a * 2 + 1] * M;
  const bx = uv[b * 2] * M, by = uv[b * 2 + 1] * M;
  const cx = uv[c * 2] * M, cy = uv[c * 2 + 1] * M;
  const minX = Math.max(0, Math.floor(Math.min(ax, bx, cx))), maxX = Math.min(M - 1, Math.ceil(Math.max(ax, bx, cx)));
  const minY = Math.max(0, Math.floor(Math.min(ay, by, cy))), maxY = Math.min(M - 1, Math.ceil(Math.max(ay, by, cy)));
  const d = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
  if (Math.abs(d) < 1e-9) return;
  for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
    const px = x + 0.5, py = y + 0.5;
    const w1 = ((by - cy) * (px - cx) + (cx - bx) * (py - cy)) / d;
    const w2 = ((cy - ay) * (px - cx) + (ax - cx) * (py - cy)) / d;
    const w3 = 1 - w1 - w2;
    if (w1 >= -0.02 && w2 >= -0.02 && w3 >= -0.02) mask[y * M + x] = 255;
  }
};
let painted = 0;
for (let i = 0; i < idx.length; i += 3) {
  const a = idx[i], b = idx[i + 1], c = idx[i + 2];
  const ux = pos[b * 3] - pos[a * 3], uy = pos[b * 3 + 1] - pos[a * 3 + 1], uz = pos[b * 3 + 2] - pos[a * 3 + 2];
  const vx = pos[c * 3] - pos[a * 3], vy = pos[c * 3 + 1] - pos[a * 3 + 1], vz = pos[c * 3 + 2] - pos[a * 3 + 2];
  let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
  const len = Math.hypot(nx, ny, nz) || 1; nz /= len;
  if (nz > -0.40) { tri(a, b, c); painted++; }
}
console.log("front triangles", painted, "of", idx.length / 3);

// soften: dilate a little, then blur
const soft = await sharp(Buffer.from(mask), { raw: { width: M, height: M, channels: 1 } }).blur(3).linear(1.6, -30).toColourspace("b-w").raw().toBuffer();

const material = prim.getMaterial();
const slots = [
  { tex: material.getBaseColorTexture(), kind: "base" },
  { tex: material.getNormalTexture(), kind: "normal" },
  { tex: material.getMetallicRoughnessTexture(), kind: "mr" },
];
for (const { tex, kind } of slots) {
  const buf = Buffer.from(tex.getImage());
  const meta = await sharp(buf).metadata();
  const { width, height } = meta;
  const raw = await sharp(buf).removeAlpha().raw().toBuffer();
  const m = await sharp(soft, { raw: { width: M, height: M, channels: 1 } }).resize(width, height, { kernel: "cubic" }).raw().toBuffer();
  // target colour for the plain fabric
  let target;
  if (kind === "base") target = [13, 13, 14];
  else if (kind === "normal") target = [128, 128, 255];
  else {
    // median of the unmasked pixels
    const rs = [], gs = [], bs = [];
    for (let p = 0; p < width * height; p += 97) if (m[p] < 8) { rs.push(raw[p * 3]); gs.push(raw[p * 3 + 1]); bs.push(raw[p * 3 + 2]); }
    const med = (a) => a.sort((x, y) => x - y)[a.length >> 1] ?? 128;
    target = [med(rs), med(gs), med(bs)];
  }
  console.log(kind, width + "x" + height, "target", target);
  for (let p = 0; p < width * height; p++) {
    const k = m[p] / 255;
    if (k <= 0) continue;
    raw[p * 3] = raw[p * 3] * (1 - k) + target[0] * k;
    raw[p * 3 + 1] = raw[p * 3 + 1] * (1 - k) + target[1] * k;
    raw[p * 3 + 2] = raw[p * 3 + 2] * (1 - k) + target[2] * k;
  }
  const out = await sharp(raw, { raw: { width, height, channels: 3 } }).png({ compressionLevel: 6 }).toBuffer();
  tex.setImage(new Uint8Array(out)).setMimeType("image/png");
}

// ---- flatten the invented bumps of the front geometry (Taubin smoothing, boundary fixed) ----
{
  const vcount = pos.length / 3;
  const key = (i) => `${Math.round(pos[i * 3] * 2e4)},${Math.round(pos[i * 3 + 1] * 2e4)},${Math.round(pos[i * 3 + 2] * 2e4)}`;
  const groupOf = new Int32Array(vcount); const groups = new Map(); let gcount = 0;
  for (let i = 0; i < vcount; i++) { const k = key(i); let g = groups.get(k); if (g === undefined) { g = gcount++; groups.set(k, g); } groupOf[i] = g; }
  let gx = new Float64Array(gcount), gy = new Float64Array(gcount), gz = new Float64Array(gcount);
  for (let i = 0; i < vcount; i++) { const g = groupOf[i]; gx[g] = pos[i * 3]; gy[g] = pos[i * 3 + 1]; gz[g] = pos[i * 3 + 2]; }
  // edges -> CSR adjacency
  const pairs = new Set(); const edgeList = [];
  const addEdge = (a, b) => { if (a === b) return; const k = a < b ? a * gcount + b : b * gcount + a; if (!pairs.has(k)) { pairs.add(k); edgeList.push(a, b); } };
  const frontOnly = new Uint8Array(gcount).fill(1);
  for (let i = 0; i < idx.length; i += 3) {
    const a = groupOf[idx[i]], b = groupOf[idx[i + 1]], c = groupOf[idx[i + 2]];
    addEdge(a, b); addEdge(b, c); addEdge(c, a);
    const ia = idx[i], ib = idx[i + 1], ic = idx[i + 2];
    const ux = pos[ib * 3] - pos[ia * 3], uy = pos[ib * 3 + 1] - pos[ia * 3 + 1], uz = pos[ib * 3 + 2] - pos[ia * 3 + 2];
    const vx = pos[ic * 3] - pos[ia * 3], vy = pos[ic * 3 + 1] - pos[ia * 3 + 1], vz = pos[ic * 3 + 2] - pos[ia * 3 + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    if (nz / (Math.hypot(nx, ny, nz) || 1) <= -0.40) { frontOnly[a] = 0; frontOnly[b] = 0; frontOnly[c] = 0; }
  }
  const deg = new Int32Array(gcount + 1);
  for (let e = 0; e < edgeList.length; e += 2) { deg[edgeList[e]]++; deg[edgeList[e + 1]]++; }
  const start = new Int32Array(gcount + 1); for (let g = 0; g < gcount; g++) start[g + 1] = start[g] + deg[g];
  const fill = start.slice(0, gcount); const adj = new Int32Array(start[gcount]);
  for (let e = 0; e < edgeList.length; e += 2) { const a = edgeList[e], b = edgeList[e + 1]; adj[fill[a]++] = b; adj[fill[b]++] = a; }
  const free = new Uint8Array(gcount);
  for (let g = 0; g < gcount; g++) { if (!frontOnly[g]) continue; let ok = 1; for (let k = start[g]; k < start[g + 1]; k++) if (!frontOnly[adj[k]]) { ok = 0; break; } free[g] = ok; }
  let nx = new Float64Array(gcount), ny = new Float64Array(gcount), nz = new Float64Array(gcount);
  const step = (lambda) => {
    for (let g = 0; g < gcount; g++) {
      const n = start[g + 1] - start[g];
      if (!free[g] || n === 0) { nx[g] = gx[g]; ny[g] = gy[g]; nz[g] = gz[g]; continue; }
      let sx = 0, sy = 0, sz = 0;
      for (let k = start[g]; k < start[g + 1]; k++) { const h = adj[k]; sx += gx[h]; sy += gy[h]; sz += gz[h]; }
      nx[g] = gx[g] + lambda * (sx / n - gx[g]); ny[g] = gy[g] + lambda * (sy / n - gy[g]); nz[g] = gz[g] + lambda * (sz / n - gz[g]);
    }
    [gx, nx] = [nx, gx]; [gy, ny] = [ny, gy]; [gz, nz] = [nz, gz];
  };
  const ITER = Number(process.env.ITER ?? 120);
  for (let it = 0; it < ITER; it++) { step(0.5); step(-0.53); }
  for (let i = 0; i < vcount; i++) { const g = groupOf[i]; pos[i * 3] = gx[g]; pos[i * 3 + 1] = gy[g]; pos[i * 3 + 2] = gz[g]; }
  prim.getAttribute("POSITION").setArray(pos);
  const accX = new Float64Array(gcount), accY = new Float64Array(gcount), accZ = new Float64Array(gcount);
  for (let i = 0; i < idx.length; i += 3) {
    const ia = idx[i], ib = idx[i + 1], ic = idx[i + 2];
    const ux = pos[ib * 3] - pos[ia * 3], uy = pos[ib * 3 + 1] - pos[ia * 3 + 1], uz = pos[ib * 3 + 2] - pos[ia * 3 + 2];
    const vx = pos[ic * 3] - pos[ia * 3], vy = pos[ic * 3 + 1] - pos[ia * 3 + 1], vz = pos[ic * 3 + 2] - pos[ia * 3 + 2];
    const fx = uy * vz - uz * vy, fy = uz * vx - ux * vz, fz = ux * vy - uy * vx;
    for (const v of [ia, ib, ic]) { const g = groupOf[v]; accX[g] += fx; accY[g] += fy; accZ[g] += fz; }
  }
  const normals = new Float32Array(vcount * 3);
  for (let i = 0; i < vcount; i++) { const g = groupOf[i]; const l = Math.hypot(accX[g], accY[g], accZ[g]) || 1; normals[i * 3] = accX[g] / l; normals[i * 3 + 1] = accY[g] / l; normals[i * 3 + 2] = accZ[g] / l; }
  prim.getAttribute("NORMAL").setArray(normals);
  console.log("smoothed", free.reduce((a, b) => a + b, 0), "of", gcount, "groups,", ITER, "passes");
}

await io.write(output, doc);
console.log("wrote", output);
