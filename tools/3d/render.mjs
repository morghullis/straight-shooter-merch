// Renders the turntable images of every product from its high-resolution GLB.
//
//   node render.mjs <modelsDir> [handle ...]
//
// <modelsDir> holds the original Meshy GLBs (hat-8k.glb, tee-8k.glb, ...): use assets-src/round3/models.
// Output: ../../public/images/products/angles/<handle>/<angle>.webp (1500 x 1223, the card ratio).
// Needs Google Chrome (set CHROME_PATH if it is not in the macOS default location).
import { chromium } from "playwright-core";
import sharp from "sharp";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const [modelsArg, ...only] = process.argv.slice(2);
if (!modelsArg) throw new Error("Usage: node render.mjs <modelsDir> [handle ...]");
const modelsDir = path.resolve(modelsArg);
const three = path.resolve(here, "../../node_modules/three");
const outRoot = path.resolve(here, "../../public/images/products/angles");
const products = JSON.parse(fs.readFileSync(path.join(here, "products.json"), "utf8"));
delete products._comment;

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".glb": "model/gltf-binary" };
const server = http.createServer((req, res) => {
  const url = decodeURIComponent((req.url ?? "/").split("?")[0]);
  const file = url.startsWith("/three/") ? path.join(three, url.slice(7))
    : url.startsWith("/models/") ? path.join(modelsDir, url.slice(8))
    : path.join(here, url === "/" ? "render.html" : url);
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] ?? "application/octet-stream" });
    res.end(data);
  });
}).listen(0);
const port = server.address().port;

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--max-texture-size=8192"],
});
const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
await page.goto(`http://127.0.0.1:${port}/`);
await page.waitForFunction(() => window.ready === true, null, { timeout: 60000 });

for (const [handle, spec] of Object.entries(products)) {
  if (only.length && !only.includes(handle)) continue;
  const { glb, angles, ...camera } = spec;
  await page.evaluate(([url, opts]) => window.loadModel(url, opts), [`/models/${glb}.glb`, { fit: 2.4, ...camera }]);
  fs.mkdirSync(path.join(outRoot, handle), { recursive: true });
  for (const [name, yaw] of Object.entries(angles)) {
    const png = Buffer.from((await page.evaluate((a) => window.shot(a), yaw)).split(",")[1], "base64");
    // rendered at 2x, then downscaled: free antialiasing
    await sharp(png).resize(1500, 1223).webp({ quality: 82, effort: 6 }).toFile(path.join(outRoot, handle, `${name}.webp`));
  }
  console.log("rendered", handle);
}
await browser.close();
server.close();
