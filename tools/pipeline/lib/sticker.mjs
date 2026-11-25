// A discount's sticker: what Meshy is asked for, and the free part after it (cutting it out, checking it).
import { createRequire } from "node:module";

// sharp belongs to the 3D tools, which the Action installs only when there is something to make.
const loadSharp = () => createRequire(new URL("../../3d/package.json", import.meta.url))("sharp");

export const CREDITS = 9; // nano-banana-pro, image to image
export const SIZE = 640;

/** No percentage in the picture: the site writes it, so the sticker stays right when the discount changes. */
export const prompt = () =>
  "A single round die-cut sale sticker, seen perfectly straight on, centred, filling most of the frame: a round seal with a crisp " +
  "starburst edge all the way around, thin gold foil outline, and a wide outer ring of bold flat colour blocks using ONLY the colour " +
  "palette of the printed artwork in the reference photo. The whole centre (about 68 percent of the width) is one flat, empty, matte " +
  "black disc with a thin gold foil rim and nothing on it. Slightly worn printed vinyl texture, no peeling corner, no shadow, no ribbon. " +
  "Absolutely no letters, no numbers, no words, no logos, no people, no clothing. The background is one perfectly flat, uniform, pure " +
  "magenta (#FF00FF).";

const isBackground = (r, g, b) => r > 170 && b > 170 && g < 110 && Math.abs(r - b) < 70;

/**
 * The sticker without its magenta background: what can be reached from the border is cleared (a magenta
 * or purple inside the sticker stays), the edge is softened and the magenta it picked up taken out.
 * Returns { webp, ok, why }: `ok` only for a whole sticker with an empty black centre to write on.
 */
export async function cutOut(input) {
  const sharp = loadSharp();
  const { data, info } = await sharp(input).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  const at = (i) => isBackground(data[i * 3], data[i * 3 + 1], data[i * 3 + 2]);

  const outside = new Uint8Array(w * h);
  const queue = [];
  const push = (i) => {
    if (!outside[i] && at(i)) {
      outside[i] = 1;
      queue.push(i);
    }
  };
  for (let x = 0; x < w; x++) (push(x), push((h - 1) * w + x));
  for (let y = 0; y < h; y++) (push(y * w), push(y * w + w - 1));
  while (queue.length) {
    const i = queue.pop();
    const x = i % w;
    if (x > 0) push(i - 1);
    if (x < w - 1) push(i + 1);
    if (i >= w) push(i - w);
    if (i < w * (h - 1)) push(i + w);
  }

  const alpha = Buffer.alloc(w * h);
  for (let i = 0; i < w * h; i++) alpha[i] = outside[i] ? 0 : 255;
  // Two pixels in, so the mixed edge goes; then a soft edge.
  const soft = await sharp(alpha, { raw: { width: w, height: h, channels: 1 } }).blur(2).linear(2.2, -215).toColourspace("b-w").raw().toBuffer();
  const edge = await sharp(alpha, { raw: { width: w, height: h, channels: 1 } }).blur(5).toColourspace("b-w").raw().toBuffer();

  const out = Buffer.alloc(w * h * 4);
  let x0 = w, x1 = 0, y0 = h, y1 = 0, kept = 0;
  for (let i = 0; i < w * h; i++) {
    let [r, g, b] = [data[i * 3], data[i * 3 + 1], data[i * 3 + 2]];
    if (edge[i] < 250 && b > g && r > g) {
      const spill = Math.min(r, b) - g;
      r -= spill * 0.6;
      b -= spill;
    }
    out[i * 4] = r;
    out[i * 4 + 1] = g;
    out[i * 4 + 2] = b;
    out[i * 4 + 3] = soft[i];
    if (soft[i] > 40) {
      kept++;
      const x = i % w, y = (i - x) / w;
      x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    }
  }
  if (!kept) return { webp: null, ok: false, why: "nothing left after taking the background out" };

  // Square, with the sticker's own centre in the middle.
  const side = Math.min(w, h, Math.max(x1 - x0, y1 - y0) + 9);
  const left = Math.max(0, Math.min(w - side, Math.round((x0 + x1) / 2 - side / 2)));
  const top = Math.max(0, Math.min(h - side, Math.round((y0 + y1) / 2 - side / 2)));

  // The text goes on the centre: dark, and the same all over.
  const lum = [];
  for (let dy = -0.2; dy <= 0.2; dy += 0.02) {
    for (let dx = -0.2; dx <= 0.2; dx += 0.02) {
      const i = Math.round(top + side * (0.5 + dy)) * w + Math.round(left + side * (0.5 + dx));
      lum.push(0.3 * data[i * 3] + 0.59 * data[i * 3 + 1] + 0.11 * data[i * 3 + 2]);
    }
  }
  const mean = lum.reduce((a, b) => a + b, 0) / lum.length;
  const spread = Math.sqrt(lum.reduce((a, b) => a + (b - mean) ** 2, 0) / lum.length);
  const cover = kept / (side * side);
  const round = Math.min(x1 - x0, y1 - y0) / Math.max(x1 - x0, y1 - y0);

  const webp = await sharp(out, { raw: { width: w, height: h, channels: 4 } })
    .extract({ left, top, width: side, height: side })
    .resize(SIZE, SIZE)
    .webp({ quality: 88, alphaQuality: 95 })
    .toBuffer();
  const why =
    mean > 70 ? `the centre is not black (${mean.toFixed(0)})`
    : spread > 14 ? `the centre is not empty (${spread.toFixed(1)})`
    : cover < 0.5 || cover > 0.9 ? `the outline is wrong (${(cover * 100).toFixed(0)}% of its square)`
    : round < 0.93 ? "it is not round"
    : null;
  return { webp, ok: !why, why };
}
