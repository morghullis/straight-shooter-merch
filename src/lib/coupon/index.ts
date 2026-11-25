import "server-only";

import { cacheLife, cacheTag } from "next/cache";

import { fetchCouponPopups } from "@/lib/catalog/shopify";
import type { CatalogImage } from "@/lib/catalog/types";

import { fetchCouponDiscount, isCouponConfigured } from "./admin";
import { cleanCode, type CouponOffer } from "./code";

/** What the popup says: the active "Coupon popup" entry in Shopify (Content > Metaobjects). Empty texts use the site's own. */
export interface CouponTexts {
  id: string;
  kicker: string | null;
  title: string | null;
  text: string | null;
  button: string | null;
  successTitle: string | null;
  successText: string | null;
  image: CatalogImage | null;
  /** Seconds on the page before it opens. */
  delay: number;
}

export interface CouponPopupData extends CouponOffer {
  texts: CouponTexts;
}

/**
 * The popup to show, or null. It is on while its discount is on in Shopify: scheduled, active and
 * finished at the dates set there (the browser also watches them, to the second). The code itself
 * never reaches the browser.
 */
export async function getCouponPopup(): Promise<CouponPopupData | null> {
  "use cache";
  cacheLife("catalog");
  cacheTag("discounts", "coupon-popup");

  if (!isCouponConfigured) return null;
  try {
    for (const { code, ...texts } of await fetchCouponPopups()) {
      const base = cleanCode(code);
      const discount = base ? await fetchCouponDiscount(base) : null;
      if (discount && discount.status !== "EXPIRED") {
        return { label: discount.label, startsAt: discount.startsAt, endsAt: discount.endsAt, texts };
      }
    }
  } catch (error) {
    console.warn(`[coupon] popup off: ${error instanceof Error ? error.message : error}`);
  }
  return null;
}
