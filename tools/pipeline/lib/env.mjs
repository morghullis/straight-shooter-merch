import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

/**
 * For local runs: reads KEY=value lines from PIPELINE_ENV_FILE (default tools/pipeline/.env, which git
 * ignores) without overriding variables that are already set. CI passes everything as real env vars.
 */
export function loadEnvFile(file = process.env.PIPELINE_ENV_FILE ?? path.join(here, "..", ".env")) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
  }
}

export function need(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable ${name}`);
  return value;
}

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
