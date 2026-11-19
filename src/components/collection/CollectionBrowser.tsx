"use client";

import { useMemo, useState, useSyncExternalStore, type ReactNode } from "react";

import { Reveal } from "@/components/motion/Reveal";
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

function Chip({ pressed, onClick, children }: { pressed: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        "inline-flex h-10 items-center gap-2 border px-3.5 text-[0.8125rem] font-medium transition-colors",
        pressed ? "border-black bg-black text-white" : "border-black/20 bg-white/50 hover:border-black",
      )}
    >
      {children}
    </button>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="min-w-0">
      <legend className="font-nav text-[0.75rem] font-semibold tracking-[0.12em] text-black/55 uppercase">{title}</legend>
      <div className="mt-2.5 flex flex-wrap gap-2">{children}</div>
    </fieldset>
  );
}

/**
 * A collection's products with a search box, filters (category, colour, size, in stock) and sort.
 * Everything it offers comes from the products in Shopify; the default order is Shopify's. The
 * choice is kept in the link (`?q=…&type=…`), so it can be shared and survives a reload.
 */
export function CollectionBrowser({ products }: { products: Product[] }) {
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

  const chips: { label: string; remove: Partial<Filters> }[] = [
    ...filters.types.map((v) => ({ label: v, remove: { types: filters.types.filter((x) => x !== v) } })),
    ...filters.colors.map((v) => ({ label: v, remove: { colors: filters.colors.filter((x) => x !== v) } })),
    ...filters.sizes.map((v) => ({ label: v, remove: { sizes: filters.sizes.filter((x) => x !== v) } })),
    ...(filters.inStock ? [{ label: t.inStock, remove: { inStock: false } }] : []),
  ];

  return (
    <div>
      <div className="flex flex-wrap items-stretch gap-2">
        <div className="relative min-w-[min(100%,15rem)] flex-[1_1_18rem]">
          <label htmlFor="collection-search" className="sr-only">
            {t.search}
          </label>
          <SearchIcon size={17} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-black/50" />
          <input
            id="collection-search"
            type="search"
            value={filters.q}
            onChange={(e) => update({ q: e.target.value })}
            placeholder={t.search}
            autoComplete="off"
            enterKeyHint="search"
            maxLength={80}
            className="h-11 w-full border border-black/20 bg-white/70 pr-11 pl-10 text-[0.9375rem] outline-none placeholder:text-black/40 focus:border-black [&::-webkit-search-cancel-button]:hidden"
          />
          {filters.q && (
            <button
              type="button"
              aria-label={t.clearSearch}
              onClick={() => update({ q: "" })}
              className="absolute top-1/2 right-1 grid size-9 -translate-y-1/2 place-items-center text-black/55 hover:text-black"
            >
              <CloseIcon size={15} />
            </button>
          )}
        </div>

        <button
          type="button"
          aria-expanded={panelOpen}
          aria-controls="collection-filters"
          onClick={() => setPanelOpen((open) => !open)}
          className={cn(
            "inline-flex h-11 items-center gap-2 border px-4 font-nav text-[0.8125rem] font-semibold tracking-[0.08em] uppercase transition-colors",
            panelOpen ? "border-black bg-black text-white" : "border-black/20 hover:border-black",
          )}
        >
          {t.filters}
          {active > 0 && (
            <span className={cn("grid min-w-5 place-items-center rounded-full px-1.5 text-[0.6875rem] leading-5", panelOpen ? "bg-gold text-black" : "bg-black text-white")}>
              {active}
            </span>
          )}
        </button>

        <div className="relative">
          <label htmlFor="collection-sort" className="sr-only">
            {t.sortBy}
          </label>
          <select
            id="collection-sort"
            value={filters.sort}
            onChange={(e) => update({ sort: e.target.value as SortKey })}
            className="h-11 cursor-pointer appearance-none border border-black/20 bg-white/70 pr-9 pl-3.5 text-[0.875rem] outline-none hover:border-black focus:border-black"
          >
            {SORTS.map((s) => (
              <option key={s} value={s}>
                {t.sorts[s]}
              </option>
            ))}
          </select>
          <span aria-hidden="true" className="pointer-events-none absolute top-1/2 right-3.5 size-2 -translate-y-[70%] rotate-45 border-r-[1.5px] border-b-[1.5px] border-black" />
        </div>
      </div>

      <div id="collection-filters" hidden={!panelOpen} className="mt-3 border border-black/10 bg-white/40 p-4 sm:p-5">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-[1.2fr_1.2fr_1.6fr_1fr]">
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
                  {c.hex && <span aria-hidden="true" style={{ backgroundColor: c.hex }} className="size-3.5 rounded-full ring-1 ring-black/25" />}
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

      <div className="mt-4 flex min-h-8 flex-wrap items-center gap-2">
        <p className="mr-auto text-[0.75rem] text-black/60" aria-live="polite">
          {t.showing(shown.length, products.length)}
        </p>
        {chips.map((chip) => (
          <button
            key={chip.label}
            type="button"
            aria-label={t.remove(chip.label)}
            onClick={() => update(chip.remove)}
            className="inline-flex h-8 items-center gap-1.5 bg-black px-2.5 text-[0.75rem] font-medium text-white hover:bg-black/80"
          >
            {colorHex.get(chip.label) && <span aria-hidden="true" style={{ backgroundColor: colorHex.get(chip.label) ?? undefined }} className="size-2.5 rounded-full ring-1 ring-white/50" />}
            {chip.label}
            <CloseIcon size={12} />
          </button>
        ))}
        {(chips.length > 0 || filters.q) && (
          <button type="button" onClick={() => update({ ...NO_FILTERS, sort: filters.sort })} className="h-8 px-1 text-[0.75rem] font-semibold underline underline-offset-4 hover:text-gold-soft">
            {t.clearAll}
          </button>
        )}
      </div>

      {shown.length === 0 ? (
        <p className="py-16 text-center text-black/60">{products.length ? t.none : copy.collection.empty}</p>
      ) : (
        <ul className="mt-4 grid grid-cols-2 gap-x-3 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
          {shown.map((original, i) => {
            // Filtered by colour: the card shows (and opens on) that colour.
            const { product, variantId } = inColor(original, filters.colors);
            return (
              <Reveal as="li" key={product.id} delay={(i % 4) * 0.06}>
                <ProductCard product={product} size="lg" priority={i < 4} variantId={variantId} />
              </Reveal>
            );
          })}
        </ul>
      )}
    </div>
  );
}
