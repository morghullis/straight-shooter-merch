// What the coupon codes apply to: everything that is not on offer already.

/** On a product while an automatic discount covers it (the sync puts it on and takes it off). */
export const AUTO_TAG = "auto-discounted";
/** Put on by hand to keep a product out of the coupons. */
export const MANUAL_TAG = "no-coupon";

export const ELIGIBLE = {
  handle: "coupon-eligible",
  title: "Coupon eligible",
  rules: [
    { column: "TAG", relation: "NOT_EQUALS", condition: MANUAL_TAG },
    { column: "TAG", relation: "NOT_EQUALS", condition: AUTO_TAG },
    // A compare-at price is a sale too.
    { column: "IS_PRICE_REDUCED", relation: "IS_NOT_SET", condition: "" },
  ],
};

/** Which products gain the tag and which lose it. `discounted` are handles. */
export function tagChanges(products, discounted) {
  const on = new Set(discounted);
  const has = (p) => p.tags.some((t) => t.toLowerCase() === AUTO_TAG);
  return {
    add: products.filter((p) => on.has(p.handle) && !has(p)),
    remove: products.filter((p) => !on.has(p.handle) && has(p)),
  };
}
