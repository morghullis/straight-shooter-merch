import { getCouponPopup } from "@/lib/coupon";

import { CouponPopupLoader } from "./CouponPopupLoader";

/** The coupon popup, while its discount in Shopify is on (or about to be). Nothing otherwise. */
export async function CouponPopupGate() {
  const popup = await getCouponPopup();
  return popup ? <CouponPopupLoader popup={popup} /> : null;
}
