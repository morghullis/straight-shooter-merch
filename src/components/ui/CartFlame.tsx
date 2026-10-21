import type { CSSProperties } from "react";

import { flameArt } from "@/config/art";

/**
 * The cart's count as a small stamped flame that flickers: shown only when there is something in
 * the cart. The number sits on the flame's bright core.
 */
export function CartFlame({ count }: { count: number }) {
  return (
    <span className="cart-flame" style={{ "--flame": `url(${flameArt.body})`, "--flame-core": `url(${flameArt.core})` } as CSSProperties}>
      <span className="cart-flame__core" />
      <span className="cart-flame__body" />
      <span className="cart-flame__count">{count > 99 ? "99+" : count}</span>
    </span>
  );
}
