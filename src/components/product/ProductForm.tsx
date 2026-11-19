"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";

import { useCart } from "@/components/cart/CartProvider";
import { useMotionEnabled } from "@/components/motion/motion-preference";
import { Button } from "@/components/ui/Button";
import { MinusIcon, PlusIcon } from "@/components/ui/Icons";
import { copy } from "@/config/copy";
import { FOOTER_END_ID } from "@/config/site";
import { isColorOption, productColors } from "@/lib/catalog/colors";
import type { Product } from "@/lib/catalog/types";
import { isAvailable as canPick, onSale } from "@/lib/catalog/variants";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/format";

import { useVariant } from "./VariantContext";

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

  // The chosen variant lives in VariantProvider (shared with the gallery, kept in the link).
  const { selection, variant, choose } = useVariant();
  const motionOn = useMotionEnabled();
  const [quantity, setQuantity] = useState(1);
  const [announce, setAnnounce] = useState("");

  const swatch = useMemo(() => new Map(productColors(product).map((c) => [c.label.toLowerCase(), c.hex])), [product]);

  const soldOut = !variant || !variant.availableForSale;
  const price = variant?.price ?? product.price;
  const priceLabel = formatMoney(price.amount, price.currencyCode);
  const compareAt = variant && onSale(variant.price, variant.compareAtPrice) ? variant.compareAtPrice : null;

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
        // The chosen colour's own picture when Shopify has one.
        image: variant.image?.url ?? product.featuredImage.url,
        imageAlt: variant.image?.altText || product.featuredImage.altText || product.title,
      },
      quantity,
    );
    setAnnounce(copy.product.added(quantity, product.title));
  };

  const label = soldOut ? copy.product.soldOut : copy.product.addToCart;
  const variantLabel = variant && variant.title !== "Default Title" ? `${variant.title} · ` : "";

  return (
    <div>
      <p className="flex items-baseline gap-3 text-[1.375rem] font-medium" aria-live="polite">
        {/* A new price (another size) slides in softly over the old one. */}
        <span className="relative inline-grid overflow-hidden">
          <AnimatePresence initial={false} mode="popLayout">
            <motion.span
              key={priceLabel}
              initial={{ opacity: 0, y: "60%" }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: "-60%" }}
              transition={motionOn ? { duration: 0.4, ease: [0.22, 1, 0.36, 1] } : { duration: 0 }}
            >
              {priceLabel}
            </motion.span>
          </AnimatePresence>
        </span>
        {compareAt && (
          <>
            <s className="text-[1rem] font-normal text-black/45">{formatMoney(compareAt.amount, compareAt.currencyCode)}</s>
            <span className="bg-black px-2 py-0.5 font-nav text-[0.6875rem] font-semibold tracking-[0.1em] text-gold uppercase">{copy.product.sale}</span>
          </>
        )}
      </p>

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
                  const available = canPick(product.variants, selection, option.name, value);
                  const hex = isColorOption(option.name) ? swatch.get(value.toLowerCase()) : null;
                  return (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={selected}
                      aria-label={available ? undefined : `${value}, ${copy.product.soldOut.toLowerCase()}`}
                      onClick={() => choose(option.name, value)}
                      className={cn(
                        "inline-flex h-11 min-w-12 items-center justify-center gap-2 border px-4 text-[0.875rem] font-medium transition-colors duration-300 ease-out",
                        selected ? "border-black bg-black text-white" : "border-black/20 hover:border-black",
                        !available && (selected ? "text-white/55 line-through" : "text-black/35 line-through"),
                      )}
                    >
                      {hex && (
                        <span
                          aria-hidden="true"
                          style={{ backgroundColor: hex }}
                          className={cn("size-3.5 flex-none rounded-full ring-1", selected ? "ring-white/60" : "ring-black/20")}
                        />
                      )}
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
