"use client";

import { motion } from "motion/react";
import Image from "next/image";
import { useEffect, useId, useRef, useState, useTransition, type FormEvent } from "react";

import { claimCoupon } from "@/app/coupon-actions";
import { useMotionEnabled } from "@/components/motion/motion-preference";
import { Art, textureStyle } from "@/components/ui/Art";
import { Button } from "@/components/ui/Button";
import { CloseIcon } from "@/components/ui/Icons";
import { Tape } from "@/components/ui/Tape";
import { copy } from "@/config/copy";
import { cn } from "@/lib/cn";
import { timeLeft } from "@/lib/coupon/code";
import type { CouponPopupData } from "@/lib/coupon";
import { lockPageScroll } from "@/lib/scroll-lock";

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([tabindex="-1"]):not([disabled])';

/**
 * The coupon popup: a gold ticket with a torn-off stub, like the season pass. A card in the middle of a
 * big screen, a sheet from the bottom on a phone. Focus stays inside; Escape, the backdrop, the cross
 * and "No thanks" close it.
 */
export function CouponPopup({ popup, onClose, onDone }: { popup: CouponPopupData; onClose: () => void; onDone: () => void }) {
  const { texts, label, terms, endsAt } = popup;
  const t = copy.coupon;
  const motionOn = useMotionEnabled();
  const titleId = useId();
  const dialog = useRef<HTMLDivElement>(null);
  const nameField = useRef<HTMLInputElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<{ field?: "name" | "email" | "consent"; message: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const [left, setLeft] = useState(() => timeLeft(endsAt, Date.now()));

  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    const unlock = lockPageScroll();
    // A phone's keyboard must not jump up by itself: there the cross gets the focus.
    const first = window.matchMedia("(hover: hover) and (pointer: fine)").matches ? nameField.current : closeButton.current;
    first?.focus({ preventScroll: true });
    return () => {
      unlock();
      before?.focus?.({ preventScroll: true });
    };
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setLeft(timeLeft(endsAt, Date.now())), 30_000);
    return () => clearInterval(timer);
  }, [endsAt]);

  // On the document: the keys must work even when the focus has been lost (a control that went away).
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
      if (e.key !== "Tab") return;
      const items = [...(dialog.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])].filter((el) => el.offsetParent);
      const inside = dialog.current?.contains(document.activeElement);
      const at = e.shiftKey ? items[0] : items[items.length - 1];
      if (inside && document.activeElement !== at) return;
      e.preventDefault();
      (e.shiftKey ? items[items.length - 1] : items[0])?.focus();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (pending) return;
    const form = e.currentTarget;
    const data = new FormData(form);
    setError(null);
    startTransition(async () => {
      const result = await claimCoupon({
        popup: texts.id,
        name: String(data.get("name") ?? ""),
        email: String(data.get("email") ?? ""),
        consent: data.get("consent") === "on",
        trap: data.has("extra"),
      }).catch(() => ({ ok: false as const, field: undefined, message: t.errors.failed }));
      if (result.ok) {
        onDone();
        setSent(true);
        closeButton.current?.focus({ preventScroll: true });
      } else {
        setError({ field: result.field, message: result.message });
        if (result.field) form.querySelector<HTMLInputElement>(`[name="${result.field}"]`)?.focus();
      }
    });
  };

  // "10% off": the figure on its own row on a big screen.
  const [, figure = label, rest = ""] = /^(\S*\d\S*)\s+(.+)$/.exec(label) ?? [];
  const title = texts.title ? texts.title.split(/\r?\n/).filter(Boolean).slice(0, 3) : t.title;
  const field =
    "mt-1 h-12 w-full rounded-none border-0 border-b-[0.1875rem] border-[#14110a] bg-transparent px-0 text-[1.0625rem] font-medium placeholder:text-[#14110a]/40 focus:border-b-[0.3125rem] focus:outline-none aria-[invalid=true]:border-[#8f1010]";
  const fieldLabel = "font-type text-[0.6875rem] tracking-[0.14em] uppercase";

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center sm:p-6">
      <motion.button
        type="button"
        tabIndex={-1}
        aria-hidden="true"
        onClick={onClose}
        initial={motionOn ? { opacity: 0 } : false}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.35 }}
        className="absolute inset-0 cursor-default bg-black/75"
      />

      <motion.div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        initial={motionOn ? { y: 70, opacity: 0, rotate: 0.8 } : false}
        animate={{ y: 0, opacity: 1, rotate: 0 }}
        transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
        className="relative max-h-[94svh] w-full overflow-x-hidden overflow-y-auto overscroll-contain bg-gold text-[#14110a] shadow-[0_2rem_4rem_-1rem_rgba(0,0,0,0.9)] sm:max-w-[46rem]"
      >
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-45 mix-blend-multiply" style={textureStyle("paper")} />

        <div className="relative grid sm:grid-cols-[minmax(0,0.82fr)_minmax(0,1fr)]">
          {/* The stub: the offer, on black, torn off along a perforation. */}
          <div className="relative flex min-h-[9.5rem] flex-col justify-between overflow-hidden bg-[#0b0b0b] px-6 pt-6 pb-7 text-white sm:min-h-full sm:px-7 sm:py-9">
            {texts.image ? (
              <>
                <Image src={texts.image.url} alt={texts.image.altText} fill sizes="(min-width: 640px) 340px, 100vw" className="object-cover" />
                <div aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.35),rgba(0,0,0,0.85))]" />
              </>
            ) : (
              <>
                <div aria-hidden="true" className="absolute inset-0 opacity-35" style={textureStyle("concrete")} />
                <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(120%_70%_at_30%_45%,rgba(240,171,39,0.28),transparent_70%)]" />
                {/* The offer again, huge and behind everything, like the hero's show words. */}
                <p aria-hidden="true" className="absolute -bottom-6 -left-2 hidden font-display text-[13rem] leading-none font-extrabold tracking-[-0.04em] text-white/[0.05] uppercase sm:block">
                  {figure}
                </p>
              </>
            )}
            <p className="relative font-type text-[0.6875rem] tracking-[0.16em] text-gold uppercase">{texts.kicker ?? t.kicker}</p>
            <div className="relative mt-3 origin-left -rotate-[3deg] sm:-mr-2">
              <Tape className="py-2 [--tape-end:1rem] sm:py-3 sm:[--tape-end:1.3rem]">
                <span className="block font-display text-[clamp(2.75rem,13vw,4.25rem)] leading-[0.82] font-extrabold tracking-[-0.01em] uppercase sm:text-[5.25rem]">
                  <span className="sm:block sm:text-[1.18em]">{figure}</span> <span className="sm:block">{rest}</span>
                </span>
              </Tape>
            </div>
            {terms && <p className="relative mt-3 font-nav text-[0.8125rem] leading-snug font-semibold tracking-[0.06em] text-white">{terms}</p>}
            {left && (
              <p className="relative mt-3 flex items-center gap-2 font-nav text-[0.75rem] font-semibold tracking-[0.12em] uppercase" aria-live="off">
                <span aria-hidden="true" className="size-2 flex-none animate-pulse rounded-full bg-gold" />
                {t.endsIn(left)}
              </p>
            )}
            {/* Perforation and punched corners */}
            <span aria-hidden="true" className="absolute inset-x-0 bottom-0 border-b-2 border-dashed border-gold/70 sm:inset-x-auto sm:inset-y-0 sm:right-0 sm:border-r-2 sm:border-b-0" />
          </div>

          <div className="relative flex flex-col px-6 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-8 sm:py-9">
            <Art name="stickerOfficial" sizes="110px" className="pointer-events-none absolute -right-4 -bottom-5 h-auto w-[6.5rem] rotate-12 opacity-25 mix-blend-multiply" />

            {sent ? (
              <div role="status" className="flex flex-1 flex-col justify-center py-4">
                <h2 id={titleId} className="font-display text-[clamp(2.75rem,11vw,3.5rem)] leading-[0.88] font-extrabold tracking-[-0.01em] uppercase">
                  {texts.successTitle ?? t.successTitle}
                </h2>
                <p className="mt-3 text-[0.9375rem] leading-relaxed">{texts.successText ?? t.successText}</p>
                <Button variant="ink" size="lg" onClick={onClose} className="mt-6 w-full sm:w-auto sm:self-start">
                  {t.successButton}
                </Button>
              </div>
            ) : (
              <>
                <h2 id={titleId} className="pr-10 font-display text-[clamp(2.5rem,10vw,3.25rem)] leading-[0.88] font-extrabold tracking-[-0.01em] uppercase">
                  {title.map((line, i) => (
                    <span key={i} className="block">
                      {line}
                    </span>
                  ))}
                </h2>
                <p className="mt-2.5 text-[0.9375rem] leading-relaxed">{texts.text ?? t.text}</p>

                <form onSubmit={submit} noValidate className="mt-5">
                  <label htmlFor="coupon-name" className={fieldLabel}>
                    {t.name}
                  </label>
                  <input ref={nameField} id="coupon-name" name="name" autoComplete="given-name" required maxLength={50} placeholder={t.namePlaceholder} aria-invalid={error?.field === "name"} aria-describedby="coupon-msg" className={field} />

                  <label htmlFor="coupon-email" className={cn(fieldLabel, "mt-4 block")}>
                    {t.email}
                  </label>
                  <input id="coupon-email" name="email" type="email" inputMode="email" autoComplete="email" required maxLength={254} placeholder={t.emailPlaceholder} aria-invalid={error?.field === "email"} aria-describedby="coupon-msg" className={field} />

                  {/* Honeypot, a box nobody sees. Not a text field: browsers fill those in by themselves, and a real person would be taken for a robot. */}
                  <div aria-hidden="true" className="absolute -left-[625rem] size-0 overflow-hidden">
                    <label>
                      {t.trap}
                      <input type="checkbox" name="extra" tabIndex={-1} autoComplete="off" />
                    </label>
                  </div>

                  <label className="mt-4 flex cursor-pointer items-start gap-3 text-[0.8125rem] leading-snug">
                    <input type="checkbox" name="consent" aria-invalid={error?.field === "consent"} aria-describedby="coupon-msg" className="mt-px grid size-5 flex-none cursor-pointer appearance-none place-items-center rounded-none border-2 border-[#14110a] bg-white/35 transition-colors before:h-[0.6875rem] before:w-[0.375rem] before:-translate-y-px before:rotate-45 before:border-r-[0.1875rem] before:border-b-[0.1875rem] before:border-gold before:opacity-0 checked:bg-[#14110a] checked:before:opacity-100 aria-[invalid=true]:border-[#8f1010]" />
                    {t.consent}
                  </label>

                  <p id="coupon-msg" role={error ? "alert" : undefined} className={cn("text-[0.8125rem] font-semibold text-[#8f1010]", error && "mt-3")}>
                    {error?.message}
                  </p>

                  <Button type="submit" variant="ink" size="lg" aria-disabled={pending} className={cn("mt-4 w-full", pending && "opacity-60")}>
                    {pending ? t.sending : (texts.button ?? t.button)}
                  </Button>
                </form>
                <button type="button" onClick={onClose} className="mx-auto mt-2 px-4 py-2.5 text-[0.8125rem] underline underline-offset-4 hover:text-white">
                  {t.no}
                </button>
              </>
            )}
          </div>
        </div>

        <button
          ref={closeButton}
          type="button"
          onClick={onClose}
          aria-label={t.close}
          className="absolute top-2 right-2 grid size-11 place-items-center text-white transition-colors hover:text-gold sm:text-[#14110a] sm:hover:text-white"
        >
          <CloseIcon size={22} />
        </button>
      </motion.div>
    </div>
  );
}
