// Shopify Admin GraphQL client for the pipeline. Authenticates with the Dev Dashboard app's client
// credentials (SHOPIFY_CLIENT_ID / SHOPIFY_CLIENT_SECRET, a 24 h token), or a ready-made
// SHOPIFY_ADMIN_ACCESS_TOKEN. Retries when Shopify throttles.
import fs from "node:fs";
import path from "node:path";

import { need, sleep } from "./env.mjs";

const apiVersion = () => process.env.SHOPIFY_API_VERSION ?? "2026-07";
const domain = () => need("SHOPIFY_STORE_DOMAIN");

let cached = null;

async function accessToken() {
  if (process.env.SHOPIFY_ADMIN_ACCESS_TOKEN) return process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;
  if (cached && Date.now() < cached.expires - 60_000) return cached.token;
  const res = await fetch(`https://${domain()}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: need("SHOPIFY_CLIENT_ID"),
      client_secret: need("SHOPIFY_CLIENT_SECRET"),
    }),
  });
  if (!res.ok) throw new Error(`Shopify token exchange failed with ${res.status}`);
  const json = await res.json();
  cached = { token: json.access_token, expires: Date.now() + (json.expires_in ?? 3600) * 1000 };
  return cached.token;
}

export async function gql(query, variables = {}) {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`https://${domain()}/admin/api/${apiVersion()}/graphql.json`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": await accessToken() },
      body: JSON.stringify({ query, variables }),
    });
    const retryable = res.status === 429 || res.status >= 500;
    if (retryable && attempt < 5) {
      await sleep(1000 * 2 ** attempt);
      continue;
    }
    if (!res.ok) throw new Error(`Shopify request failed with ${res.status}`);
    const json = await res.json();
    if (json.errors?.some((e) => e.extensions?.code === "THROTTLED") && attempt < 5) {
      await sleep(1000 * 2 ** attempt);
      continue;
    }
    if (json.errors?.length) throw new Error(json.errors.map((e) => e.message).join("; "));
    return json.data;
  }
}

/** Throws on a mutation's userErrors; returns the payload otherwise. */
export function check(payload, label) {
  if (payload?.userErrors?.length) throw new Error(`${label}: ${payload.userErrors.map((e) => e.message).join("; ")}`);
  return payload;
}

const MIME = { ".webp": "image/webp", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".glb": "model/gltf-binary" };

/** Uploads a local file through a staged upload; returns the URL to hand to fileCreate. */
export async function stagedUpload(file, resource) {
  const mimeType = MIME[path.extname(file).toLowerCase()] ?? "application/octet-stream";
  const data = await gql(
    `mutation($input: [StagedUploadInput!]!) {
      stagedUploadsCreate(input: $input) { stagedTargets { url resourceUrl parameters { name value } } userErrors { field message } }
    }`,
    { input: [{ filename: path.basename(file), mimeType, resource, httpMethod: "POST", fileSize: String(fs.statSync(file).size) }] },
  );
  const target = check(data.stagedUploadsCreate, "stagedUploadsCreate").stagedTargets[0];
  const form = new FormData();
  for (const p of target.parameters) form.append(p.name, p.value);
  form.append("file", new Blob([fs.readFileSync(file)], { type: mimeType }), path.basename(file));
  const res = await fetch(target.url, { method: "POST", body: form });
  if (!res.ok) throw new Error(`Upload of ${path.basename(file)} failed with ${res.status}`);
  return target.resourceUrl;
}

/**
 * Creates Shopify files and waits until Shopify has processed them. Each entry is
 * { source: URL or local path, kind: "image" | "file", alt }. Returns the file ids, in order.
 */
export async function createFiles(entries) {
  const inputs = [];
  for (const e of entries) {
    const local = !/^https?:\/\//.test(e.source);
    const contentType = e.kind === "image" ? "IMAGE" : "FILE";
    const originalSource = local ? await stagedUpload(e.source, e.kind === "image" ? "IMAGE" : "FILE") : e.source;
    inputs.push({ originalSource, contentType, alt: e.alt ?? "", ...(e.filename ? { filename: e.filename } : {}) });
  }
  const data = await gql(
    `mutation($files: [FileCreateInput!]!) { fileCreate(files: $files) { files { id } userErrors { field message } } }`,
    { files: inputs },
  );
  const ids = check(data.fileCreate, "fileCreate").files.map((f) => f.id);
  await waitForFiles(ids);
  return ids;
}

export async function waitForFiles(ids, timeoutMs = 5 * 60_000) {
  const until = Date.now() + timeoutMs;
  for (;;) {
    const data = await gql(
      `query($ids: [ID!]!) { nodes(ids: $ids) { id ... on File { fileStatus fileErrors { message } } } }`,
      { ids },
    );
    const failed = data.nodes.filter((n) => n.fileStatus === "FAILED");
    if (failed.length) throw new Error(`Shopify could not process ${failed.length} file(s): ${failed.flatMap((f) => f.fileErrors.map((e) => e.message)).join("; ")}`);
    if (data.nodes.every((n) => n.fileStatus === "READY")) return;
    if (Date.now() > until) throw new Error("Timed out waiting for Shopify to process the files");
    await sleep(3000);
  }
}

/**
 * Shows files that are already in Shopify Files on a product too (as its media), placed before the
 * product's other media, so Shopify and the storefront show the same pictures in the same order.
 */
export async function attachToProduct(productId, fileIds) {
  const data = await gql(
    `mutation($files: [FileUpdateInput!]!) { fileUpdate(files: $files) { userErrors { field message } } }`,
    { files: fileIds.map((id) => ({ id, referencesToAdd: [productId] })) },
  );
  check(data.fileUpdate, "fileUpdate");

  const until = Date.now() + 2 * 60_000;
  for (;;) {
    const media = await gql(`query($id: ID!) { product(id: $id) { media(first: 50) { nodes { id } } } }`, { id: productId });
    const ids = new Set(media.product.media.nodes.map((m) => m.id));
    if (fileIds.every((id) => ids.has(id))) break;
    if (Date.now() > until) throw new Error("Timed out waiting for the files to show on the product");
    await sleep(2000);
  }
  const moved = await gql(
    `mutation($id: ID!, $moves: [MoveInput!]!) { productReorderMedia(id: $id, moves: $moves) { mediaUserErrors { field message } } }`,
    { id: productId, moves: fileIds.map((id, i) => ({ id, newPosition: String(i) })) },
  );
  if (moved.productReorderMedia.mediaUserErrors.length) {
    throw new Error(`productReorderMedia: ${moved.productReorderMedia.mediaUserErrors.map((e) => e.message).join("; ")}`);
  }
}

/** Sets metafields ([{ ownerId, namespace, key, type, value }]), 25 per call (Shopify's limit). */
export async function setMetafields(metafields) {
  for (let i = 0; i < metafields.length; i += 25) {
    const data = await gql(
      `mutation($m: [MetafieldsSetInput!]!) { metafieldsSet(metafields: $m) { metafields { key } userErrors { field message } } }`,
      { m: metafields.slice(i, i + 25) },
    );
    check(data.metafieldsSet, "metafieldsSet");
  }
}
