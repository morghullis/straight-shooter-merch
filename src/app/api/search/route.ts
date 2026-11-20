import { connection } from "next/server";

import { getSearchIndex } from "@/lib/catalog";

/**
 * The header search's index: every listed product as a small entry (name, show, price, picture).
 * Fetched once when the search opens; each keystroke then filters it in the browser, with no
 * round trip. Runs per request (never frozen at build) on the cached catalog, and the CDN keeps
 * each answer for a minute.
 */
export async function GET() {
  await connection();
  const items = await getSearchIndex();
  return Response.json(
    { items },
    { headers: { "Cache-Control": "public, max-age=0, must-revalidate", "Netlify-CDN-Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } },
  );
}
