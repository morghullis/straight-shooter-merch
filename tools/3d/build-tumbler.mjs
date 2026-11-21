// Builds the Culture Table tumbler in code: a 20 oz tumbler turned from its real profile (clear lid,
// steel bands, powder-coated body), with the logo printed on the body.
//
//   node build-tumbler.mjs <logo.png> <outDir>
//
// <logo.png>: the logo cut out of the white tumbler's product photo (transparent background,
// assets-src/brand/tumbler/culture-table-logo-on-cream.png). The photo shows the logo as seen from the
// front, already bent by the cup, so it is projected onto the body straight from the front: from the
// front the print matches the photo exactly, and from the side it wraps the way real printing does.
//
// Writes <outDir>/culture-table-tumbler.glb (2K print texture, phones) and
// culture-table-tumbler-hd.glb (4K, product page on a big screen). Image-to-3D made the logo stand off
// the cup like a badge and the body lumpy; a turned profile is exact, smooth and a few hundred KB.
import fs from "node:fs";
import path from "node:path";

import { Document, NodeIO } from "@gltf-transform/core";
import sharp from "sharp";

const [logoPath, outDir] = process.argv.slice(2);
if (!logoPath || !outDir) throw new Error("Usage: node build-tumbler.mjs <logo.png> <outDir>");

// The profile, measured on the product photo and scaled to a 17.5 cm tumbler: [height, radius] in cm,
// from the bottom up. Each part has its own material.
const BODY = { from: 1.57, to: 15.15, r0: 3.46, r1: 4.26 };
const radiusAt = (y) => BODY.r0 + ((y - BODY.from) / (BODY.to - BODY.from)) * (BODY.r1 - BODY.r0);
const PARTS = {
  steelBottom: [[0, 0], [0, 3.28], [0.12, 3.39], [1.5, 3.44], [1.5, 3.42], [1.57, 3.42]],
  body: [[BODY.from, BODY.r0], [BODY.to, BODY.r1]],
  steelTop: [[15.15, 4.24], [15.22, 4.24], [15.22, 4.28], [16.85, 4.3]],
  lid: [[16.85, 4.31], [17.2, 4.32], [17.38, 4.24], [17.47, 4.05], [17.47, 0]],
};
// The logo on the body: centred on the front, 5.2 cm wide, its centre 9.9 cm from the bottom (as in the photo).
const LOGO = { width: 5.2, centerY: 9.9 };
const CREAM = [241, 238, 231];
const SEGMENTS = 160;
const SCALE = 0.1; // cm -> scene units (the viewer fits the model to the stage anyway)

/** A surface of revolution from a profile: positions, normals, uvs (u around, front = 0.5), indices. */
function lathe(profile, { vFrom = profile[0][0], vTo = profile.at(-1)[0] } = {}) {
  const pos = [], nor = [], uv = [], idx = [];
  // Each profile segment gets its own ring pair, so creases stay sharp and slopes get true normals.
  for (let s = 0; s < profile.length - 1; s++) {
    const [y0, r0] = profile[s], [y1, r1] = profile[s + 1];
    const dy = y1 - y0, dr = r1 - r0;
    const len = Math.hypot(dy, dr) || 1;
    const ny = -dr / len, nr = dy / len; // outward normal of the profile line
    const base = pos.length / 3;
    for (const [y, r] of [[y0, r0], [y1, r1]]) {
      for (let i = 0; i <= SEGMENTS; i++) {
        const u = i / SEGMENTS;
        const a = (u - 0.5) * Math.PI * 2; // u = 0.5 faces +Z (the front)
        const sin = Math.sin(a), cos = Math.cos(a);
        pos.push(r * sin * SCALE, y * SCALE, r * cos * SCALE);
        nor.push(nr * sin, ny, nr * cos);
        uv.push(u, 1 - (y - vFrom) / (vTo - vFrom || 1));
      }
    }
    for (let i = 0; i < SEGMENTS; i++) {
      const a = base + i, b = base + i + 1, c = base + SEGMENTS + 1 + i, d = c + 1;
      idx.push(a, b, d, a, d, c);
    }
  }
  return { pos, nor, uv, idx };
}

/** The body's print texture: cream, with the logo projected from the front. */
async function bodyTexture(width, height) {
  const logo = sharp(logoPath).ensureAlpha();
  const { width: lw, height: lh } = await logo.metadata();
  const logoPx = await logo.raw().toBuffer();
  const logoHeight = (LOGO.width * lh) / lw;
  const out = Buffer.alloc(width * height * 3);
  for (let py = 0; py < height; py++) {
    const v = py / (height - 1);
    const y = BODY.to - v * (BODY.to - BODY.from); // v = 0 at the top of the body
    const r = radiusAt(y);
    for (let px = 0; px < width; px++) {
      const a = (px / (width - 1) - 0.5) * Math.PI * 2;
      let [R, G, B] = CREAM;
      if (Math.cos(a) > 0) {
        // Where this point of the cup is seen from the front, on the logo's rectangle.
        const lx = (r * Math.sin(a)) / LOGO.width + 0.5;
        const ly = 0.5 - (y - LOGO.centerY) / logoHeight;
        if (lx >= 0 && lx < 1 && ly >= 0 && ly < 1) {
          // Bilinear sample of the logo.
          const fx = lx * (lw - 1), fy = ly * (lh - 1);
          const x0 = Math.floor(fx), y0 = Math.floor(fy), x1 = Math.min(x0 + 1, lw - 1), y1 = Math.min(y0 + 1, lh - 1);
          const tx = fx - x0, ty = fy - y0;
          const px4 = (xx, yy, c) => logoPx[(yy * lw + xx) * 4 + c];
          const sample = (c) => (px4(x0, y0, c) * (1 - tx) + px4(x1, y0, c) * tx) * (1 - ty) + (px4(x0, y1, c) * (1 - tx) + px4(x1, y1, c) * tx) * ty;
          const alpha = sample(3) / 255;
          R = R * (1 - alpha) + sample(0) * alpha;
          G = G * (1 - alpha) + sample(1) * alpha;
          B = B * (1 - alpha) + sample(2) * alpha;
        }
      }
      const o = (py * width + px) * 3;
      out[o] = R; out[o + 1] = G; out[o + 2] = B;
    }
  }
  return sharp(out, { raw: { width, height, channels: 3 } }).jpeg({ quality: 90, chromaSubsampling: "4:4:4" }).toBuffer();
}

async function build(file, textureWidth) {
  const doc = new Document();
  const buffer = doc.createBuffer();
  const scene = doc.createScene("tumbler");
  const material = (name, color, { metallic = 0, roughness = 0.6, alpha = 1, texture = null } = {}) => {
    const m = doc.createMaterial(name).setBaseColorFactor([...color, alpha]).setMetallicFactor(metallic).setRoughnessFactor(roughness);
    m.setDoubleSided(true); // the caps and ledges are seen from both sides
    if (alpha < 1) m.setAlphaMode("BLEND");
    if (texture) m.setBaseColorTexture(texture);
    return m;
  };
  const srgb = (c) => (c / 255) ** 2.2;
  const print = doc.createTexture("print").setImage(await bodyTexture(textureWidth, textureWidth / 2)).setMimeType("image/jpeg");
  const materials = {
    steelBottom: material("brushed steel", [0.8, 0.8, 0.8], { metallic: 1, roughness: 0.42 }),
    steelTop: material("brushed steel", [0.8, 0.8, 0.8], { metallic: 1, roughness: 0.42 }),
    body: material("powder coat", [1, 1, 1], { roughness: 0.55, texture: print }),
    lid: material("clear lid", [srgb(220), srgb(226), srgb(232)], { roughness: 0.12, alpha: 0.45 }),
  };
  const mesh = doc.createMesh("tumbler");
  for (const [part, profile] of Object.entries(PARTS)) {
    // The body's v runs 0 at its top to 1 at its bottom, like the print texture's rows.
    const g = lathe(profile, part === "body" ? { vFrom: BODY.from, vTo: BODY.to } : {});
    const acc = (type, array, Kind) => doc.createAccessor().setType(type).setArray(new Kind(array)).setBuffer(buffer);
    mesh.addPrimitive(
      doc.createPrimitive()
        .setAttribute("POSITION", acc("VEC3", g.pos, Float32Array))
        .setAttribute("NORMAL", acc("VEC3", g.nor, Float32Array))
        .setAttribute("TEXCOORD_0", acc("VEC2", g.uv, Float32Array))
        .setIndices(acc("SCALAR", g.idx, Uint32Array))
        .setMaterial(materials[part]),
    );
  }
  scene.addChild(doc.createNode("tumbler").setMesh(mesh));
  fs.mkdirSync(outDir, { recursive: true });
  await new NodeIO().write(path.join(outDir, file), doc);
  console.log(`${file}: ${(fs.statSync(path.join(outDir, file)).size / 1e6).toFixed(2)} MB`);
}

await build("culture-table-tumbler.glb", 2048);
await build("culture-table-tumbler-hd.glb", 4096);
