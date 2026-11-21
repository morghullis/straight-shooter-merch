// Dresses a blank garment model with a product: the garment's colour and its print.
//
//   node print-garment.mjs <blank.glb> <print.png> <outDir> <name> [--color=#1b1b1d] [--width=0.34] [--top=0.12] [--standoff=0.012]
//
// <blank.glb>: a plain white garment (Meshy image-to-3D of a print-free photo, assets-src/blanks/).
// <print.png>: the print on a transparent background.
// --color:  the garment's colour (sRGB hex). The blank's own shading (its folds) is kept under it.
// --width:  the print's width, as a fraction of the garment's overall width (sleeves included).
// --top:    the print's top edge, as a fraction of the garment's height below its highest point.
// --standoff: leave unprinted what stands in front of the cloth by more than this fraction of the
//           garment's height (a hoodie's drawstrings hang over the print and keep their colour).
//
// The print is projected straight from the front onto the front of the garment, into a new 4K colour
// texture: it follows the folds but stays as sharp as its file, and never stands off the cloth (an
// image-to-3D model of a printed garment turns the print into relief). The cloth is matte (no
// roughness/metal map). Writes <name>.glb and <name>-hd.glb (see lib/optimize.mjs).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import sharp from "sharp";

import { optimizeGlb } from "./lib/optimize.mjs";

const args = process.argv.slice(2);
const [blankPath, printPath, outDir, name] = args.filter((a) => !a.startsWith("--"));
const opt = Object.fromEntries(args.filter((a) => a.startsWith("--")).map((a) => a.slice(2).split("=")));
if (!name) throw new Error("usage: node print-garment.mjs <blank.glb> <print.png> <outDir> <name> [--color=#hex] [--width=f] [--top=f]");
const hex = (opt.color ?? "#1b1b1d").replace("#", "");
const COLOR = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
const WIDTH = Number(opt.width ?? 0.34);
const TOP = Number(opt.top ?? 0.12);
const TEX = 4096;
sharp.cache(false);

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(blankPath);
const prim = doc.getRoot().listMeshes()[0].listPrimitives()[0];
const pos = prim.getAttribute("POSITION").getArray();
const uv = prim.getAttribute("TEXCOORD_0").getArray();
const idx = prim.getIndices().getArray();
const material = prim.getMaterial();

// ---- the garment's extent ----
let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
for (let i = 0; i < pos.length; i += 3) {
  x0 = Math.min(x0, pos[i]); x1 = Math.max(x1, pos[i]); y0 = Math.min(y0, pos[i + 1]); y1 = Math.max(y1, pos[i + 1]);
}
const gw = x1 - x0, gh = y1 - y0;

// ---- the print, and where it goes on the front ----
const print = await sharp(printPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const PW = print.info.width, PH = print.info.height, P = print.data;
const printW = WIDTH * gw;
const printH = (printW * PH) / PW;
const px0 = (x0 + x1) / 2 - printW / 2;
const pyTop = y1 - TOP * gh;
console.log(`${name}: print ${PW}x${PH} -> ${printW.toFixed(3)} x ${printH.toFixed(3)} (garment ${gw.toFixed(3)} x ${gh.toFixed(3)})`);
const samplePrint = (u, v, out) => {
  const fx = u * (PW - 1), fy = v * (PH - 1);
  const ax = Math.floor(fx), ay = Math.floor(fy), bx = Math.min(ax + 1, PW - 1), by = Math.min(ay + 1, PH - 1);
  const tx = fx - ax, ty = fy - ay;
  for (let c = 0; c < 4; c++) {
    const p = (x, y) => P[(y * PW + x) * 4 + c];
    out[c] = (p(ax, ay) * (1 - tx) + p(bx, ay) * tx) * (1 - ty) + (p(ax, by) * (1 - tx) + p(bx, by) * tx) * ty;
  }
};

// ---- the front surface: for each spot of the front view, the depth of the front of the garment, as
// the median of the front-most points around it (so a fold or the hem's flare does not hide the front
// next to it, and a thin thing hanging in front, like a drawstring, does not count as the surface) ----
const GG = 512;
const cell = (X, Y) =>
  Math.min(GG - 1, Math.max(0, Math.floor(((y1 - Y) / gh) * GG))) * GG + Math.min(GG - 1, Math.max(0, Math.floor(((X - x0) / gw) * GG)));
const top = new Float64Array(GG * GG).fill(-Infinity);
for (let i = 0; i < pos.length; i += 3) { const t = cell(pos[i], pos[i + 1]); top[t] = Math.max(top[t], pos[i + 2]); }
const surface = new Float64Array(GG * GG).fill(-Infinity);
{
  const win = [];
  for (let y = 0; y < GG; y++) for (let x = 0; x < GG; x++) {
    win.length = 0;
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
      const yy = y + dy, xx = x + dx;
      if (yy >= 0 && yy < GG && xx >= 0 && xx < GG && top[yy * GG + xx] > -Infinity) win.push(top[yy * GG + xx]);
    }
    if (win.length) { win.sort((a, b) => a - b); surface[y * GG + x] = win[win.length >> 1]; }
  }
}
// Below the surface by more than this: the back of the garment. In front of it by more than STANDOFF
// (when given): something hanging in front of the print, which keeps its own colour.
const BACK = 0.08 * gh;
const STANDOFF = opt.standoff ? Number(opt.standoff) * gh : Infinity;

// ---- the new colour texture: the blank's shading under the garment's colour ----
const baseTex = material.getBaseColorTexture();
const base = await sharp(Buffer.from(baseTex.getImage())).removeAlpha().resize(TEX, TEX, { kernel: "lanczos3" }).raw().toBuffer();
const lum = (i) => 0.2126 * base[i] + 0.7152 * base[i + 1] + 0.0722 * base[i + 2];
const sampleLums = [];
for (let i = 0; i < TEX * TEX * 3; i += 3 * 997) sampleLums.push(lum(i));
sampleLums.sort((a, b) => a - b);
const lit = sampleLums[Math.floor(sampleLums.length * 0.9)]; // the fabric in full light
const toLin = (c) => (c / 255) ** 2.2, toSrgb = (l) => 255 * Math.min(1, Math.max(0, l)) ** (1 / 2.2);
const colorLin = COLOR.map(toLin);
const shadeOf = new Float32Array(TEX * TEX);
const out = Buffer.alloc(TEX * TEX * 3);
for (let t = 0; t < TEX * TEX; t++) {
  // Half of the baked shading: the viewer lights the folds again in real time.
  const s = 0.5 + 0.5 * Math.min(1.08, toLin(lum(t * 3)) / toLin(lit));
  shadeOf[t] = s;
  for (let c = 0; c < 3; c++) out[t * 3 + c] = toSrgb(colorLin[c] * s);
}

// ---- project the print onto the front, texel by texel (at the texture's own resolution: Meshy's
// atlas is made of thin strips, anything coarser leaves stripes) ----
const faceZ = (a, b, c) => {
  const ux = pos[b * 3] - pos[a * 3], uy = pos[b * 3 + 1] - pos[a * 3 + 1], uz = pos[b * 3 + 2] - pos[a * 3 + 2];
  const vx = pos[c * 3] - pos[a * 3], vy = pos[c * 3 + 1] - pos[a * 3 + 1], vz = pos[c * 3 + 2] - pos[a * 3 + 2];
  const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
  return nz / (Math.hypot(nx, ny, nz) || 1);
};
const painted = new Uint8Array(TEX * TEX);
const backOwned = new Uint8Array(TEX * TEX); // texels a back-facing triangle also uses (islands overlap a little)
const raster = (a, b, c, fn) => {
  const ax = uv[a * 2] * TEX, ay = uv[a * 2 + 1] * TEX, bx = uv[b * 2] * TEX, by = uv[b * 2 + 1] * TEX, cx = uv[c * 2] * TEX, cy = uv[c * 2 + 1] * TEX;
  const minX = Math.max(0, Math.floor(Math.min(ax, bx, cx))), maxX = Math.min(TEX - 1, Math.ceil(Math.max(ax, bx, cx)));
  const minY = Math.max(0, Math.floor(Math.min(ay, by, cy))), maxY = Math.min(TEX - 1, Math.ceil(Math.max(ay, by, cy)));
  const d = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
  if (Math.abs(d) < 1e-12) return;
  for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
    const qx = x + 0.5, qy = y + 0.5;
    const w1 = ((by - cy) * (qx - cx) + (cx - bx) * (qy - cy)) / d, w2 = ((cy - ay) * (qx - cx) + (ax - cx) * (qy - cy)) / d, w3 = 1 - w1 - w2;
    if (w1 < -0.02 || w2 < -0.02 || w3 < -0.02) continue;
    fn(y * TEX + x, w1, w2, w3);
  }
};
for (let i = 0; i < idx.length; i += 3) {
  const a = idx[i], b = idx[i + 1], c = idx[i + 2];
  if (faceZ(a, b, c) < -0.2) raster(a, b, c, (t) => { backOwned[t] = 1; });
}
const rgba = new Float64Array(4);
for (let i = 0; i < idx.length; i += 3) {
  const a = idx[i], b = idx[i + 1], c = idx[i + 2];
  // Only triangles in the print's rectangle, facing the front at least a little.
  const f = faceZ(a, b, c);
  if (f < 0.05) continue;
  let inRect = false;
  for (const v of [a, b, c]) {
    const X = pos[v * 3], Y = pos[v * 3 + 1];
    if (X >= px0 - 0.01 && X <= px0 + printW + 0.01 && Y <= pyTop + 0.01 && Y >= pyTop - printH - 0.01) inRect = true;
  }
  if (!inRect) continue;
  raster(a, b, c, (t, w1, w2, w3) => {
    if (backOwned[t]) return;
    const s = Math.max(0, w1) + Math.max(0, w2) + Math.max(0, w3);
    w1 = Math.max(0, w1) / s; w2 = Math.max(0, w2) / s; w3 = Math.max(0, w3) / s;
    const X = w1 * pos[a * 3] + w2 * pos[b * 3] + w3 * pos[c * 3];
    const Y = w1 * pos[a * 3 + 1] + w2 * pos[b * 3 + 1] + w3 * pos[c * 3 + 1];
    const Z = w1 * pos[a * 3 + 2] + w2 * pos[b * 3 + 2] + w3 * pos[c * 3 + 2];
    const surf = surface[cell(X, Y)];
    if (Z < surf - BACK || Z > surf + STANDOFF) return; // the back, or a drawstring in front of the print
    const u = (X - px0) / printW, v = (pyTop - Y) / printH;
    if (u < 0 || u > 1 || v < 0 || v > 1) return;
    samplePrint(u, v, rgba);
    // Fade the print out where the cloth turns away round the sides (as ink does on a real garment).
    const k = (rgba[3] / 255) * Math.min(1, Math.max(0, (f - 0.05) / 0.25));
    if (k <= 0) return;
    // Ink follows the folds too, a little less than the cloth does.
    const shade = 0.25 + 0.75 * shadeOf[t];
    for (let ch = 0; ch < 3; ch++) out[t * 3 + ch] = out[t * 3 + ch] * (1 - k) + toSrgb(toLin(rgba[ch]) * shade) * k;
    painted[t] = 1;
  });
}
// Grow the painted texels into the atlas gutter, so filtering at strip edges shows no seam.
for (let pass = 0; pass < 6; pass++) {
  const grow = [];
  for (let y = 1; y < TEX - 1; y++) for (let x = 1; x < TEX - 1; x++) {
    const t = y * TEX + x;
    if (painted[t]) continue;
    for (const o of [1, -1, TEX, -TEX]) if (painted[t + o] === 1) { grow.push(t, t + o); break; }
  }
  if (!grow.length) break;
  for (let k = 0; k < grow.length; k += 2) {
    const t = grow[k], s = grow[k + 1];
    // Only into texels no triangle uses (the gutter), never over another island.
    if (backOwned[t]) continue;
    out[t * 3] = out[s * 3]; out[t * 3 + 1] = out[s * 3 + 1]; out[t * 3 + 2] = out[s * 3 + 2];
    painted[t] = 2;
  }
  for (let t = 0; t < TEX * TEX; t++) if (painted[t] === 2) painted[t] = 1;
}

baseTex.setImage(new Uint8Array(await sharp(out, { raw: { width: TEX, height: TEX, channels: 3 } }).png({ compressionLevel: 6 }).toBuffer())).setMimeType("image/png");
// Matte cloth: one roughness, no metal.
const mr = material.getMetallicRoughnessTexture();
material.setMetallicRoughnessTexture(null).setRoughnessFactor(0.9).setMetallicFactor(0);
if (mr) mr.dispose();
// The blank's normal map carries the fabric's folds and grain: kept.

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "print-garment-"));
const full = path.join(tmp, `${name}.glb`);
await io.write(full, doc);
const files = await optimizeGlb(full, outDir, name);
fs.rmSync(tmp, { recursive: true, force: true });
console.log("wrote", files.web, files.hd);
