"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { useCart } from "@/components/cart/CartProvider";
import { isOn } from "@/lib/coupon/code";
import type { CouponPopupData } from "@/lib/coupon";
import { isPageScrollLocked } from "@/lib/scroll-lock";

const CouponPopup = dynamic(() => import("./CouponPopup").then((m) => m.CouponPopup), { ssr: false });

const KEY = "ssm-coupon-popup";
/** A closed popup stays away this long; one that was answered never comes back for that offer. */
const AGAIN_AFTER_MS = 5 * 86_400_000;
/** Pages where it would be in the way. */
const QUIET = /^\/account(\/|$)/;

type Seen = { id: string; done?: boolean; at: number };

function seen(): Seen | null {
  try {
    return JSON.parse(window.localStorage.getItem(KEY) ?? "null") as Seen | null;
  } catch {
    return null;
  }
}
function remember(value: Seen) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(value));
  } catch {
    /* blocked storage: it may show again on the next visit */
  }
}

function Loader({ popup }: { popup: CouponPopupData }) {
  const pathname = usePathname();
  const { code, isOpen: cartOpen } = useCart();
  const [open, setOpen] = useState(false);
  const { id, delay } = popup.texts;
  const quiet = QUIET.test(pathname);

  // After a moment on the page, or halfway down it, whichever comes first; never over another panel, never
  // for someone who already has a code, and only between the discount's dates.
  useEffect(() => {
    if (open || quiet || code || cartOpen) return;
    const before = seen();
    if (before?.id === id && (before.done || Date.now() - before.at < AGAIN_AFTER_MS)) return;

    let timer: ReturnType<typeof setTimeout>;
    const tryOpen = () => {
      if (!isOn(popup, Date.now())) return;
      const typing = document.activeElement?.matches("input, textarea, select");
      if (isPageScrollLocked() || typing || document.hidden) {
        timer = setTimeout(tryOpen, 4000);
        return;
      }
      setOpen(true);
    };
    const onScroll = () => {
      const depth = window.scrollY / Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      if (depth > 0.45) {
        window.removeEventListener("scroll", onScroll);
        clearTimeout(timer);
        timer = setTimeout(tryOpen, 600);
      }
    };
    timer = setTimeout(tryOpen, delay * 1000);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      clearTimeout(timer);
      window.removeEventListener("scroll", onScroll);
    };
  }, [open, quiet, code, cartOpen, id, delay, popup]);

  // It goes the second the discount ends.
  useEffect(() => {
    if (!open || !popup.endsAt) return;
    const left = Date.parse(popup.endsAt) - Date.now();
    if (left > 2 ** 31 - 1) return;
    const timer = setTimeout(() => setOpen(false), Math.max(0, left));
    return () => clearTimeout(timer);
  }, [open, popup.endsAt]);

  if (!open) return null;
  return (
    <CouponPopup
      popup={popup}
      onDone={() => remember({ id, done: true, at: Date.now() })}
      onClose={() => {
        const before = seen();
        if (!(before?.id === id && before.done)) remember({ id, at: Date.now() });
        setOpen(false);
      }}
    />
  );
}

export function CouponPopupLoader({ popup }: { popup: CouponPopupData }) {
  return (
    <Suspense>
      <Loader popup={popup} />
    </Suspense>
  );
}
