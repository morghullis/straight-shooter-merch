// Gives a model made from one photo of its back a real front: Meshy invents the side it never saw
// (usually a blurred copy of the print). This projects a photo of the real front (the garment alone,
// straight on) onto that side of the model, front to back, and keeps the fabric plain around the
// print. The normal map is evened out there, and the roughness map everywhere (Meshy makes printed areas
// shinier), so the invented print leaves no trace.
//
// usage: node project-front.mjs <in.glb> <out.glb> <front.png> <+z|-z>
//   +z / -z: the side of the model that is the invented front (the one the camera sees at yaw 0 is +z).
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import sharp from "sharp";

const [input, output, frontPath, sideArg] = process.argv.slice(2);
if (!sideArg) throw new Error("usage: node project-front.mjs <in.glb> <out.glb> <front.png> <+z|-z>");
const side = sideArg === "-z" ? -1 : 1;
sharp.cache(false);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(input);
const prim = doc.getRoot().listMeshes()[0].listPrimitives()[0];
const pos = prim.getAttribute("POSITION").getArray();
const uv = prim.getAttribute("TEXCOORD_0").getArray();
const idx = prim.getIndices().getArray();

// ---- the photo of the front: where the garment is, its fabric colour, its bounding box ----
const photo = await sharp(frontPath).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const PW = photo.info.width, PH = photo.info.height, P = photo.data;
const px = (x, y, c) => P[(y * PW + x) * 3 + c];
const bg = [0, 1, 2].map((c) => (px(4, 4, c) + px(PW - 5, 4, c) + px(4, PH - 5, c) + px(PW - 5, PH - 5, c)) / 4);
const onGarment = (x, y) => Math.abs(px(x, y, 0) - bg[0]) + Math.abs(px(x, y, 1) - bg[1]) + Math.abs(px(x, y, 2) - bg[2]) > 24;
// Inside the garment, away from its outline (the outline's soft edge would paint light seams).
// The background is what is connected to the photo's border (a white print inside is not background).
const inner = new Uint8Array(PW * PH).fill(1);
{
  const stack = [];
  const push = (x, y) => { const t = y * PW + x; if (inner[t] && !onGarment(x, y)) { inner[t] = 0; stack.push(t); } };
  for (let x = 0; x < PW; x++) { push(x, 0); push(x, PH - 1); }
  for (let y = 0; y < PH; y++) { push(0, y); push(PW - 1, y); }
  while (stack.length) {
    const t = stack.pop(), x = t % PW, y = (t / PW) | 0;
    if (x > 0) push(x - 1, y); if (x < PW - 1) push(x + 1, y); if (y > 0) push(x, y - 1); if (y < PH - 1) push(x, y + 1);
  }
}
for (let pass = 0; pass < 8; pass++) {
  const prev = inner.slice();
  for (let y = 1; y < PH - 1; y++) for (let x = 1; x < PW - 1; x++) {
    const t = y * PW + x;
    if (prev[t] && (!prev[t - 1] || !prev[t + 1] || !prev[t - PW] || !prev[t + PW])) inner[t] = 0;
  }
}
const isGarment = (x, y) => inner[y * PW + x] === 1;
let bx0 = PW, bx1 = 0, by0 = PH, by1 = 0;
const fabricSamples = [];
for (let y = 0; y < PH; y += 2) for (let x = 0; x < PW; x += 2) {
  if (!onGarment(x, y)) continue;
  bx0 = Math.min(bx0, x); bx1 = Math.max(bx1, x); by0 = Math.min(by0, y); by1 = Math.max(by1, y);
  fabricSamples.push(px(x, y, 0) + px(x, y, 1) + px(x, y, 2));
}
fabricSamples.sort((a, b) => a - b);
const fabricSum = fabricSamples[fabricSamples.length >> 1];
console.log("photo", PW + "x" + PH, "garment box", bx0, by0, bx1, by1, "fabric", Math.round(fabricSum / 3));

// ---- the model's invented side: triangles facing it, and their bounding box ----
const faceN = (a, b, c) => {
  const ux = pos[b * 3] - pos[a * 3], uy = pos[b * 3 + 1] - pos[a * 3 + 1], uz = pos[b * 3 + 2] - pos[a * 3 + 2];
  const vx = pos[c * 3] - pos[a * 3], vy = pos[c * 3 + 1] - pos[a * 3 + 1], vz = pos[c * 3 + 2] - pos[a * 3 + 2];
  const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
  return (nz * side) / (Math.hypot(nx, ny, nz) || 1);
};
// The front's outline, from the triangles that face it.
let mx0 = Infinity, mx1 = -Infinity, my0 = Infinity, my1 = -Infinity;
for (let i = 0; i < idx.length; i += 3) {
  if (faceN(idx[i], idx[i + 1], idx[i + 2]) < 0.2) continue;
  for (const v of [idx[i], idx[i + 1], idx[i + 2]]) {
    mx0 = Math.min(mx0, pos[v * 3]); mx1 = Math.max(mx1, pos[v * 3]); my0 = Math.min(my0, pos[v * 3 + 1]); my1 = Math.max(my1, pos[v * 3 + 1]);
  }
}

// ---- rasterise those triangles at the texture's own resolution (Meshy packs the texture in thin
// strips: anything coarser leaves stripes); for each texel, where it lands on the photo ----
const material = prim.getMaterial();
const baseTex = material.getBaseColorTexture();
const baseBuf = Buffer.from(baseTex.getImage());
const { width: TW, height: TH } = await sharp(baseBuf).metadata();
const N = TW * TH;
const weight = new Uint8Array(N); // how much of the photo replaces the texel (0..255)
const sample = new Uint8Array(N * 3);
const logo = new Uint8Array(N); // 255 where the photo shows print, 0 on plain fabric
// Which texels are on this side is decided by where they are, not by which way their triangle faces:
// the relief of the invented print has walls and folds facing every way. A texel is on this side when
// it is in the near layer of the cloth (within LAYER of the front-most surface over the same spot);
// it fades out where the surface turns away, round the sides.
const GG = 256;
const gcell = (X, Y) =>
  Math.min(GG - 1, Math.max(0, Math.floor(((my1 - Y) / (my1 - my0)) * GG))) * GG +
  Math.min(GG - 1, Math.max(0, Math.floor(((X - mx0) / (mx1 - mx0)) * GG)));
const gTop = new Float64Array(GG * GG).fill(-Infinity);
for (let v = 0; v < pos.length / 3; v++) { const t = gcell(pos[v * 3], pos[v * 3 + 1]); gTop[t] = Math.max(gTop[t], side * pos[v * 3 + 2]); }
const gTopS = new Float64Array(GG * GG).fill(-Infinity);
for (let y = 0; y < GG; y++) for (let x = 0; x < GG; x++) {
  let m = -Infinity;
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const yy = y + dy, xx = x + dx; if (yy >= 0 && yy < GG && xx >= 0 && xx < GG) m = Math.max(m, gTop[yy * GG + xx]); }
  gTopS[y * GG + x] = m;
}
const LAYER = 0.1 * (my1 - my0);
const owned = new Uint8Array(N); // texels that belong to some triangle (the rest is the atlas gutter)
// Meshy's islands overlap a little: texels that the far side also uses are left alone.
const farOwned = new Uint8Array(N);
for (let i = 0; i < idx.length; i += 3) {
  const a = idx[i], b = idx[i + 1], c = idx[i + 2];
  if (faceN(a, b, c) > -0.2) continue;
  const ax = uv[a * 2] * TW, ay = uv[a * 2 + 1] * TH, bx = uv[b * 2] * TW, by = uv[b * 2 + 1] * TH, cx = uv[c * 2] * TW, cy = uv[c * 2 + 1] * TH;
  const minX = Math.max(0, Math.floor(Math.min(ax, bx, cx))), maxX = Math.min(TW - 1, Math.ceil(Math.max(ax, bx, cx)));
  const minY = Math.max(0, Math.floor(Math.min(ay, by, cy))), maxY = Math.min(TH - 1, Math.ceil(Math.max(ay, by, cy)));
  const d = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
  if (Math.abs(d) < 1e-12) continue;
  for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
    const qx = x + 0.5, qy = y + 0.5;
    const w1 = ((by - cy) * (qx - cx) + (cx - bx) * (qy - cy)) / d, w2 = ((cy - ay) * (qx - cx) + (ax - cx) * (qy - cy)) / d;
    if (w1 >= 0 && w2 >= 0 && 1 - w1 - w2 >= 0) farOwned[y * TW + x] = 1;
  }
}
for (let i = 0; i < idx.length; i += 3) {
  const a = idx[i], b = idx[i + 1], c = idx[i + 2];
  const f = faceN(a, b, c);
  const ax = uv[a * 2] * TW, ay = uv[a * 2 + 1] * TH, bx = uv[b * 2] * TW, by = uv[b * 2 + 1] * TH, cx = uv[c * 2] * TW, cy = uv[c * 2 + 1] * TH;
  const minX = Math.max(0, Math.floor(Math.min(ax, bx, cx) - 1)), maxX = Math.min(TW - 1, Math.ceil(Math.max(ax, bx, cx) + 1));
  const minY = Math.max(0, Math.floor(Math.min(ay, by, cy) - 1)), maxY = Math.min(TH - 1, Math.ceil(Math.max(ay, by, cy) + 1));
  const d = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
  if (Math.abs(d) < 1e-12) continue;
  for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
    const qx = x + 0.5, qy = y + 0.5;
    let w1 = ((by - cy) * (qx - cx) + (cx - bx) * (qy - cy)) / d;
    let w2 = ((cy - ay) * (qx - cx) + (ax - cx) * (qy - cy)) / d;
    let w3 = 1 - w1 - w2;
    if (w1 < -0.05 || w2 < -0.05 || w3 < -0.05) continue;
    const t = y * TW + x;
    if (w1 >= 0 && w2 >= 0 && w3 >= 0) owned[t] = 1;
    w1 = Math.max(0, w1); w2 = Math.max(0, w2); w3 = Math.max(0, w3);
    const sum = w1 + w2 + w3; w1 /= sum; w2 /= sum; w3 /= sum;
    const X = w1 * pos[a * 3] + w2 * pos[b * 3] + w3 * pos[c * 3];
    const Y = w1 * pos[a * 3 + 1] + w2 * pos[b * 3 + 1] + w3 * pos[c * 3 + 1];
    const Z = w1 * pos[a * 3 + 2] + w2 * pos[b * 3 + 2] + w3 * pos[c * 3 + 2];
    const gt = gcell(X, Y);
    // On this side: in the near layer, or on a triangle that plainly faces this way.
    const near = side * Z >= gTopS[gt] - LAYER;
    if (farOwned[t]) continue;
    // Fully on this side's surface, fading out only where it turns away round the sides.
    const wNear = near ? Math.min(1, Math.max(0, (f + 0.1) / 0.3)) : 0;
    const wFace = Math.min(1, Math.max(0, (f - 0.3) / 0.3));
    const w = Math.round(255 * Math.max(wNear, wFace));
    if (w === 0 || w <= weight[t]) continue;
    // Front to back, as the camera on that side sees it (mirrored on the -z side).
    const u = side > 0 ? (X - mx0) / (mx1 - mx0) : (mx1 - X) / (mx1 - mx0);
    const v = (my1 - Y) / (my1 - my0);
    const sx = Math.min(PW - 1, Math.max(0, Math.round(bx0 + u * (bx1 - bx0))));
    const sy = Math.min(PH - 1, Math.max(0, Math.round(by0 + v * (by1 - by0))));
    weight[t] = w;
    const r = px(sx, sy, 0), g = px(sx, sy, 1), bl = px(sx, sy, 2);
    sample[t * 3] = r; sample[t * 3 + 1] = g; sample[t * 3 + 2] = bl;
    const diff = Math.abs(r + g + bl - fabricSum) / 3 + (Math.max(r, g, bl) - Math.min(r, g, bl)) * 0.6;
    logo[t] = isGarment(sx, sy) ? Math.round(255 * Math.min(1, Math.max(0, (diff - 22) / 30))) : 0;
  }
}
// Grow the painted area into the atlas gutter (never into another island), so texture filtering at
// strip edges picks up no seam of the invented print.
for (let pass = 0; pass < 8; pass++) {
  const grow = [];
  for (let y = 1; y < TH - 1; y++) for (let x = 1; x < TW - 1; x++) {
    const t = y * TW + x;
    if (weight[t] || owned[t]) continue;
    for (const o of [1, -1, TW, -TW]) if (weight[t + o]) { grow.push(t, t + o); break; }
  }
  for (let k = 0; k < grow.length; k += 2) {
    const t = grow[k], s2 = grow[k + 1];
    weight[t] = weight[s2]; logo[t] = logo[s2];
    sample[t * 3] = sample[s2 * 3]; sample[t * 3 + 1] = sample[s2 * 3 + 1]; sample[t * 3 + 2] = sample[s2 * 3 + 2];
  }
}

// ---- composite into the textures ----
for (const { tex, kind } of [
  { tex: baseTex, kind: "base" },
  { tex: material.getNormalTexture(), kind: "normal" },
  { tex: material.getMetallicRoughnessTexture(), kind: "mr" },
]) {
  if (!tex) continue;
  const buf = Buffer.from(tex.getImage());
  const { width, height } = await sharp(buf).metadata();
  const raw = await sharp(buf).removeAlpha().raw().toBuffer();
  const same = width === TW && height === TH;
  const W = same ? weight : await sharp(Buffer.from(weight.buffer), { raw: { width: TW, height: TH, channels: 1 } }).resize(width, height, { kernel: "nearest" }).raw().toBuffer();
  const L = logo;
  // The roughness map: Meshy makes the invented print a little shinier, which shows as a ghost of it.
  // The whole garment gets the fabric's roughness (the median), so no print shines through.
  if (kind === "mr") {
    const gs = [], bs = [];
    for (let p = 0; p < width * height; p += 211) { gs.push(raw[p * 3 + 1]); bs.push(raw[p * 3 + 2]); }
    const med = (arr) => arr.sort((x, y) => x - y)[arr.length >> 1];
    const g = med(gs), b = med(bs);
    for (let p = 0; p < width * height; p++) { raw[p * 3 + 1] = g; raw[p * 3 + 2] = b; }
    const out = await sharp(raw, { raw: { width, height, channels: 3 } }).png({ compressionLevel: 6 }).toBuffer();
    tex.setImage(new Uint8Array(out)).setMimeType("image/png");
    console.log("mr: roughness", g, "metal", b, "everywhere");
    continue;
  }
  // The model's own fabric colour (the median of its base texture), so the front matches the back.
  let fabric = [128, 128, 255];
  if (kind === "base") {
    const rs = [], gs = [], bs = [];
    for (let p = 0; p < width * height; p += 211) if (W[p] === 0) { rs.push(raw[p * 3]); gs.push(raw[p * 3 + 1]); bs.push(raw[p * 3 + 2]); }
    const med = (arr) => arr.sort((x, y) => x - y)[arr.length >> 1] ?? 0;
    fabric = [med(rs), med(gs), med(bs)];
    console.log(kind, "fabric", fabric);
  }
  for (let p = 0; p < width * height; p++) {
    const k = W[p] / 255;
    if (k <= 0) continue;
    const l = kind === "base" ? L[p] / 255 : 0;
    for (let c = 0; c < 3; c++) {
      const target = kind === "base" ? fabric[c] * (1 - l) + sample[p * 3 + c] * l : fabric[c];
      raw[p * 3 + c] = raw[p * 3 + c] * (1 - k) + target * k;
    }
  }
  const out = await sharp(raw, { raw: { width, height, channels: 3 } }).png({ compressionLevel: 6 }).toBuffer();
  tex.setImage(new Uint8Array(out)).setMimeType("image/png");
  console.log(kind, width + "x" + height, "done");
}

await io.write(output, doc);
console.log("wrote", output);
