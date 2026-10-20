"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";

import { createCheckout } from "@/app/actions";
import { Button } from "@/components/ui/Button";
import { CloseIcon, MinusIcon, PlusIcon } from "@/components/ui/Icons";
import { copy } from "@/config/copy";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/format";

import { useCart } from "./CartProvider";

const stepper =
  "grid h-full w-11 place-items-center text-white/80 transition-colors hover:text-gold sm:w-8";

export function CartDrawer() {
  const { lines, count, subtotal, currency, isOpen, close, setQuantity, remove } = useCart();
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
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
      returnFocus.current?.focus?.();
    };
  }, [isOpen, close]);

  const checkout = () => {
    setError(null);
    startTransition(async () => {
      const result = await createCheckout(
        lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity })),
      );
      if ("url" in result) {
        window.location.assign(result.url);
      } else {
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
              {lines.map((line) => (
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
                      className="object-cover"
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
                      </div>
                      <p className="text-sm text-white">{formatMoney(line.price * line.quantity, line.currency)}</p>
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
              ))}
            </ul>

            <footer className="border-t border-white/10 px-5 pt-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
              <div className="flex items-center justify-between">
                <span className="text-sm text-white/70">{copy.cart.subtotal}</span>
                <span className="text-lg font-semibold">{formatMoney(subtotal, currency)}</span>
              </div>
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
