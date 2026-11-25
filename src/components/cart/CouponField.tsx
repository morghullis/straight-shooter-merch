"use client";

import { useState, type FormEvent } from "react";

import { CloseIcon, TagIcon } from "@/components/ui/Icons";
import { copy } from "@/config/copy";
import { cn } from "@/lib/cn";
import { cleanCode } from "@/lib/coupon/code";

import { useCart } from "./CartProvider";

/**
 * The discount code in the cart drawer: typed here, or brought by the email's link. Shopify says whether
 * it works for this cart, and checkout opens with it in.
 */
export function CouponField() {
  const { code, codeApplies, quoting, setCode } = useCart();
  const [open, setOpen] = useState(false);
  const [wrong, setWrong] = useState(false);
  const t = copy.cart.coupon;

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const typed = cleanCode(new FormData(e.currentTarget).get("code"));
    setWrong(!typed);
    if (!typed) return;
    setCode(typed);
    setOpen(false);
  };

  if (code) {
    const state = codeApplies === null ? (quoting ? t.checking : t.saved) : codeApplies ? t.applied : t.notApplied;
    return (
      <div className="mb-4 flex items-center gap-2.5 border border-dashed border-gold/50 bg-gold/[0.07] py-1 pr-1 pl-3" aria-live="polite">
        <TagIcon size={15} strokeWidth={2} className="flex-none text-gold" />
        <p className="min-w-0 flex-1 py-1.5 leading-tight">
          <span className="block truncate font-nav text-[0.8125rem] font-semibold tracking-[0.08em] text-white uppercase">{code}</span>
          <span className={cn("block text-[0.6875rem]", codeApplies === false ? "text-red-300" : "text-white/55")}>{state}</span>
        </p>
        <button type="button" aria-label={t.remove(code)} onClick={() => setCode(null)} className="grid size-10 flex-none place-items-center text-white/60 transition-colors hover:text-gold">
          <CloseIcon size={16} />
        </button>
      </div>
    );
  }

  return (
    <div className="mb-4">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="-my-2 flex items-center gap-1.5 py-2 text-xs text-white/60 underline underline-offset-4 transition-colors hover:text-gold"
      >
        <TagIcon size={13} strokeWidth={2} />
        {t.have}
      </button>
      <div className={cn("grid transition-[grid-template-rows,opacity] duration-300 ease-out", open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0")} inert={!open}>
        <div className="min-h-0 overflow-hidden">
          <form onSubmit={submit} className="flex gap-2 pt-3">
            <label htmlFor="cart-code" className="sr-only">
              {t.label}
            </label>
            <input
              id="cart-code"
              name="code"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              maxLength={60}
              placeholder={t.placeholder}
              aria-invalid={wrong}
              className="h-11 min-w-0 flex-1 bg-white/[0.06] px-3 text-base tracking-[0.06em] text-white uppercase ring-1 ring-white/20 outline-none ring-inset placeholder:text-white/35 placeholder:normal-case focus:ring-gold sm:text-sm"
            />
            <button type="submit" className="h-11 flex-none border border-white/30 px-4 font-nav text-[0.75rem] font-semibold tracking-[0.1em] text-white uppercase transition-colors hover:border-gold hover:text-gold">
              {t.apply}
            </button>
          </form>
          {wrong && (
            <p role="alert" className="pt-1.5 text-xs text-red-300">
              {t.wrong}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
