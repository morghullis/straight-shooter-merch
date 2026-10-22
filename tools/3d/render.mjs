// Renders the turntable images of every product from its high-resolution GLB.
//
//   node render.mjs <modelsDir> [handle ...]
//
// <modelsDir> holds the original Meshy GLBs (hat-8k.glb, tee-8k.glb, ...): use assets-src/round3/models.
// Output: ../../public/images/products/angles/<handle>/<angle>.webp (1500 x 1223, the card ratio).
// Needs Google Chrome (set CHROME_PATH if it is not in the default location).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { openTurntable } from "./lib/turntable.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const [modelsArg, ...only] = process.argv.slice(2);
if (!modelsArg) throw new Error("Usage: node render.mjs <modelsDir> [handle ...]");
const modelsDir = path.resolve(modelsArg);
const outRoot = path.resolve(here, "../../public/images/products/angles");
const products = JSON.parse(fs.readFileSync(path.join(here, "products.json"), "utf8"));
delete products._comment;

const turntable = await openTurntable();
try {
  for (const [handle, spec] of Object.entries(products)) {
    if (only.length && !only.includes(handle)) continue;
    const { glb, angles, ...camera } = spec;
    await turntable.render(path.join(modelsDir, `${glb}.glb`), path.join(outRoot, handle), { angles, ...camera });
    console.log("rendered", handle);
  }
} finally {
  await turntable.close();
}
