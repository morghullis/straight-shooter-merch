"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";

import { useCart } from "@/components/cart/CartProvider";
import { PriceRoll } from "@/components/motion/PriceRoll";
import { Button } from "@/components/ui/Button";
import { MinusIcon, PlusIcon, TagIcon } from "@/components/ui/Icons";
import { Price } from "@/components/ui/Price";
import { copy } from "@/config/copy";
import { FOOTER_END_ID } from "@/config/site";
import { isColorOption, productColors } from "@/lib/catalog/colors";
import { percentOff } from "@/lib/catalog/discounts";
import { optionPhotos, valuePhoto } from "@/lib/catalog/options";
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
  const [quantity, setQuantity] = useState(1);
  const [announce, setAnnounce] = useState("");

  const swatch = useMemo(() => new Map(productColors(product).map((c) => [c.label.toLowerCase(), c.hex])), [product]);

  const soldOut = !variant || !variant.availableForSale;
  const price = variant?.price ?? product.price;
  const amount = Number(price.amount);
  const compareAt = variant && onSale(variant.price, variant.compareAtPrice) ? variant.compareAtPrice : null;

  // Which way the register spins: forward to a higher price, back to a lower one.
  const [shownAmount, setShownAmount] = useState(amount);
  const [direction, setDirection] = useState(1);
  if (amount !== shownAmount) {
    setShownAmount(amount);
    setDirection(amount > shownAmount ? 1 : -1);
  }

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
        regular: variant.discount ? Number(variant.discount.regular.amount) : null,
        discount: variant.discount?.title || null,
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
  const variantLabel = variant && variant.title !== "Default Title" ? variant.title : "";

  return (
    <div>
      {/*
        The price in the display type. Another size with another price spins the register's wheels to
        it (up for a dearer one, down for a cheaper one).
      */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2" aria-live="polite">
        <p className="font-display leading-none font-extrabold text-black">
          <PriceRoll amount={amount} currency={price.currencyCode} direction={direction} className="text-[2.75rem] sm:text-[3rem] lg:text-[3.25rem]" />
        </p>
        {compareAt && (
          <span className="flex flex-col gap-1.5">
            <span className="flex items-center gap-3">
              <s className="text-[1.25rem] leading-none text-black/45">
                <span className="sr-only">{copy.product.regularPrice} </span>
                {formatMoney(compareAt.amount, compareAt.currencyCode)}
              </s>
              <span className="bg-black px-2 py-1 font-nav text-[0.75rem] leading-none font-semibold tracking-[0.1em] text-gold uppercase">
                {copy.product.percentOff(percentOff(price, compareAt))}
              </span>
            </span>
            {/* The saving, and the discount's name in Shopify. */}
            <span className="flex items-center gap-1.5 text-[0.8125rem] leading-none text-black/60">
              <TagIcon size={13} strokeWidth={2} className="flex-none" />
              {[copy.product.youSave(formatMoney(Number(compareAt.amount) - amount, compareAt.currencyCode)), variant?.discount?.title].filter(Boolean).join(" · ")}
            </span>
          </span>
        )}
      </div>

      <div className="mt-6 space-y-5">
        {options.map((option) => {
          const labelId = `opt-${option.id}`;
          const photos = optionPhotos(product, selection, option.name);
          return (
            <div key={option.id} role="group" aria-labelledby={labelId}>
              <p id={labelId} className="font-nav text-[0.8125rem] font-semibold tracking-[0.1em] uppercase">
                {option.name}: <span className="font-normal text-black/60">{selection[option.name]}</span>
              </p>
              <div className={photos ? "mt-3 grid grid-cols-[repeat(auto-fill,minmax(4.5rem,1fr))] gap-2.5" : "mt-2 flex flex-wrap gap-2"}>
                {option.values.map((value) => {
                  const selected = selection[option.name] === value;
                  const available = canPick(product.variants, selection, option.name, value);
                  const photo = photos?.get(value);
                  if (photo) {
                    return (
                      <button
                        key={value}
                        type="button"
                        title={value}
                        aria-pressed={selected}
                        aria-label={available ? value : `${value}, ${copy.product.soldOut.toLowerCase()}`}
                        onClick={() => choose(option.name, value)}
                        className={cn(
                          "group/value relative aspect-square overflow-hidden rounded-[0.25rem] bg-sand after:absolute after:inset-0 after:rounded-[inherit] after:ring-1 after:ring-black/10 after:ring-inset outline-2 outline-offset-2 transition-[outline-color,opacity] duration-300 focus-visible:outline-gold",
                          selected ? "outline-black" : "outline-transparent hover:outline-black/35",
                          !available && "opacity-40",
                        )}
                      >
                        {/* Close on the print: it is what tells the values apart. */}
                        <Image
                          src={photo.url}
                          alt=""
                          fill
                          sizes="(min-width: 1326px) 15vw, 200px"
                          className="origin-[50%_46%] scale-[1.75] object-cover transition-transform duration-500 ease-out group-hover/value:scale-[1.9]"
                        />
                      </button>
                    );
                  }
                  const isColor = isColorOption(option.name);
                  const hex = isColor ? swatch.get(value.toLowerCase()) : null;
                  // A colour without a known swatch shows its own photo in the dot.
                  const dot = isColor && !hex ? valuePhoto(product.variants, selection, option.name, value) : null;
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
                      {dot && (
                        <span aria-hidden="true" className={cn("relative size-5 flex-none overflow-hidden rounded-full ring-1", selected ? "ring-white/60" : "ring-black/20")}>
                          <Image src={dot.url} alt="" fill sizes="20px" className="scale-150 object-cover" />
                        </span>
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
            <p className="truncate text-[0.8125rem] font-semibold">{product.title}</p>
            <p className="mt-0.5 flex min-w-0 items-baseline gap-2">
              <Price amount={price.amount} currency={price.currencyCode} className="flex-none text-[1.625rem]" />
              {compareAt && (
                <s className="flex-none text-[0.8125rem] text-black/45">
                  <span className="sr-only">{copy.product.regularPrice} </span>
                  {formatMoney(compareAt.amount, compareAt.currencyCode)}
                </s>
              )}
              {variantLabel && <span className="truncate text-[0.75rem] text-black/55">{variantLabel}</span>}
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
