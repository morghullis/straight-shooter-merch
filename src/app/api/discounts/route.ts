import { connection } from "next/server";

import { getActiveDiscounts } from "@/lib/catalog";

/** The automatic discounts on now (what any shopper sees). The asset pipeline reads it to make each one's sticker. */
export async function GET() {
  await connection();
  return Response.json(
    { discounts: await getActiveDiscounts() },
    { headers: { "Cache-Control": "public, max-age=0, must-revalidate", "Netlify-CDN-Cache-Control": "public, s-maxage=60" } },
  );
}
