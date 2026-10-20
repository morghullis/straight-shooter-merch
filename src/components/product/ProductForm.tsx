"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { useCart } from "@/components/cart/CartProvider";
import { Button } from "@/components/ui/Button";
import { MinusIcon, PlusIcon } from "@/components/ui/Icons";
import { copy } from "@/config/copy";
import { FOOTER_END_ID } from "@/config/site";
import type { Product, ProductVariant } from "@/lib/catalog/types";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/format";

type Selection = Record<string, string>;

const matches = (variant: ProductVariant, selection: Selection) =>
  variant.selectedOptions.every((o) => selection[o.name] === o.value);

/**
 * Option pickers, quantity stepper and the Add to cart button. On phones a bar pinned to
 * the bottom takes over the button as soon as the real one scrolls out of view.
 */
export function ProductForm({ product }: { product: Product }) {
  const { add } = useCart();

  // Hide Shopify's placeholder "Title / Default Title" option.
  const options = product.options.filter(
    (o) => !(o.name === "Title" && o.values.length === 1 && o.values[0] === "Default Title"),
  );

  const [selection, setSelection] = useState<Selection>(() => {
    const first = product.variants.find((v) => v.availableForSale) ?? product.variants[0];
    return Object.fromEntries(first.selectedOptions.map((o) => [o.name, o.value]));
  });
  const [quantity, setQuantity] = useState(1);
  const [announce, setAnnounce] = useState("");

  const variant = useMemo(() => product.variants.find((v) => matches(v, selection)), [product.variants, selection]);

  const isAvailable = (name: string, value: string) =>
    product.variants.some(
      (v) =>
        v.availableForSale &&
        v.selectedOptions.some((o) => o.name === name && o.value === value) &&
        v.selectedOptions.every((o) => o.name === name || selection[o.name] === o.value),
    );

  const soldOut = !variant || !variant.availableForSale;
  const price = variant?.price ?? product.price;
  const priceLabel = formatMoney(price.amount, price.currencyCode);

  // Pin a buy bar to the bottom (phones) while the real button is off screen,
  // and tuck it away when the footer's last row arrives so it never covers it.
  const cta = useRef<HTMLDivElement>(null);
  const [ctaVisible, setCtaVisible] = useState(true);
  const [footerEndVisible, setFooterEndVisible] = useState(false);
  useEffect(() => {
    const el = cta.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setCtaVisible(entry.isIntersecting));
    io.observe(el);

    const footerEnd = document.getElementById(FOOTER_END_ID);
    const footerIo = footerEnd ? new IntersectionObserver(([entry]) => setFooterEndVisible(entry.isIntersecting)) : null;
    if (footerEnd) footerIo?.observe(footerEnd);

    return () => {
      io.disconnect();
      footerIo?.disconnect();
    };
  }, []);
  const barHidden = ctaVisible || footerEndVisible;

  const addToCart = () => {
    if (!variant || soldOut) return;
    add(
      {
        variantId: variant.id,
        handle: product.handle,
        title: product.title,
        variantTitle: variant.title,
        price: Number(variant.price.amount),
        currency: variant.price.currencyCode,
        image: product.featuredImage.url,
        imageAlt: product.featuredImage.altText || product.title,
      },
      quantity,
    );
    setAnnounce(copy.product.added(quantity, product.title));
  };

  const label = soldOut ? copy.product.soldOut : copy.product.addToCart;
  const variantLabel = variant && variant.title !== "Default Title" ? `${variant.title} · ` : "";

  return (
    <div>
      <p className="text-[1.375rem] font-medium">{priceLabel}</p>

      <div className="mt-6 space-y-5">
        {options.map((option) => {
          const labelId = `opt-${option.id}`;
          return (
            <div key={option.id} role="group" aria-labelledby={labelId}>
              <p id={labelId} className="font-nav text-[0.8125rem] font-semibold tracking-[0.1em] uppercase">
                {option.name}: <span className="font-normal text-black/60">{selection[option.name]}</span>
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {option.values.map((value) => {
                  const selected = selection[option.name] === value;
                  const available = isAvailable(option.name, value);
                  return (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setSelection((s) => ({ ...s, [option.name]: value }))}
                      className={cn(
                        "h-11 min-w-12 border px-4 text-[0.875rem] font-medium transition-colors",
                        selected ? "border-black bg-black text-white" : "border-black/20 hover:border-black",
                        !available && "text-black/35 line-through",
                      )}
                    >
                      {value}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div ref={cta} className="mt-6 flex items-stretch gap-3">
        <div className="flex h-12 items-center border border-black/20">
          <button
            type="button"
            aria-label={copy.product.decrease}
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            className="grid h-full w-11 place-items-center hover:bg-black/5"
          >
            <MinusIcon size={14} />
          </button>
          <span className="w-9 text-center text-sm tabular-nums" aria-live="polite">
            {quantity}
          </span>
          <button
            type="button"
            aria-label={copy.product.increase}
            onClick={() => setQuantity((q) => Math.min(99, q + 1))}
            className="grid h-full w-11 place-items-center hover:bg-black/5"
          >
            <PlusIcon size={14} />
          </button>
        </div>

        <Button onClick={addToCart} disabled={soldOut} size="lg" className="flex-1">
          {label}
        </Button>
      </div>

      <p role="status" className="sr-only">
        {announce}
      </p>

      {/* Phones: the buy bar */}
      <div
        aria-hidden={barHidden}
        inert={barHidden}
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 border-t border-black/10 bg-cream px-(--gutter) pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] text-black shadow-[0_-0.75rem_1.875rem_-0.875rem_rgba(0,0,0,0.45)] transition-transform duration-300 lg:hidden",
          barHidden && "translate-y-full",
        )}
      >
        <div className="mx-auto flex max-w-(--container) items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[0.875rem] font-semibold">{product.title}</p>
            <p className="truncate text-[0.8125rem] text-black/60">
              {variantLabel}
              {priceLabel}
            </p>
          </div>
          <Button onClick={addToCart} disabled={soldOut} className="flex-none">
            {label}
          </Button>
        </div>
      </div>
    </div>
  );
}
