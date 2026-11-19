"use client";

import { createContext, useCallback, useContext, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";

import type { ProductVariant } from "@/lib/catalog/types";
import { initialVariant, matches, numericId, pick, selectionOf, type Selection } from "@/lib/catalog/variants";

interface VariantState {
  selection: Selection;
  /** The variant matching the selection (undefined for a combination Shopify does not have). */
  variant: ProductVariant | undefined;
  /** The shopper picks `value` for option `name`. */
  choose: (name: string, value: string) => void;
}

const VariantContext = createContext<VariantState | null>(null);

const noSubscribe = () => () => {};
const variantParam = () => new URLSearchParams(window.location.search).get("variant");

/**
 * The variant chosen on a product page, shared by the buy box and the gallery (picking "White"
 * shows the white one). It starts from the link's `?variant=` when there is one, and the address
 * follows the shopper's choice so a shared link opens on it.
 */
export function VariantProvider({ variants, children }: { variants: ProductVariant[]; children: ReactNode }) {
  const [selection, setSelection] = useState<Selection>(() => {
    const first = initialVariant(variants);
    return first ? selectionOf(first) : {};
  });

  // The link's variant: null while rendering on the server and hydrating, so both agree; read once
  // hydrated. When it names a variant not yet applied, the selection follows it (during render, the
  // React way to adjust state to an outside value).
  const param = useSyncExternalStore(noSubscribe, variantParam, () => null);
  const [appliedParam, setAppliedParam] = useState<string | null>(null);
  if (param && param !== appliedParam) {
    setAppliedParam(param);
    const linked = initialVariant(variants, param);
    if (linked && !matches(linked, selection)) setSelection(selectionOf(linked));
  }

  const choose = useCallback(
    (name: string, value: string) => {
      const next = pick(variants, selection, name, value);
      setSelection(next);
      const chosen = variants.find((v) => matches(v, next));
      if (chosen) {
        const id = numericId(chosen.id);
        setAppliedParam(id);
        const url = new URL(window.location.href);
        url.searchParams.set("variant", id);
        window.history.replaceState(window.history.state, "", url);
      }
    },
    [variants, selection],
  );

  const variant = useMemo(() => variants.find((v) => matches(v, selection)), [variants, selection]);
  const value = useMemo(() => ({ selection, variant, choose }), [selection, variant, choose]);
  return <VariantContext.Provider value={value}>{children}</VariantContext.Provider>;
}

export function useVariant(): VariantState {
  const state = useContext(VariantContext);
  if (!state) throw new Error("useVariant needs a <VariantProvider> around the product page");
  return state;
}

/** For parts that also work outside a product page (the gallery). */
export const useOptionalVariant = () => useContext(VariantContext);
