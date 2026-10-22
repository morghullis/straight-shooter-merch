// Meshy REST client (https://docs.meshy.ai): image to image, image to 3D, balance. Needs MESHY_API_KEY.
import fs from "node:fs";

import { need, sleep } from "./env.mjs";

const BASE = "https://api.meshy.ai/openapi/v1";

async function call(path, init = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${need("MESHY_API_KEY")}`, "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error(`Meshy ${path} failed with ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

/** Credits left, or null when the balance cannot be read. */
export async function balance() {
  try {
    const json = await call("/balance");
    return typeof json.balance === "number" ? json.balance : null;
  } catch {
    return null;
  }
}

async function waitFor(kind, id, { timeoutMs = 25 * 60_000, log = () => {} } = {}) {
  const until = Date.now() + timeoutMs;
  let last = -1;
  for (;;) {
    const task = await call(`/${kind}/${id}`);
    if (task.status === "SUCCEEDED") return task;
    if (task.status === "FAILED" || task.status === "CANCELED") {
      throw new Error(`Meshy ${kind} ${id} ${task.status.toLowerCase()}: ${task.task_error?.message ?? "no reason given"}`);
    }
    if (task.progress !== last) log(`  ${kind} ${task.progress ?? 0}%`);
    last = task.progress;
    if (Date.now() > until) throw new Error(`Meshy ${kind} ${id} did not finish in time`);
    await sleep(10_000);
  }
}

/** One image made from reference images and a prompt (GPT Image by default: 12 credits). */
export async function imageToImage({ prompt, imageUrls, aspectRatio, model = "gpt-image-2", log }) {
  const { result } = await call("/image-to-image", {
    method: "POST",
    body: JSON.stringify({ ai_model: model, prompt, reference_image_urls: imageUrls, ...(aspectRatio ? { aspect_ratio: aspectRatio } : {}) }),
  });
  const task = await waitFor("image-to-image", result, { log });
  return { taskId: result, url: task.image_urls[0] };
}

/**
 * A textured 3D model from one image: Meshy 7.1, 8K base colour, Ultra (4K) geometry, PBR maps,
 * the quality the site's own products have (40 credits).
 */
export async function imageTo3d({ imageUrl, log }) {
  const { result } = await call("/image-to-3d", {
    method: "POST",
    body: JSON.stringify({
      image_url: imageUrl,
      ai_model: "meshy-7.1",
      should_texture: true,
      enable_pbr: true,
      texture_resolution: "8k",
      geometry_resolution: "4k",
      target_formats: ["glb"],
    }),
  });
  const task = await waitFor("image-to-3d", result, { log });
  return { taskId: result, glbUrl: task.model_urls.glb, credits: task.consumed_credits ?? null };
}

export async function download(url, file) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed with ${res.status}`);
  fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  return file;
}
