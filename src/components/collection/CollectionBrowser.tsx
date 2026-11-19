"use client";

import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState, useSyncExternalStore, type ReactNode } from "react";

import { useMotionEnabled } from "@/components/motion/motion-preference";
import { ProductCard } from "@/components/product/ProductCard";
import { CloseIcon, SearchIcon } from "@/components/ui/Icons";
import { copy } from "@/config/copy";
import type { Product } from "@/lib/catalog/types";
import {
  activeCount,
  applyFilters,
  facetsOf,
  filtersFromParams,
  filtersToParams,
  inColor,
  NO_FILTERS,
  SORTS,
  type Filters,
  type SortKey,
} from "@/lib/catalog/filter";
import { cn } from "@/lib/cn";

const t = copy.collection.browse;

const noSubscribe = () => () => {};
const currentQuery = () => window.location.search;

const toggle = (list: string[], value: string) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

/** The site's chip: the collection buttons' type (nav caps), black when on. */
const chip = (on: boolean) =>
  cn(
    "inline-flex h-11 items-center gap-2 border px-3.5 font-nav text-[0.75rem] font-semibold tracking-[0.06em] whitespace-nowrap uppercase transition-colors duration-300 ease-out lg:h-10",
    on ? "border-black bg-black text-white" : "border-black/15 bg-transparent hover:border-black",
  );

/** Slow, settling ease for everything that moves here. */
const EASE = [0.22, 1, 0.36, 1] as const;

function Chip({ pressed, onClick, children }: { pressed: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" aria-pressed={pressed} onClick={onClick} className={chip(pressed)}>
      {children}
    </button>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="min-w-0">
      <legend className="font-nav text-[0.6875rem] font-semibold tracking-[0.12em] text-black/50 uppercase">{title}</legend>
      <div className="mt-2.5 flex flex-wrap gap-2">{children}</div>
    </fieldset>
  );
}

/**
 * A collection's products with a search box, filters (category, colour, size, in stock) and sort,
 * in the site's own type: the search reads like the header's, the chips like the collection buttons.
 * Everything it offers comes from the products in Shopify; the default order is Shopify's. The choice
 * is kept in the link (`?q=…&type=…`). The panel unfolds and the grid re-flows smoothly (none of it
 * with reduced motion).
 */
export function CollectionBrowser({ products }: { products: Product[] }) {
  const motionOn = useMotionEnabled();
  const facets = useMemo(() => facetsOf(products), [products]);
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [panelOpen, setPanelOpen] = useState(false);

  // A link's filters, read once hydrated (the server renders every product); applied during render.
  const query = useSyncExternalStore(noSubscribe, currentQuery, () => "");
  const [appliedQuery, setAppliedQuery] = useState("");
  if (query !== appliedQuery) {
    setAppliedQuery(query);
    const linked = filtersFromParams(new URLSearchParams(query));
    setFilters(linked);
    if (activeCount(linked)) setPanelOpen(true);
  }

  const update = (patch: Partial<Filters>) => {
    const next = { ...filters, ...patch };
    setFilters(next);
    const params = filtersToParams(next).toString();
    const search = params ? `?${params}` : "";
    setAppliedQuery(search);
    window.history.replaceState(window.history.state, "", `${window.location.pathname}${search}${window.location.hash}`);
  };

  const shown = useMemo(() => applyFilters(products, filters), [products, filters]);
  const active = activeCount(filters);
  const colorHex = new Map(facets.colors.map((c) => [c.label, c.hex]));

  const pills: { label: string; remove: Partial<Filters> }[] = [
    ...filters.types.map((v) => ({ label: v, remove: { types: filters.types.filter((x) => x !== v) } })),
    ...filters.colors.map((v) => ({ label: v, remove: { colors: filters.colors.filter((x) => x !== v) } })),
    ...filters.sizes.map((v) => ({ label: v, remove: { sizes: filters.sizes.filter((x) => x !== v) } })),
    ...(filters.inStock ? [{ label: t.inStock, remove: { inStock: false } }] : []),
  ];

  const move = motionOn ? { duration: 0.5, ease: EASE } : { duration: 0 };

  return (
    <div>
      <div className="flex flex-wrap items-end gap-x-3 gap-y-3">
        {/* The header search's look: big display caps on a single rule. */}
        <div className="relative min-w-[min(100%,16rem)] flex-[1_1_20rem]">
          <label htmlFor="collection-search" className="sr-only">
            {t.search}
          </label>
          <SearchIcon size={20} className="pointer-events-none absolute top-1/2 left-0 -translate-y-1/2 text-black/45" />
          <input
            id="collection-search"
            type="search"
            value={filters.q}
            onChange={(e) => update({ q: e.target.value })}
            placeholder={t.search}
            autoComplete="off"
            enterKeyHint="search"
            maxLength={80}
            className="h-12 w-full border-b-2 border-black/20 bg-transparent pr-10 pl-8 font-display text-[1.375rem] font-extrabold tracking-[0.01em] text-black uppercase transition-colors duration-300 placeholder:text-black/30 focus:border-black focus:outline-none [&::-webkit-search-cancel-button]:hidden"
          />
          {filters.q && (
            <button
              type="button"
              aria-label={t.clearSearch}
              onClick={() => update({ q: "" })}
              className="absolute top-1/2 right-0 grid size-11 -translate-y-1/2 place-items-center text-black/55 transition-colors hover:text-black"
            >
              <CloseIcon size={16} />
            </button>
          )}
        </div>

        <div className="flex flex-[0_0_auto] gap-2 max-sm:w-full">
          <button
            type="button"
            aria-expanded={panelOpen}
            aria-controls="collection-filters"
            onClick={() => setPanelOpen((open) => !open)}
            className={cn(chip(panelOpen), "max-sm:flex-1 max-sm:justify-center")}
          >
            {t.filters}
            {active > 0 && (
              <span className={cn("grid min-w-5 place-items-center rounded-full px-1.5 text-[0.6875rem] leading-5 tracking-normal", panelOpen ? "bg-gold text-black" : "bg-black text-white")}>
                {active}
              </span>
            )}
          </button>

          <div className="relative max-sm:flex-1">
            <label htmlFor="collection-sort" className="sr-only">
              {t.sortBy}
            </label>
            <select
              id="collection-sort"
              value={filters.sort}
              onChange={(e) => update({ sort: e.target.value as SortKey })}
              className={cn(chip(false), "w-full cursor-pointer appearance-none pr-9 focus:border-black focus:outline-none")}
            >
              {SORTS.map((s) => (
                <option key={s} value={s}>
                  {t.sorts[s]}
                </option>
              ))}
            </select>
            <span aria-hidden="true" className="pointer-events-none absolute top-1/2 right-3.5 size-1.5 -translate-y-[70%] rotate-45 border-r-[1.5px] border-b-[1.5px] border-black" />
          </div>
        </div>
      </div>

      {/* Unfolds smoothly (grid rows 0fr -> 1fr); closed, it is out of the tab order. */}
      <div
        id="collection-filters"
        inert={!panelOpen}
        className={cn("grid transition-[grid-template-rows,opacity] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]", panelOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0")}
      >
        <div className="overflow-hidden">
          <div className="mt-4 grid gap-5 border-y border-black/10 py-5 sm:grid-cols-2 lg:grid-cols-[1.2fr_1.1fr_1.7fr_0.9fr]">
            {facets.types.length > 1 && (
              <Group title={t.groups.type}>
                {facets.types.map((type) => (
                  <Chip key={type} pressed={filters.types.includes(type)} onClick={() => update({ types: toggle(filters.types, type) })}>
                    {type}
                  </Chip>
                ))}
              </Group>
            )}
            {facets.colors.length > 1 && (
              <Group title={t.groups.color}>
                {facets.colors.map((c) => (
                  <Chip key={c.label} pressed={filters.colors.includes(c.label)} onClick={() => update({ colors: toggle(filters.colors, c.label) })}>
                    {c.hex && <span aria-hidden="true" style={{ backgroundColor: c.hex }} className="size-3 rounded-full ring-1 ring-black/25" />}
                    {c.label}
                  </Chip>
                ))}
              </Group>
            )}
            {facets.sizes.length > 1 && (
              <Group title={t.groups.size}>
                {facets.sizes.map((size) => (
                  <Chip key={size} pressed={filters.sizes.includes(size)} onClick={() => update({ sizes: toggle(filters.sizes, size) })}>
                    {size}
                  </Chip>
                ))}
              </Group>
            )}
            <Group title={t.groups.availability}>
              <Chip pressed={filters.inStock} onClick={() => update({ inStock: !filters.inStock })}>
                {t.inStock}
              </Chip>
            </Group>
          </div>
        </div>
      </div>

      <div className="mt-4 flex min-h-9 flex-wrap items-center gap-2">
        <p className="mr-auto font-nav text-[0.6875rem] font-semibold tracking-[0.12em] text-black/55 uppercase" aria-live="polite">
          {t.showing(shown.length, products.length)}
        </p>
        <AnimatePresence initial={false}>
          {pills.map((pill) => (
            <motion.button
              key={pill.label}
              layout={motionOn ? "position" : false}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={motionOn ? { duration: 0.3, ease: EASE } : { duration: 0 }}
              type="button"
              aria-label={t.remove(pill.label)}
              onClick={() => update(pill.remove)}
              className="inline-flex h-9 items-center gap-1.5 bg-black px-3 font-nav text-[0.6875rem] font-semibold tracking-[0.06em] text-white uppercase transition-colors hover:bg-black/80"
            >
              {colorHex.get(pill.label) && <span aria-hidden="true" style={{ backgroundColor: colorHex.get(pill.label) ?? undefined }} className="size-2.5 rounded-full ring-1 ring-white/50" />}
              {pill.label}
              <CloseIcon size={12} />
            </motion.button>
          ))}
        </AnimatePresence>
        {(pills.length > 0 || filters.q) && (
          <button
            type="button"
            onClick={() => update({ ...NO_FILTERS, sort: filters.sort })}
            className="h-9 px-1 font-nav text-[0.6875rem] font-semibold tracking-[0.06em] uppercase underline underline-offset-4 transition-colors hover:text-gold-soft"
          >
            {t.clearAll}
          </button>
        )}
      </div>

      {shown.length === 0 ? (
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={move} className="py-16 text-center text-black/60">
          {products.length ? t.none : copy.collection.empty}
        </motion.p>
      ) : (
        // Cards glide to their new places, fade in and out, when the search or a filter changes.
        <ul className="mt-4 grid grid-cols-2 gap-x-3 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
          {/* First paint comes from the server, already visible (fast); only later changes animate. */}
          <AnimatePresence initial={false} mode="popLayout">
            {shown.map((original, i) => {
              // Filtered by colour: the card shows (and opens on) that colour.
              const { product, variantId } = inColor(original, filters.colors);
              return (
                <motion.li
                  key={product.id}
                  layout={motionOn}
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0, transition: motionOn ? { ...move, delay: Math.min(i, 8) * 0.04 } : move }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={move}
                >
                  <ProductCard product={product} size="lg" priority={i < 4} variantId={variantId} />
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      )}
    </div>
  );
}
