"use client";

import { AnimatePresence, motion } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";

import { useMotionEnabled } from "@/components/motion/motion-preference";
import { Button } from "@/components/ui/Button";
import { ScopeIcon } from "@/components/ui/HeaderIcons";
import { ArrowRightIcon, CloseIcon } from "@/components/ui/Icons";
import { Price } from "@/components/ui/Price";
import { copy } from "@/config/copy";
import { highlight, rankSearch, type SearchItem } from "@/lib/catalog/search";
import { cn } from "@/lib/cn";

const t = copy.header.instant;
const SHOWN = 6;
const EASE = [0.22, 1, 0.36, 1] as const;

const iconButton = "grid size-11 place-items-center text-white transition-colors hover:text-gold focus-visible:text-gold";

/** The store's search index, fetched once per visit and shared by every opening of the panel. */
let index: Promise<SearchItem[]> | null = null;
function loadIndex(): Promise<SearchItem[]> {
  index ??= fetch("/api/search")
    .then((r) => (r.ok ? r.json() : { items: [] }))
    .then((d: { items?: SearchItem[] }) => d.items ?? [])
    .catch(() => {
      index = null; // try again next time
      return [];
    });
  return index;
}

/**
 * The header search with instant results: as the shopper types, the matching products appear
 * under the box (picture, name, show, price), best match first, the typed words picked out.
 * Arrow keys move through them, Enter opens one (or the full results), Escape closes. The index is
 * small and loaded once, so every keystroke answers at once, with no round trip.
 */
export function SearchPanel({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const motionOn = useMotionEnabled();
  const inputRef = useRef<HTMLInputElement>(null);
  const id = useId();
  const listId = `${id}-results`;
  const [items, setItems] = useState<SearchItem[] | null>(null);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(-1);

  useEffect(() => {
    inputRef.current?.focus();
    let live = true;
    loadIndex().then((list) => live && setItems(list));
    return () => {
      live = false;
    };
  }, []);

  const query = q.trim();
  const matches = useMemo(() => (items && query ? rankSearch(items, query, (i) => ({ title: i.title, text: i.text })) : []), [items, query]);
  const shown = matches.slice(0, SHOWN);
  const resultsHref = `/search?q=${encodeURIComponent(query)}`;

  const open = (href: string) => {
    onClose();
    router.push(href);
  };

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!query) return;
    open(active >= 0 && shown[active] ? `/products/${shown[active].handle}` : resultsHref);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!shown.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % shown.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i <= 0 ? shown.length - 1 : i - 1));
    }
  };

  const optionId = (i: number) => `${id}-option-${i}`;
  const expanded = Boolean(query);
  const fade = motionOn ? { duration: 0.3, ease: EASE } : { duration: 0 };

  return (
    <div className="absolute inset-x-0 top-(--header-h) z-50 border-y border-white/10 bg-[#0a0a0a] shadow-[0_1.5rem_3rem_-1rem_rgba(0,0,0,0.6)]">
      <form onSubmit={submit} role="search" className="mx-auto flex max-w-(--container) items-center gap-3 px-(--gutter) py-3 xl:px-1">
        <label htmlFor={id} className="sr-only">
          {copy.header.searchStore}
        </label>
        <ScopeIcon size={20} className="flex-none text-white/60" />
        <input
          ref={inputRef}
          id={id}
          type="search"
          name="q"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setActive(-1);
          }}
          onKeyDown={onKeyDown}
          role="combobox"
          aria-expanded={expanded}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? optionId(active) : undefined}
          autoComplete="off"
          enterKeyHint="search"
          maxLength={80}
          placeholder={copy.header.searchPlaceholder}
          className="h-12 w-full min-w-0 bg-transparent font-display text-[clamp(1.375rem,5vw,1.75rem)] font-extrabold tracking-[0.01em] text-white uppercase placeholder:text-white/30 focus:outline-none [&::-webkit-search-cancel-button]:hidden"
        />
        {/* max-sm:hidden, not "hidden": the button's own inline-flex comes later in the CSS and would win. */}
        <Button type="submit" size="sm" className="max-sm:hidden">
          {copy.header.search}
        </Button>
        <button type="button" onClick={onClose} aria-label={copy.header.closeSearch} className={iconButton}>
          <CloseIcon size={20} />
        </button>
      </form>

      {/* Instant results: they unfold under the box as soon as there is something typed. */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="results"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={motionOn ? { duration: 0.35, ease: EASE } : { duration: 0 }}
            className="overflow-hidden border-t border-white/10"
          >
            <div className="mx-auto max-h-[min(70vh,34rem)] max-w-(--container) overflow-y-auto overscroll-contain px-(--gutter) pt-3 pb-4 xl:px-1">
              {items === null ? (
                <p className="py-4 font-nav text-[0.75rem] font-semibold tracking-[0.12em] text-white/45 uppercase" aria-live="polite">
                  {t.loading}
                </p>
              ) : shown.length === 0 ? (
                <div className="flex flex-wrap items-center justify-between gap-3 py-4" aria-live="polite">
                  <p className="text-[0.9375rem] text-white/70">{t.none(query)}</p>
                  <Link href="/collections/all" onClick={onClose} className="font-nav text-[0.75rem] font-semibold tracking-[0.08em] text-gold uppercase underline-offset-4 hover:underline">
                    {t.browse}
                  </Link>
                </div>
              ) : (
                <>
                  <p className="flex items-center justify-between font-nav text-[0.6875rem] font-semibold tracking-[0.14em] text-white/40 uppercase" aria-live="polite">
                    <span>
                      {t.label} · {matches.length}
                    </span>
                    <span className="hidden sm:inline">{t.hint}</span>
                  </p>
                  {/*
                    Typeahead: a result that no longer matches leaves at once (no lingering rows while
                    typing fast); new ones fade in and the ones that stay glide to their new place.
                  */}
                  <ul id={listId} role="listbox" aria-label={t.label} className="mt-2 grid grid-cols-[minmax(0,1fr)] gap-1 sm:grid-cols-[repeat(2,minmax(0,1fr))] sm:gap-x-4">
                      {shown.map((item, i) => (
                        <motion.li
                          key={item.handle}
                          layout={motionOn ? "position" : false}
                          initial={motionOn ? { opacity: 0, y: 8 } : false}
                          animate={{ opacity: 1, y: 0, transition: motionOn ? { ...fade, delay: i * 0.03 } : fade }}
                          transition={fade}
                          id={optionId(i)}
                          className="min-w-0"
                          role="option"
                          aria-selected={i === active}
                        >
                          <Link
                            href={`/products/${item.handle}`}
                            onClick={onClose}
                            onPointerEnter={() => setActive(i)}
                            tabIndex={-1}
                            className={cn(
                              "group flex items-center gap-3.5 rounded-[0.25rem] p-2 transition-colors duration-200",
                              i === active ? "bg-white/[0.08]" : "hover:bg-white/[0.06]",
                            )}
                          >
                            <span className="relative size-14 flex-none overflow-hidden rounded-[0.1875rem] bg-sand">
                              <Image src={item.image.url} alt="" fill sizes="56px" className="object-contain" />
                            </span>
                            <span className="min-w-0 flex-1">
                              {item.label && (
                                <span className="block truncate font-nav text-[0.625rem] font-semibold tracking-[0.12em] text-gold uppercase">{item.label}</span>
                              )}
                              <span className="mt-0.5 block truncate text-[0.9375rem] text-white">
                                {highlight(item.title, query).map((part, k) =>
                                  part.match ? (
                                    <mark key={k} className="bg-transparent font-semibold text-gold">
                                      {part.text}
                                    </mark>
                                  ) : (
                                    <span key={k}>{part.text}</span>
                                  ),
                                )}
                              </span>
                            </span>
                            <span className="flex flex-none flex-col items-end text-white">
                              {item.from && <span className="font-nav text-[0.5625rem] font-semibold tracking-[0.12em] text-white/50 uppercase">{copy.product.from}</span>}
                              <Price amount={item.price.amount} currency={item.price.currencyCode} className="text-[1.375rem]" />
                            </span>
                          </Link>
                        </motion.li>
                      ))}
                  </ul>
                  <button
                    type="button"
                    onClick={() => open(resultsHref)}
                    className="mt-3 inline-flex h-10 items-center gap-2 font-nav text-[0.75rem] font-semibold tracking-[0.08em] text-white uppercase transition-colors hover:text-gold"
                  >
                    {t.viewAll(matches.length)}
                    <ArrowRightIcon size={14} strokeWidth={1.8} />
                  </button>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
