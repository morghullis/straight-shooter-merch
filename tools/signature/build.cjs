// Builds the hero signature as a "being written" SVG: the outline of the text set in the signature
// font (filled) plus the pen strokes that reveal it, found by thinning the rendered letters to a
// one-pixel skeleton and following it the way a pen would.
//
// usage: node tools/signature/build.cjs [text]
// needs: `npm install` in this folder, and Google Chrome installed.
// writes: src/components/brand/signature-paths.ts
const fs = require("fs");
const path = require("path");
const opentype = require("opentype.js");
const { chromium } = require("playwright-core");

const ROOT = path.resolve(__dirname, "../..");
const TEXT = process.argv[2] || "Stephen A.";
const UNITS = 100; // path units per em
const SCALE = 6; // raster pixels per path unit when tracing

const font = opentype.loadSync(path.join(__dirname, "MrDeHaviland-Regular.ttf"));
const glyphPath = font.getPath(TEXT, 0, 0, UNITS, { kerning: true });
const box = glyphPath.getBoundingBox();
const advance = font.getAdvanceWidth(TEXT, UNITS, { kerning: true });
const fill = glyphPath.toPathData(2);

// Where the baseline sits in a line box of line-height 1 (CSS uses the hhea metrics).
const asc = font.tables.hhea.ascender / font.unitsPerEm;
const desc = font.tables.hhea.descender / font.unitsPerEm;
const baselineFromTop = (1 - (asc - desc)) / 2 + asc;

// In the browser: rasterise, thin, trace. Returns polylines in raster pixels.
function trace({ d, box, scale }) {
  const pad = 8;
  const W = Math.ceil((box.x2 - box.x1) * scale) + pad * 2;
  const H = Math.ceil((box.y2 - box.y1) * scale) + pad * 2;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  ctx.translate(pad - box.x1 * scale, pad - box.y1 * scale);
  ctx.scale(scale, scale);
  ctx.fill(new Path2D(d));
  const data = ctx.getImageData(0, 0, W, H).data;
  const img = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) img[i] = data[i * 4 + 3] > 127 ? 1 : 0;

  // Distance to the nearest background pixel (two-pass chamfer), for the stroke widths.
  const dist = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) dist[i] = img[i] ? 1e9 : 0;
  const at = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? 0 : dist[y * W + x]);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (!img[i]) continue;
      dist[i] = Math.min(dist[i], at(x - 1, y) + 1, at(x, y - 1) + 1, at(x - 1, y - 1) + 1.414, at(x + 1, y - 1) + 1.414);
    }
  for (let y = H - 1; y >= 0; y--)
    for (let x = W - 1; x >= 0; x--) {
      const i = y * W + x;
      if (!img[i]) continue;
      dist[i] = Math.min(dist[i], at(x + 1, y) + 1, at(x, y + 1) + 1, at(x + 1, y + 1) + 1.414, at(x - 1, y + 1) + 1.414);
    }

  // Zhang-Suen thinning.
  const sk = img.slice();
  const P = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? 0 : sk[y * W + x]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const pass of [0, 1]) {
      const kill = [];
      for (let y = 1; y < H - 1; y++)
        for (let x = 1; x < W - 1; x++) {
          if (!sk[y * W + x]) continue;
          const n = [P(x, y - 1), P(x + 1, y - 1), P(x + 1, y), P(x + 1, y + 1), P(x, y + 1), P(x - 1, y + 1), P(x - 1, y), P(x - 1, y - 1)];
          const b = n.reduce((a, v) => a + v, 0);
          if (b < 2 || b > 6) continue;
          let a = 0;
          for (let k = 0; k < 8; k++) if (!n[k] && n[(k + 1) % 8]) a++;
          if (a !== 1) continue;
          if (pass === 0 ? n[0] * n[2] * n[4] || n[2] * n[4] * n[6] : n[0] * n[2] * n[6] || n[0] * n[4] * n[6]) continue;
          kill.push(y * W + x);
        }
      for (const i of kill) sk[i] = 0;
      if (kill.length) changed = true;
    }
  }

  // Graph: skeleton pixels, their 8-neighbours, nodes = ends and junctions.
  const N8 = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
  const nbrs = (i) => {
    const x = i % W, y = (i / W) | 0, out = [];
    for (const [dx, dy] of N8) {
      const xx = x + dx, yy = y + dy;
      if (xx >= 0 && yy >= 0 && xx < W && yy < H && sk[yy * W + xx]) out.push(yy * W + xx);
    }
    return out;
  };
  const pixels = [];
  for (let i = 0; i < W * H; i++) if (sk[i]) pixels.push(i);
  const isNode = new Uint8Array(W * H);
  for (const i of pixels) if (nbrs(i).length !== 2) isNode[i] = 1;
  const xy = (i) => [i % W, (i / W) | 0];

  // Neighbouring node pixels (a junction is often a small clump) count as one node.
  const cluster = new Int32Array(W * H).fill(-1);
  const centres = [];
  for (const i of pixels) {
    if (!isNode[i] || cluster[i] >= 0) continue;
    const id = centres.length;
    const stack = [i];
    cluster[i] = id;
    const members = [];
    while (stack.length) {
      const c = stack.pop();
      members.push(c);
      for (const n of nbrs(c)) if (isNode[n] && cluster[n] < 0) (cluster[n] = id), stack.push(n);
    }
    const cx = members.reduce((a, m) => a + xy(m)[0], 0) / members.length;
    const cy = members.reduce((a, m) => a + xy(m)[1], 0) / members.length;
    centres.push({ x: cx, y: cy, degree: 0, end: members.length === 1 && nbrs(members[0]).length === 1 });
  }

  // Edges: from a node, walk along ordinary pixels to the next node.
  const seen = new Uint8Array(W * H);
  const edges = [];
  for (const i of pixels) {
    if (!isNode[i]) continue;
    for (const first of nbrs(i)) {
      if (isNode[first] || seen[first]) continue;
      const line = [i, first];
      seen[first] = 1;
      let prev = i, cur = first;
      for (;;) {
        const next = nbrs(cur).find((n) => n !== prev && (isNode[n] || !seen[n]) && !(isNode[n] && cluster[n] === cluster[i] && line.length < 3));
        if (next === undefined) break;
        line.push(next);
        if (isNode[next]) break;
        seen[next] = 1;
        prev = cur;
        cur = next;
      }
      const last = line[line.length - 1];
      edges.push({ pts: line.map(xy), a: cluster[i], b: isNode[last] ? cluster[last] : -1, px: line });
    }
  }
  // Closed loops with no node on them.
  for (const i of pixels) {
    if (isNode[i] || seen[i]) continue;
    const line = [i];
    seen[i] = 1;
    let prev = -1, cur = i;
    for (;;) {
      const next = nbrs(cur).find((n) => n !== prev && !seen[n]);
      if (next === undefined) break;
      seen[next] = 1;
      line.push(next);
      prev = cur;
      cur = next;
    }
    if (line.length > 6) edges.push({ pts: line.map(xy), a: -1, b: -1, px: line });
  }
  for (const e of edges) {
    if (e.a >= 0) centres[e.a].degree++;
    if (e.b >= 0) centres[e.b].degree++;
  }
  // Drop short spurs off a junction (thinning noise).
  const spur = (e) => e.pts.length < 0.04 * H && ((e.a >= 0 && centres[e.a].end && e.b >= 0 && centres[e.b].degree > 2) || (e.b >= 0 && centres[e.b].end && e.a >= 0 && centres[e.a].degree > 2));
  const kept = edges.filter((e) => !spur(e));

  // Pen order: start at the leftmost free end; at a junction carry on along the straightest way;
  // when stuck, lift the pen and go to the nearest unvisited edge (preferring the way we write).
  const remaining = new Set(kept.map((_, k) => k));
  const angleOf = (a, b) => Math.atan2(b[1] - a[1], b[0] - a[0]);
  const ends = (e, rev) => (rev ? [e.b, e.a] : [e.a, e.b]);
  const strokes = [];
  let pen = null;
  while (remaining.size) {
    let best = null;
    for (const k of remaining) {
      const e = kept[k];
      for (const rev of [false, true]) {
        const p = rev ? e.pts[e.pts.length - 1] : e.pts[0];
        // Prefer starting at a free end, from the left, near where the pen is.
        const startNode = ends(e, rev)[0];
        const free = startNode < 0 || centres[startNode].degree === 1 ? 0 : 25;
        // Written from left to right: the leftmost piece left comes next, the nearer the better.
        const cost = p[0] + (pen ? 0.25 * Math.hypot(p[0] - pen[0], p[1] - pen[1]) : 0) + free;
        if (!best || cost < best.cost) best = { k, rev, cost };
      }
    }
    let pts = [];
    let px = [];
    let { k, rev } = best;
    for (;;) {
      remaining.delete(k);
      const e = kept[k];
      const ep = rev ? e.pts.slice().reverse() : e.pts;
      const epx = rev ? e.px.slice().reverse() : e.px;
      pts = pts.concat(pts.length ? ep.slice(1) : ep);
      px = px.concat(epx);
      const node = ends(e, rev)[1];
      if (node < 0) break;
      const dir = angleOf(ep[Math.max(0, ep.length - 8)], ep[ep.length - 1]);
      let next = null;
      for (const kk of remaining) {
        const c = kept[kk];
        for (const r of [false, true]) {
          if (ends(c, r)[0] !== node) continue;
          const cp = r ? c.pts.slice().reverse() : c.pts;
          const turn = Math.abs(((angleOf(cp[0], cp[Math.min(cp.length - 1, 8)]) - dir + 3 * Math.PI) % (2 * Math.PI)) - Math.PI);
          if (!next || turn < next.turn) next = { k: kk, rev: r, turn };
        }
      }
      if (!next || next.turn > 2.3) break;
      ({ k, rev } = next);
    }
    let width = 0;
    for (const i of px) width = Math.max(width, dist[i]);
    // Thinning stops short of the tips: carry each end on along its own direction.
    const extend = (from, to) => {
      const len = Math.hypot(to[0] - from[0], to[1] - from[1]) || 1;
      const k = (width + 3) / len;
      return [to[0] + (to[0] - from[0]) * k, to[1] + (to[1] - from[1]) * k];
    };
    if (pts.length > 2) {
      pts.unshift(extend(pts[Math.min(6, pts.length - 1)], pts[0]));
      pts.push(extend(pts[Math.max(0, pts.length - 7)], pts[pts.length - 1]));
    }
    strokes.push({ pts, width });
    pen = pts[pts.length - 1];
  }

  // Whatever the strokes still miss (dots, blunt tips) gets a short stroke of its own, in writing order.
  const cover = document.createElement("canvas");
  cover.width = W;
  cover.height = H;
  const cc = cover.getContext("2d");
  cc.lineCap = "round";
  cc.lineJoin = "round";
  for (const st of strokes) {
    cc.lineWidth = 2 * st.width + 3;
    cc.beginPath();
    st.pts.forEach(([x, y], i) => (i ? cc.lineTo(x, y) : cc.moveTo(x, y)));
    cc.stroke();
  }
  const covered = cc.getImageData(0, 0, W, H).data;
  const miss = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) miss[i] = img[i] && covered[i * 4 + 3] < 128 ? 1 : 0;
  const label = new Int32Array(W * H).fill(-1);
  for (let i = 0; i < W * H; i++) {
    if (!miss[i] || label[i] >= 0) continue;
    const stack = [i];
    label[i] = i;
    let minx = W, maxx = 0, miny = H, maxy = 0, n = 0;
    while (stack.length) {
      const c = stack.pop();
      const [x, y] = xy(c);
      n++;
      minx = Math.min(minx, x); maxx = Math.max(maxx, x); miny = Math.min(miny, y); maxy = Math.max(maxy, y);
      for (const [dx, dy] of N8) {
        const xx = x + dx, yy = y + dy, j = yy * W + xx;
        if (xx >= 0 && yy >= 0 && xx < W && yy < H && miss[j] && label[j] < 0) (label[j] = i), stack.push(j);
      }
    }
    if (n < 12) continue;
    const r = Math.min(maxx - minx, maxy - miny) / 2;
    const cy = (miny + maxy) / 2, cx = (minx + maxx) / 2;
    const pts = maxx - minx >= maxy - miny ? [[minx + r, cy], [maxx - r, cy]] : [[cx, miny + r], [cx, maxy - r]];
    const dot = { pts, width: r + 1 };
    let at = strokes.length;
    while (at > 0 && strokes[at - 1].pts[0][0] > cx) at--;
    strokes.splice(at, 0, dot);
  }
  return { strokes, pad, W, H };
}

// Ramer-Douglas-Peucker, then a light smoothing so the strokes are curves, not stairs.
function simplify(pts, eps) {
  if (pts.length < 3) return pts;
  const [a, b] = [pts[0], pts[pts.length - 1]];
  let max = 0, idx = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const p = pts[i];
    const d = Math.abs((b[1] - a[1]) * p[0] - (b[0] - a[0]) * p[1] + b[0] * a[1] - b[1] * a[0]) / (Math.hypot(b[1] - a[1], b[0] - a[0]) || 1);
    if (d > max) [max, idx] = [d, i];
  }
  if (max <= eps) return [a, b];
  return simplify(pts.slice(0, idx + 1), eps).slice(0, -1).concat(simplify(pts.slice(idx), eps));
}
function smooth(pts) {
  if (pts.length < 3) return pts;
  return pts.map((p, i) => (i === 0 || i === pts.length - 1 ? p : [(pts[i - 1][0] + 2 * p[0] + pts[i + 1][0]) / 4, (pts[i - 1][1] + 2 * p[1] + pts[i + 1][1]) / 4]));
}
const r2 = (n) => Math.round(n * 100) / 100;

(async () => {
  const browser = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true });
  const page = await browser.newPage();
  const raw = await page.evaluate(trace, { d: fill, box, scale: SCALE });
  await browser.close();

  // Back to path units (the same space as `fill`).
  const toUnit = ([x, y]) => [r2((x - raw.pad) / SCALE + box.x1), r2((y - raw.pad) / SCALE + box.y1)];
  const strokes = raw.strokes
    .map((s) => {
      const pts = smooth(simplify(s.pts, 0.9)).map(toUnit);
      const length = pts.reduce((sum, p, i) => (i ? sum + Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) : 0), 0);
      return { d: "M" + pts.map((p) => p.join(" ")).join("L"), width: r2((2 * s.width + 3) / SCALE), length: r2(length) };
    })
    .filter((s) => s.length > 0.3);

  // The crossbar through the "A.", where the hero design put it (em from the line top), drawn last.
  const crossY = r2((2.6875 / 4.8125 - baselineFromTop) * UNITS);
  const crossX = r2((10.0625 / 4.8125) * UNITS);
  const crossbar = { x1: crossX, x2: r2(crossX + UNITS), y: crossY };

  const pad = 2;
  const right = Math.max(box.x2, crossbar.x2);
  const viewBox = [r2(box.x1 - pad), r2(box.y1 - pad), r2(right - box.x1 + 2 * pad), r2(Math.max(box.y2, crossY) - box.y1 + 2 * pad)];
  const out = `// Generated by tools/signature/build.cjs from Mr De Haviland (SIL Open Font License). Do not edit by hand.
// Units: ${UNITS} per em, origin at the start of the baseline.

export const signature = ${JSON.stringify(
    { text: TEXT, unitsPerEm: UNITS, advance: r2(advance), baselineFromTop: r2(baselineFromTop * UNITS), viewBox, fill, strokes, crossbar },
    null,
    2,
  )} as const;
`;
  fs.writeFileSync(path.join(ROOT, "src/components/brand/signature-paths.ts"), out);
  console.log(`${strokes.length} pen strokes, total length ${r2(strokes.reduce((a, s) => a + s.length, 0))} units; advance ${r2(advance)}; viewBox ${viewBox.join(" ")}`);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
