// Renders turntable images of a GLB (Three.js in headless Chrome, software GL, so it also runs on a
// CI machine without a GPU) on the same sand colour as the product cards: 1500 x 1223 WebP files.
import { chromium } from "playwright-core";
import sharp from "sharp";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const toolDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const three = path.resolve(toolDir, "../../node_modules/three");

/** The product's views: front and back (yaw in degrees, 0 = the model's front, which Meshy faces to +Z). */
export const FRONT_BACK = { front: 0, back: 180 };
/** The same, back first, for products whose graphic is on the back. */
export const BACK_FRONT = { back: 180, front: 0 };
export const IMAGE_SIZE = { width: 1500, height: 1223 };

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".glb": "model/gltf-binary" };

function chromePath() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  return process.platform === "darwin" ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" : "/usr/bin/google-chrome";
}

/**
 * Opens the render page once. Call `render()` for as many models as needed, then `close()`.
 * Camera options (all optional): fit, pitch, frame, lift, minZoom, baseYaw, normalScale.
 */
export async function openTurntable() {
  const models = new Map();
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent((req.url ?? "/").split("?")[0]);
    const file = url.startsWith("/three/") ? path.join(three, url.slice(7))
      : url.startsWith("/models/") ? models.get(url.slice(8))
      : path.join(toolDir, url === "/" ? "render.html" : url);
    if (!file) { res.writeHead(404); res.end(); return; }
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] ?? "application/octet-stream" });
      res.end(data);
    });
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();

  const browser = await chromium.launch({
    executablePath: chromePath(),
    headless: true,
    args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--max-texture-size=8192"],
  });
  const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
  await page.goto(`http://127.0.0.1:${port}/`);
  await page.waitForFunction(() => window.ready === true, null, { timeout: 60000 });

  let next = 0;
  return {
    /** Renders every angle of `glbPath` into `outDir/<angle>.webp`; returns [{ name, file }] in order. */
    async render(glbPath, outDir, { angles = FRONT_BACK, ...camera } = {}) {
      const id = `model-${next++}.glb`;
      models.set(id, path.resolve(glbPath));
      try {
        await page.evaluate(([url, opts]) => window.loadModel(url, opts), [`/models/${id}`, { fit: 2.4, ...camera }]);
        fs.mkdirSync(outDir, { recursive: true });
        const out = [];
        for (const [name, yaw] of Object.entries(angles)) {
          const png = Buffer.from((await page.evaluate((a) => window.shot(a), yaw)).split(",")[1], "base64");
          const file = path.join(outDir, `${name}.webp`);
          // rendered at 2x, then downscaled: free antialiasing
          await sharp(png).resize(IMAGE_SIZE.width, IMAGE_SIZE.height).webp({ quality: 82, effort: 6 }).toFile(file);
          out.push({ name, file });
        }
        return out;
      } finally {
        models.delete(id);
      }
    },
    async close() {
      await browser.close();
      server.close();
    },
  };
}
