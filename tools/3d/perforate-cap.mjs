// Blasphemous cap fix (round 6): the real cap has laser-perforated side and back panels, which
// Meshy only hinted at, and Meshy invented a scribble on the back (in the texture, the geometry and the
// stored normals). This rebuilds that patch of the surface from a smooth fit, repaints the side and
// back panels as plain fabric and lays a regular staggered grid of holes over them, one grid per
// panel, keeping the side labels untouched. The camera axis and panel limits are this model's.
//
//   node perforate-cap.mjs in.glb out.glb [--spacing 0.072] [--radius 0.0125] [--front-deg 68]
//
// Source: assets-src/round6/models/hat-v2-8k-final.glb -> hat-v2-8k-perforated.glb (not in git: this
// script rebuilds it; the optimised copies live in Shopify Files).
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import sharp from "sharp";

const argv = process.argv.slice(2);
const [input, output] = argv;
const opt = (name, d) => { const i = argv.indexOf("--" + name); return i > 0 ? Number(argv[i + 1]) : d; };
const S = opt("spacing", 0.072), RH = opt("radius", 0.0125), FRONT = (opt("front-deg", 68) * Math.PI) / 180;
const Y0 = opt("y0", -0.3), Y1 = opt("y1", 0.42), CZ = opt("cz", -0.27);
const HOLE = opt("hole", 0.22); // hole colour as a fraction of the fabric colour
const PANEL_SPLIT = (opt("panel-deg", 122) * Math.PI) / 180, SEAM = opt("seam", 0.03); // back/side panel seam, plain margin

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(input);
const prim = doc.getRoot().listMeshes()[0].listPrimitives()[0];
const pos = prim.getAttribute("POSITION").getArray();
const uv = prim.getAttribute("TEXCOORD_0").getArray();
const idx = prim.getIndices().getArray();
const tex = prim.getMaterial().getBaseColorTexture();
const img = await sharp(Buffer.from(tex.getImage())).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const { width: TW, height: TH } = img.info; const B = img.data;

// 0. A mark Meshy modelled high on the back (the real cap is plain there), in the geometry and in the
// stored normals: the patch's fabric is rebuilt from a smooth fit (fading out at the edges) and its
// normals are recomputed from it.
const MARK = { t0: 2.42, t1: 3.06, y0: 0.04, y1: 0.42 };
{
  const nrm = prim.getAttribute("NORMAL").getArray();
  const nv = pos.length / 3;
  // Vertices sharing a position (UV seams) form one group and move together, so the surface stays closed.
  const keys = new Map(), group = new Int32Array(nv);
  for (let v = 0; v < nv; v++) {
    const k = `${Math.round(pos[v * 3] * 1e5)},${Math.round(pos[v * 3 + 1] * 1e5)},${Math.round(pos[v * 3 + 2] * 1e5)}`;
    if (!keys.has(k)) keys.set(k, keys.size);
    group[v] = keys.get(k);
  }
  const G = keys.size, gp = new Float64Array(G * 3), w = new Float64Array(G);
  for (let v = 0; v < nv; v++) for (let c = 0; c < 3; c++) gp[group[v] * 3 + c] = pos[v * 3 + c];
  for (let g = 0; g < G; g++) {
    const x = gp[g * 3], y = gp[g * 3 + 1], th = Math.abs(Math.atan2(x, gp[g * 3 + 2] - CZ));
    if (th < MARK.t0 || th > MARK.t1 || y < MARK.y0 || y > MARK.y1) continue;
    w[g] = Math.min(1, Math.min(th - MARK.t0, MARK.t1 - th, (y - MARK.y0) * 1.6, (MARK.y1 - y) * 1.6) / 0.08);
  }
  // The cap's fabric is two thin faces (outside and inside) over a lining further in. In each small
  // cell of the patch, the fabric is the outermost layer (within 2 cm-units of the cell's outermost
  // point); its outside face (outward normals) is fitted, per side, with a smooth surface
  // r = f(angle, height) (cubic, refitted without the outliers, which are the mark). Both faces then
  // move onto it along the radius, the inside face a fabric's thickness below: the dome keeps its
  // curvature, the mark's ridges and grooves go, and the lining is left as it is.
  const outward = new Uint8Array(G);
  for (let v = 0; v < nv; v++) {
    const g = group[v]; if (!w[g]) continue;
    if (nrm[v * 3] * pos[v * 3] + nrm[v * 3 + 2] * (pos[v * 3 + 2] - CZ) > 0) outward[g] = 1;
  }
  const cellOf = (t, y) => `${Math.floor(t / 0.03)},${Math.floor(y / 0.015)}`;
  const cellR = new Map();
  for (let g = 0; g < G; g++) {
    if (!w[g]) continue;
    const x = gp[g * 3], z = gp[g * 3 + 2], k = cellOf(Math.atan2(x, z - CZ), gp[g * 3 + 1]);
    (cellR.get(k) ?? cellR.set(k, []).get(k)).push(Math.hypot(x, z - CZ));
  }
  const cellTop = new Map([...cellR].map(([k, rs]) => [k, rs.sort((a, b) => a - b)[Math.floor(rs.length * 0.98)]]));
  const LAYER = 0.02;
  const terms = (t, y) => [1, t, y, t * t, t * y, y * y, t * t * t, t * t * y, t * y * y, y * y * y];
  const solve = (A, b) => { // Gaussian elimination with partial pivoting
    const n = b.length, M = A.map((row, i) => [...row, b[i]]);
    for (let i = 0; i < n; i++) {
      let p = i; for (let r = i + 1; r < n; r++) if (Math.abs(M[r][i]) > Math.abs(M[p][i])) p = r;
      [M[i], M[p]] = [M[p], M[i]];
      for (let r = i + 1; r < n; r++) { const f = M[r][i] / M[i][i]; for (let c = i; c <= n; c++) M[r][c] -= f * M[i][c]; }
    }
    const x = new Array(n).fill(0);
    for (let i = n - 1; i >= 0; i--) { let s = M[i][n]; for (let c = i + 1; c < n; c++) s -= M[i][c] * x[c]; x[i] = s / M[i][i]; }
    return x;
  };
  let moved = 0;
  for (const sign of [1, -1]) {
    const shell = [];
    for (let g = 0; g < G; g++) {
      if (!w[g]) continue;
      const x = gp[g * 3], z = gp[g * 3 + 2], th = Math.atan2(x, z - CZ);
      if (Math.sign(th) !== sign) continue;
      const r = Math.hypot(x, z - CZ);
      if (r < cellTop.get(cellOf(th, gp[g * 3 + 1])) - LAYER) continue; // the lining
      shell.push({ g, t: Math.abs(th) - 2.7, y: gp[g * 3 + 1] - 0.2, r, out: outward[g] });
    }
    const outside = shell.filter((p) => p.out);
    let use = outside, coef = null, sd = 0;
    for (let pass = 0; pass < 4; pass++) {
      const A = Array.from({ length: 10 }, () => new Array(10).fill(0)), b = new Array(10).fill(0);
      for (const p of use) { const f = terms(p.t, p.y); for (let i = 0; i < 10; i++) { b[i] += f[i] * p.r; for (let j = 0; j < 10; j++) A[i][j] += f[i] * f[j]; } }
      coef = solve(A, b);
      const res = outside.map((p) => p.r - terms(p.t, p.y).reduce((s, f, i) => s + f * coef[i], 0));
      sd = Math.sqrt(use.reduce((s, p) => { const e = p.r - terms(p.t, p.y).reduce((q, f, i) => q + f * coef[i], 0); return s + e * e; }, 0) / use.length);
      use = outside.filter((_, i) => Math.abs(res[i]) < 2 * sd);
    }
    const fitOf = (p) => terms(p.t, p.y).reduce((s, f, i) => s + f * coef[i], 0);
    // The fabric's thickness: how far the inside face sits below the outside one (median).
    const gaps = shell.filter((p) => !p.out).map((p) => fitOf(p) - p.r).filter((d) => d > 0 && d < LAYER).sort((a, b) => a - b);
    const thickness = gaps.length ? gaps[gaps.length >> 1] : 0.003;
    console.log(`side ${sign}: fabric ${shell.length} points, fit residual ${(sd * 1000).toFixed(2)}e-3, thickness ${(thickness * 1000).toFixed(2)}e-3`);
    for (const p of shell) {
      const target = fitOf(p) - (p.out ? 0 : thickness);
      const r = p.r + w[p.g] * (target - p.r), x = gp[p.g * 3], z = gp[p.g * 3 + 2], k = r / p.r;
      gp[p.g * 3] = x * k; gp[p.g * 3 + 2] = CZ + (z - CZ) * k;
      moved++;
    }
  }
  const nbrs = new Map();
  for (let t = 0; t < idx.length; t += 3) {
    const gs = [group[idx[t]], group[idx[t + 1]], group[idx[t + 2]]];
    for (let i = 0; i < 3; i++) if (w[gs[i]]) for (let j = 0; j < 3; j++) if (i !== j) (nbrs.get(gs[i]) ?? nbrs.set(gs[i], new Set()).get(gs[i])).add(gs[j]);
  }
  const moving = [...nbrs.keys()];
  for (let v = 0; v < nv; v++) if (w[group[v]]) for (let c = 0; c < 3; c++) pos[v * 3 + c] = gp[group[v] * 3 + c];
  // Normals of the patch (and its rim), from the faces around each group.
  const acc = new Map();
  for (let t = 0; t < idx.length; t += 3) {
    const [a, b, c] = [idx[t], idx[t + 1], idx[t + 2]];
    const gs = [group[a], group[b], group[c]];
    if (!gs.some((g) => w[g] || nbrs.has(g))) continue;
    const ux = pos[b * 3] - pos[a * 3], uy = pos[b * 3 + 1] - pos[a * 3 + 1], uz = pos[b * 3 + 2] - pos[a * 3 + 2];
    const vx = pos[c * 3] - pos[a * 3], vy = pos[c * 3 + 1] - pos[a * 3 + 1], vz = pos[c * 3 + 2] - pos[a * 3 + 2];
    const n = [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx];
    for (const g of gs) { const s = acc.get(g) ?? [0, 0, 0]; acc.set(g, [s[0] + n[0], s[1] + n[1], s[2] + n[2]]); }
  }
  let renormed = 0;
  for (let v = 0; v < nv; v++) {
    const g = group[v]; if (!w[g]) continue;
    const n = acc.get(g); const l = Math.hypot(...n) || 1;
    // Blend towards the recomputed normal by the patch weight, so the patch edge does not show.
    const m = [0, 1, 2].map((c) => nrm[v * 3 + c] * (1 - w[g]) + (n[c] / l) * w[g]);
    const ml = Math.hypot(...m) || 1;
    for (let c = 0; c < 3; c++) nrm[v * 3 + c] = m[c] / ml;
    renormed++;
  }
  prim.getAttribute("POSITION").setArray(pos); prim.getAttribute("NORMAL").setArray(nrm);
  console.log("projected", moved, "positions; normals recomputed for", renormed, "vertices");
}

// Crown profile: the outer surface's radius around the axis (x = 0, z = CZ) per height (the 90th
// percentile of the crown's vertices, so the inner lining does not pull it in), smoothed.
const STEP = 0.02, NY = Math.round(1 / STEP) + 1, yIndex = (y) => Math.round((y + 0.5) / STEP);
const radii = Array.from({ length: NY }, () => []);
for (let i = 0; i < pos.length; i += 3) {
  const x = pos[i], y = pos[i + 1], z = pos[i + 2];
  if (z > 0.42 && y < -0.2) continue; // the brim
  const k = yIndex(y); if (k < 0 || k >= NY) continue;
  if (Math.abs(Math.atan2(x, z - CZ)) < FRONT) continue;
  radii[k].push(Math.hypot(x, z - CZ));
}
const raw = radii.map((r) => (r.length ? r.sort((p, q) => p - q)[Math.floor(r.length * 0.9)] : NaN));
for (let k = 1; k < NY; k++) if (Number.isNaN(raw[k])) raw[k] = raw[k - 1];
for (let k = NY - 2; k >= 0; k--) if (Number.isNaN(raw[k])) raw[k] = raw[k + 1];
const R = raw.map((_, k) => { let s = 0, n = 0; for (let j = k - 3; j <= k + 3; j++) if (j >= 0 && j < NY) { s += raw[j]; n++; } return s / n; });
// v = arc length along the panel from y = 0, so rows stay evenly spaced where the crown curves over.
const V = new Float64Array(NY); const k0 = yIndex(0);
for (let k = k0 + 1; k < NY; k++) V[k] = V[k - 1] + Math.hypot(STEP, R[k] - R[k - 1]);
for (let k = k0 - 1; k >= 0; k--) V[k] = V[k + 1] - Math.hypot(STEP, R[k] - R[k + 1]);
const lerp = (arr, y) => { const f = (y + 0.5) / STEP, k = Math.max(0, Math.min(NY - 2, Math.floor(f))), t = f - k; return arr[k] * (1 - t) + arr[k + 1] * t; };

const inPanels = (x, y, z) => y > Y0 - 0.04 && y < Y1 + 0.05 && Math.abs(Math.atan2(x, z - CZ)) >= FRONT - 0.06;
const lum = (o) => (B[o] + B[o + 1] + B[o + 2]) / 3;

// Walk every texel of every panel triangle, with its 3D position.
function forTexels(fn) {
  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t], b = idx[t + 1], c = idx[t + 2];
    const cx = (pos[a * 3] + pos[b * 3] + pos[c * 3]) / 3, cy = (pos[a * 3 + 1] + pos[b * 3 + 1] + pos[c * 3 + 1]) / 3, czz = (pos[a * 3 + 2] + pos[b * 3 + 2] + pos[c * 3 + 2]) / 3;
    if (!inPanels(cx, cy, czz)) continue;
    const P = [a, b, c].map((v) => [uv[v * 2] * TW, uv[v * 2 + 1] * TH]);
    const minX = Math.max(0, Math.floor(Math.min(P[0][0], P[1][0], P[2][0]))), maxX = Math.min(TW - 1, Math.ceil(Math.max(P[0][0], P[1][0], P[2][0])));
    const minY = Math.max(0, Math.floor(Math.min(P[0][1], P[1][1], P[2][1]))), maxY = Math.min(TH - 1, Math.ceil(Math.max(P[0][1], P[1][1], P[2][1])));
    const d = (P[1][1] - P[2][1]) * (P[0][0] - P[2][0]) + (P[2][0] - P[1][0]) * (P[0][1] - P[2][1]);
    if (Math.abs(d) < 1e-9) continue;
    for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
      const w1 = ((P[1][1] - P[2][1]) * (x + 0.5 - P[2][0]) + (P[2][0] - P[1][0]) * (y + 0.5 - P[2][1])) / d;
      const w2 = ((P[2][1] - P[0][1]) * (x + 0.5 - P[2][0]) + (P[0][0] - P[2][0]) * (y + 0.5 - P[2][1])) / d;
      const w3 = 1 - w1 - w2;
      if (w1 < -0.03 || w2 < -0.03 || w3 < -0.03) continue;
      const px = w1 * pos[a * 3] + w2 * pos[b * 3] + w3 * pos[c * 3];
      const py = w1 * pos[a * 3 + 1] + w2 * pos[b * 3 + 1] + w3 * pos[c * 3 + 1];
      const pz = w1 * pos[a * 3 + 2] + w2 * pos[b * 3 + 2] + w3 * pos[c * 3 + 2];
      fn((y * TW + x) * 4, px, py, pz);
    }
  }
}

// 1. The side labels: the densest run of light texels low on each side (stray light specks elsewhere
// are ignored). Their (angle, height) boxes, with a margin, stay as they are.
const BIN = 0.02, light = { L: [], R: [] };
forTexels((o, x, y, z) => {
  const th = Math.atan2(x, z - CZ);
  if (y > 0 || y < -0.36 || Math.abs(th) < 1.0 || Math.abs(th) > 1.9 || lum(o) < 90) return; // the labels sit mid-side
  light[th > 0 ? "R" : "L"].push([th, y]);
});
const boxes = {};
for (const [side, pts] of Object.entries(light)) {
  if (pts.length < 200) continue;
  const hist = new Map();
  for (const [th] of pts) { const b = Math.floor(th / BIN); hist.set(b, (hist.get(b) ?? 0) + 1); }
  const [peak, top] = [...hist].sort((p, q) => q[1] - p[1])[0];
  let b0 = peak, b1 = peak;
  while ((hist.get(b0 - 1) ?? 0) > top * 0.04 || (hist.get(b0 - 2) ?? 0) > top * 0.04) b0--;
  while ((hist.get(b1 + 1) ?? 0) > top * 0.04 || (hist.get(b1 + 2) ?? 0) > top * 0.04) b1++;
  const ys = pts.filter(([th]) => th >= b0 * BIN && th < (b1 + 1) * BIN).map(([, y]) => y).sort((p, q) => p - q);
  boxes[side] = { t0: b0 * BIN, t1: (b1 + 1) * BIN, y0: ys[Math.floor(ys.length * 0.01)], y1: ys[Math.floor(ys.length * 0.99)] };
}
console.log("labels", JSON.stringify(boxes));
const M = 0.05; // margin, radians / model units
const inLabel = (th, y) => Object.values(boxes).some((bx) => bx && th > bx.t0 - M && th < bx.t1 + M && y > bx.y0 - M && y < bx.y1 + M);

// 2. The fabric colour: median of the panels' dark texels.
const hist = [[], [], []];
let n = 0;
forTexels((o) => { if (n++ % 97 || lum(o) > 60) return; for (let c = 0; c < 3; c++) hist[c].push(B[o + c]); });
const fabric = hist.map((h) => h.sort((p, q) => p - q)[h.length >> 1]);
console.log("fabric", fabric);

// 3. Plain fabric, then the holes (staggered rows, soft 1-texel edge).
let holes = 0;
const seen = new Uint8Array(TW * TH);
forTexels((o, x, y, z) => {
  const p = o >> 2; if (seen[p]) return; seen[p] = 1;
  const th = Math.atan2(x, z - CZ);
  if (Math.abs(th) < FRONT - 0.06 || inLabel(th, y)) return;
  for (let c = 0; c < 3; c++) B[o + c] = fabric[c];
  // Around the mark, also the pale texels just outside the triangles (island borders), which the
  // renderer blends in at the edges.
  const ath = Math.abs(th);
  if (ath > MARK.t0 && ath < MARK.t1 && y > MARK.y0 && y < MARK.y1) {
    const px = p % TW, py = (p - px) / TW;
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
      const qx = px + dx, qy = py + dy; if (qx < 0 || qy < 0 || qx >= TW || qy >= TH) continue;
      const q = (qy * TW + qx) * 4; if (!seen[q >> 2] && lum(q) > 45) for (let c = 0; c < 3; c++) B[q + c] = fabric[c];
    }
  }
  if (y < Y0 || y > Y1 || Math.abs(th) > Math.PI - 0.05 || Math.abs(th) < FRONT) return;
  // One grid per panel, as on the real cap: the side panels (front seam to 120°) and the back panels
  // (120° to the centre seam), each measured from its own middle so the grid does not shear as the
  // crown narrows, with a plain margin along the seams.
  const a = Math.abs(th), side = Math.sign(th);
  const panel = a < PANEL_SPLIT ? [FRONT, PANEL_SPLIT] : [PANEL_SPLIT, Math.PI];
  const mid = (panel[0] + panel[1]) / 2, r = lerp(R, y);
  if ((a - panel[0]) * r < SEAM || (panel[1] - a) * r < SEAM) return;
  const u = (a - mid) * r * side, v = lerp(V, y);
  const row = Math.round(v / S), off = row & 1 ? S / 2 : 0;
  const cu = Math.round((u - off) / S) * S + off, cv = row * S;
  const cth = (mid + (cu * side) / r) * side;
  if (Math.abs(cth) < FRONT || inLabel(cth, y)) return;
  const dist = Math.hypot(u - cu, v - cv);
  if (dist > RH) return;
  const edge = Math.min(1, (RH - dist) / (RH * 0.25));
  const f = 1 - edge * (1 - HOLE);
  for (let c = 0; c < 3; c++) B[o + c] = Math.round(fabric[c] * f);
  holes++;
});
console.log("hole texels", holes);

// 3b. The gaps between texture islands keep Meshy's grey filler, which the light web model (fewer
// triangles, smaller texture) picks up at island edges as flecks. Gap texels next to the repainted
// panels take the colour of the nearest panel texel (up to 12 texels out); texels of other islands
// (a coverage mask of every triangle) are never touched.
{
  const covered = new Uint8Array(TW * TH);
  for (let t = 0; t < idx.length; t += 3) {
    const P = [idx[t], idx[t + 1], idx[t + 2]].map((v) => [uv[v * 2] * TW, uv[v * 2 + 1] * TH]);
    const minX = Math.max(0, Math.floor(Math.min(P[0][0], P[1][0], P[2][0]))), maxX = Math.min(TW - 1, Math.ceil(Math.max(P[0][0], P[1][0], P[2][0])));
    const minY = Math.max(0, Math.floor(Math.min(P[0][1], P[1][1], P[2][1]))), maxY = Math.min(TH - 1, Math.ceil(Math.max(P[0][1], P[1][1], P[2][1])));
    const d = (P[1][1] - P[2][1]) * (P[0][0] - P[2][0]) + (P[2][0] - P[1][0]) * (P[0][1] - P[2][1]);
    if (Math.abs(d) < 1e-12) continue;
    for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
      const w1 = ((P[1][1] - P[2][1]) * (x + 0.5 - P[2][0]) + (P[2][0] - P[1][0]) * (y + 0.5 - P[2][1])) / d;
      const w2 = ((P[2][1] - P[0][1]) * (x + 0.5 - P[2][0]) + (P[0][0] - P[2][0]) * (y + 0.5 - P[2][1])) / d;
      if (w1 >= -0.01 && w2 >= -0.01 && 1 - w1 - w2 >= -0.01) covered[y * TW + x] = 1;
    }
  }
  let frontier = [];
  for (let p = 0; p < TW * TH; p++) if (seen[p]) frontier.push(p);
  const done = seen.slice();
  let filled = 0;
  for (let ring = 0; ring < 12 && frontier.length; ring++) {
    const next = [];
    for (const p of frontier) {
      const x = p % TW, y = (p - x) / TW;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const qx = x + dx, qy = y + dy;
        if (qx < 0 || qy < 0 || qx >= TW || qy >= TH) continue;
        const q = qy * TW + qx;
        if (done[q] || covered[q]) continue;
        done[q] = 1;
        for (let c = 0; c < 3; c++) B[q * 4 + c] = B[p * 4 + c];
        next.push(q); filled++;
      }
    }
    frontier = next;
  }
  console.log("gap texels filled", filled);
}

// 4. A mark Meshy left in the relief (normal map) high on the back: flattened to plain fabric.
const SCRUB = MARK;
const ntex = prim.getMaterial().getNormalTexture();
const nimg = await sharp(Buffer.from(ntex.getImage())).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const NW = nimg.info.width, NH = nimg.info.height, NB = nimg.data;
let scrubbed = 0;
forTexels((o, x, y, z) => {
  const th = Math.abs(Math.atan2(x, z - CZ));
  if (th < SCRUB.t0 || th > SCRUB.t1 || y < SCRUB.y0 || y > SCRUB.y1) return;
  const p = o >> 2, tx = Math.floor(((p % TW) * NW) / TW), ty = Math.floor((Math.floor(p / TW) * NH) / TH);
  const q = (ty * NW + tx) * 4;
  if (NB[q] === 128 && NB[q + 1] === 128) return;
  NB[q] = 128; NB[q + 1] = 128; NB[q + 2] = 255; scrubbed++;
});
console.log("relief texels flattened", scrubbed);
ntex.setImage(new Uint8Array(await sharp(NB, { raw: { width: NW, height: NH, channels: 4 } }).png().toBuffer())).setMimeType("image/png");
const png = await sharp(B, { raw: { width: TW, height: TH, channels: 4 } }).png().toBuffer();
tex.setImage(new Uint8Array(png)).setMimeType("image/png");
await io.write(output, doc);
console.log("wrote", output);
