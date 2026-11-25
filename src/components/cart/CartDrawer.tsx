"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";

import { createCheckout } from "@/app/actions";
import { SaleTag } from "@/components/product/SaleTag";
import { Button } from "@/components/ui/Button";
import { CloseIcon, MinusIcon, PlusIcon, TagIcon } from "@/components/ui/Icons";
import { copy } from "@/config/copy";
import { percentOff, type CartQuote } from "@/lib/catalog/discounts";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/format";
import { lockPageScroll } from "@/lib/scroll-lock";

import { useCart } from "./CartProvider";
import { CouponField } from "./CouponField";

const stepper =
  "grid h-full w-11 place-items-center text-white/80 transition-colors hover:text-gold sm:w-8";

export function CartDrawer() {
  const { lines, count, quote, quoting, code, isOpen, close, setQuantity, remove } = useCart();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const closeRef = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);

  // Escape to close, scroll lock, and focus management while open.
  useEffect(() => {
    if (!isOpen) return;
    returnFocus.current = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    const unlock = lockPageScroll();

    return () => {
      document.removeEventListener("keydown", onKey);
      unlock();
      returnFocus.current?.focus?.();
    };
  }, [isOpen, close]);

  const checkout = () => {
    setError(null);
    startTransition(async () => {
      const result = await createCheckout(
        lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity })),
        code,
      );
      if ("url" in result) {
        window.location.assign(result.url);
      } else {
        // Items the store no longer sells come out of the cart, so the next try goes through.
        result.removed?.forEach((variantId) => remove(variantId));
        setError(result.error);
      }
    });
  };

  return (
    <div
      className={cn("fixed inset-0 z-[70]", !isOpen && "pointer-events-none invisible")}
      aria-hidden={!isOpen}
      inert={!isOpen}
    >
      <button
        type="button"
        tabIndex={-1}
        aria-label={copy.cart.close}
        onClick={close}
        className={`absolute inset-0 bg-black/70 transition-opacity duration-300 ${isOpen ? "opacity-100" : "opacity-0"}`}
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-label={copy.cart.dialog}
        className={`absolute inset-y-0 right-0 flex w-full max-w-[26.25rem] flex-col border-l border-white/10 bg-[#0a0a0a] transition-transform duration-300 ease-out ${isOpen ? "translate-x-0" : "translate-x-full"}`}
      >
        <header className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <h2 className="font-display text-[1.625rem] leading-none font-extrabold tracking-[0.01em] uppercase">
            {copy.cart.title} <span className="text-gold">({count})</span>
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={close}
            aria-label={copy.cart.close}
            className="grid h-11 w-11 place-items-center text-white/80 transition hover:text-gold"
          >
            <CloseIcon size={22} />
          </button>
        </header>

        {lines.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-5 px-8 text-center">
            <p className="font-display text-[1.875rem] leading-none font-extrabold uppercase">
              {copy.cart.emptyTitle}
            </p>
            <p className="text-sm text-white/60">{copy.cart.emptyBody}</p>
            <Button href="/collections/all" onClick={close}>
              {copy.cart.emptyCta}
            </Button>
          </div>
        ) : (
          <>
            <ul className="flex-1 divide-y divide-white/10 overflow-y-auto px-5">
              {lines.map((line) => {
                const amounts = quote.lines[line.variantId] ?? { subtotal: line.price * line.quantity, total: line.price * line.quantity, discounts: [] };
                const reduced = amounts.total < amounts.subtotal;
                return (
                  <li key={line.variantId} className="flex gap-4 py-5">
                    <Link
                      href={`/products/${line.handle}`}
                      onClick={close}
                      className="relative h-[5.25rem] w-[5.25rem] flex-none overflow-hidden rounded-[0.1875rem] bg-sand"
                    >
                      <Image
                        src={line.image}
                        alt={line.imageAlt}
                        fill
                        sizes="(min-width: 1326px) 6.3vw, 84px"
                        className="object-contain"
                      />
                    </Link>

                    <div className="flex min-w-0 flex-1 flex-col">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <Link
                            href={`/products/${line.handle}`}
                            onClick={close}
                            className="block truncate text-sm font-medium text-white hover:text-gold"
                          >
                            {line.title}
                          </Link>
                          {line.variantTitle && line.variantTitle !== "Default Title" && (
                            <p className="mt-0.5 text-xs text-white/55">{line.variantTitle}</p>
                          )}
                          {reduced && (
                            <p className="mt-2 flex items-center gap-2 font-nav text-[0.6875rem] leading-none font-semibold tracking-[0.08em] text-gold uppercase">
                              <SaleTag className="flex-none text-[0.875rem]">{copy.product.percentOff(percentOff({ amount: String(amounts.total) }, { amount: String(amounts.subtotal) }))}</SaleTag>
                              <span className="truncate">{amounts.discounts.join(" + ") || copy.cart.discount}</span>
                            </p>
                          )}
                        </div>
                        <p className="flex flex-none flex-col items-end text-sm text-white tabular-nums">
                          {formatMoney(amounts.total, line.currency)}
                          {reduced && (
                            <s className="mt-0.5 text-xs text-white/45">
                              <span className="sr-only">{copy.cart.regularPrice} </span>
                              {formatMoney(amounts.subtotal, line.currency)}
                            </s>
                          )}
                        </p>
                      </div>

                      <div className="mt-auto flex items-center justify-between pt-3">
                        <div className="flex h-11 items-center ring-1 ring-white/20 ring-inset sm:h-8">
                          <button
                            type="button"
                            aria-label={copy.cart.decrease(line.title)}
                            onClick={() => setQuantity(line.variantId, line.quantity - 1)}
                            className={stepper}
                          >
                            <MinusIcon size={14} />
                          </button>
                          <span className="w-8 text-center text-sm tabular-nums" aria-live="polite">
                            {line.quantity}
                          </span>
                          <button
                            type="button"
                            aria-label={copy.cart.increase(line.title)}
                            onClick={() => setQuantity(line.variantId, line.quantity + 1)}
                            className={stepper}
                          >
                            <PlusIcon size={14} />
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => remove(line.variantId)}
                          className="-mr-2 px-2 py-3 text-xs text-white/55 underline underline-offset-4 transition-colors hover:text-gold"
                        >
                          {copy.cart.remove}
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>

            <footer className="border-t border-white/10 px-5 pt-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
              <CouponField />
              <Totals quote={quote} pending={quoting} />
              <p className="mt-1 text-xs text-white/45">{copy.cart.note}</p>

              {error && (
                <p role="alert" className="mt-3 border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                  {error}
                </p>
              )}

              <Button onClick={checkout} disabled={pending} size="lg" className="mt-4 w-full">
                {pending ? copy.cart.checkingOut : copy.cart.checkout}
              </Button>
            </footer>
          </>
        )}
      </aside>
    </div>
  );
}

/**
 * The cart's total. With discounts, the subtotal and each discount open above it; the amounts dim
 * while Shopify works out a change.
 */
function Totals({ quote, pending }: { quote: CartQuote; pending: boolean }) {
  const discounted = quote.discounts.length > 0;
  // The last discounts stay drawn while their rows close.
  const [shown, setShown] = useState(quote);
  if (discounted && shown !== quote) setShown(quote);

  return (
    <div className={cn("tabular-nums transition-opacity duration-200", pending && "opacity-60")} aria-busy={pending}>
      <div
        aria-hidden={!discounted}
        className={cn("grid transition-[grid-template-rows,opacity] duration-300 ease-out", discounted ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0")}
      >
        <dl className="min-h-0 space-y-1.5 overflow-hidden text-sm">
          <div className="flex items-center justify-between text-white/70">
            <dt>{copy.cart.subtotal}</dt>
            <dd>{formatMoney(shown.subtotal, shown.currency)}</dd>
          </div>
          {shown.discounts.map((d) => (
            <div key={d.title} className="flex items-center justify-between gap-4 text-gold">
              <dt className="flex min-w-0 items-center gap-1.5">
                <TagIcon size={13} strokeWidth={2} className="flex-none" />
                <span className="truncate">{d.title || copy.cart.discount}</span>
              </dt>
              <dd className="flex-none">−{formatMoney(d.amount, shown.currency)}</dd>
            </div>
          ))}
          <div aria-hidden="true" className="!mt-3 mb-3 h-px bg-white/10" />
        </dl>
      </div>
      <div className="flex items-center justify-between" aria-live="polite">
        <span className="text-sm text-white/70">{discounted ? copy.cart.total : copy.cart.subtotal}</span>
        <span className="text-lg font-semibold">{formatMoney(quote.total, quote.currency)}</span>
      </div>
    </div>
  );
}
