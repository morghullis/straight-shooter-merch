"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import { refreshCart, type LiveLine } from "@/app/actions";
import { estimateOf, type CartQuote } from "@/lib/catalog/discounts";
import { cleanCode } from "@/lib/coupon/code";
import { trackInteraction } from "@/lib/track";

export interface CartLine {
  variantId: string;
  handle: string;
  title: string;
  variantTitle: string;
  /** Per unit, with its automatic discount. */
  price: number;
  /** Per unit without that discount, and the discount's name in Shopify, when it has one. */
  regular?: number | null;
  discount?: string | null;
  currency: string;
  image: string;
  imageAlt: string;
  quantity: number;
}

type NewLine = Omit<CartLine, "quantity">;

type Action =
  | { type: "add"; line: NewLine; quantity: number }
  | { type: "set"; variantId: string; quantity: number }
  | { type: "remove"; variantId: string }
  | { type: "sync"; live: LiveLine[] }
  | { type: "clear" };

const STORAGE_KEY = "ssm-cart-v1";
const MAX_QTY = 99;

const clampQty = (n: number) => Math.min(MAX_QTY, Math.max(0, Math.floor(n) || 0));

function reducer(state: CartLine[], action: Action): CartLine[] {
  switch (action.type) {
    case "add": {
      const existing = state.find((l) => l.variantId === action.line.variantId);
      if (existing) {
        return state.map((l) =>
          l.variantId === action.line.variantId
            ? { ...l, quantity: clampQty(l.quantity + action.quantity) }
            : l,
        );
      }
      return [...state, { ...action.line, quantity: clampQty(action.quantity) }];
    }
    case "set": {
      const qty = clampQty(action.quantity);
      if (qty === 0) return state.filter((l) => l.variantId !== action.variantId);
      return state.map((l) => (l.variantId === action.variantId ? { ...l, quantity: qty } : l));
    }
    case "remove":
      return state.filter((l) => l.variantId !== action.variantId);
    case "sync": {
      // The store's version of each line wins; lines it no longer has are dropped.
      const live = new Map(action.live.map((l) => [l.variantId, l]));
      return state.flatMap((l) => {
        const now = live.get(l.variantId);
        return now ? [{ ...l, ...now, image: now.image || l.image, quantity: l.quantity }] : [];
      });
    }
    case "clear":
      return [];
  }
}

function isCartLine(value: unknown): value is CartLine {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.variantId === "string" &&
    typeof v.handle === "string" &&
    typeof v.title === "string" &&
    typeof v.variantTitle === "string" &&
    typeof v.price === "number" &&
    (v.regular == null || typeof v.regular === "number") &&
    (v.discount == null || typeof v.discount === "string") &&
    typeof v.currency === "string" &&
    typeof v.image === "string" &&
    typeof v.imageAlt === "string" &&
    typeof v.quantity === "number" &&
    v.quantity >= 1
  );
}

/* ------------------------------------------------------------------ */
/* Tiny external store backed by localStorage                          */
/*                                                                     */
/* Using useSyncExternalStore keeps server and first client render     */
/* identical (empty cart) and then swaps in the stored cart without a  */
/* hydration mismatch. If storage is blocked the cart still works in   */
/* memory for the session.                                             */
/* ------------------------------------------------------------------ */

const EMPTY: CartLine[] = [];
let current: CartLine[] = EMPTY;
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      current = parsed.filter(isCartLine).map((l) => ({ ...l, quantity: clampQty(l.quantity) }));
    }
  } catch {
    /* corrupted or blocked storage: start empty */
  }
}

function commit(next: CartLine[]) {
  current = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* blocked storage: keep in memory */
  }
  listeners.forEach((l) => l());
}

function dispatch(action: Action) {
  load();
  commit(reducer(current, action));
}

function subscribe(callback: () => void) {
  listeners.add(callback);

  // Keep several tabs in sync.
  const onStorage = (e: StorageEvent) => {
    if (e.key !== STORAGE_KEY && e.key !== null) return;
    loaded = false;
    current = EMPTY;
    load();
    callback();
  };
  window.addEventListener("storage", onStorage);

  return () => {
    listeners.delete(callback);
    window.removeEventListener("storage", onStorage);
  };
}

const getSnapshot = () => {
  load();
  return current;
};
const getServerSnapshot = () => EMPTY;

/* ------------------------------------------------------------------ */

interface CartContextValue {
  lines: CartLine[];
  count: number;
  /** The cart's amounts: Shopify's once it answers, the catalog's until then. */
  quote: CartQuote;
  /** True while Shopify is totalling the cart. */
  quoting: boolean;
  /** The shopper's discount code, and whether Shopify takes it for this cart (null = not known yet). */
  code: string | null;
  codeApplies: boolean | null;
  setCode: (code: string | null) => void;
  isOpen: boolean;
  open: () => void;
  close: () => void;
  add: (line: NewLine, quantity?: number) => void;
  setQuantity: (variantId: string, quantity: number) => void;
  remove: (variantId: string) => void;
  clear: () => void;
}

/** The discount code, kept in the browser like the cart (so the email's link works on a later visit too). */
const CODE_KEY = "ssm-coupon";
const codeListeners = new Set<() => void>();
let memoryCode: string | null = null;
const readCode = () => {
  try {
    return cleanCode(window.localStorage.getItem(CODE_KEY));
  } catch {
    return memoryCode;
  }
};
const writeCode = (code: string | null) => {
  memoryCode = code;
  try {
    if (code) window.localStorage.setItem(CODE_KEY, code);
    else window.localStorage.removeItem(CODE_KEY);
  } catch {
    /* blocked storage: kept in memory */
  }
  codeListeners.forEach((l) => l());
};
function subscribeCode(callback: () => void) {
  codeListeners.add(callback);
  const onStorage = (e: StorageEvent) => {
    if (e.key === CODE_KEY || e.key === null) callback();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    codeListeners.delete(callback);
    window.removeEventListener("storage", onStorage);
  };
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const lines = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const code = useSyncExternalStore(subscribeCode, readCode, () => null);
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const add = useCallback((line: NewLine, quantity = 1) => {
    dispatch({ type: "add", line, quantity });
    setIsOpen(true);
    trackInteraction(line.handle, "cart");
  }, []);
  const setQuantity = useCallback(
    (variantId: string, quantity: number) => dispatch({ type: "set", variantId, quantity }),
    [],
  );
  const remove = useCallback((variantId: string) => dispatch({ type: "remove", variantId }), []);
  const clear = useCallback(() => dispatch({ type: "clear" }), []);
  const setCode = useCallback((next: string | null) => writeCode(cleanCode(next)), []);

  // The email's link brings the code: /?coupon=CODE. It is kept, and leaves the address bar.
  useEffect(() => {
    const url = new URL(window.location.href);
    const given = cleanCode(url.searchParams.get("coupon"));
    if (!url.searchParams.has("coupon")) return;
    if (given) writeCode(given);
    url.searchParams.delete("coupon");
    window.history.replaceState(window.history.state, "", url);
  }, []);

  // Keep the stored cart in step with the store: on arrival and whenever the cart is opened or
  // changed, prices, names and pictures are refreshed and items the store no longer has are dropped.
  // While it is open Shopify also totals it, so every discount shows before checkout (a short pause
  // first: several taps on + ask once).
  const key = lines.length ? JSON.stringify(lines.map(({ variantId, quantity }) => ({ variantId, quantity }))) : "";
  const [priced, setPriced] = useState<{ key: string; quote: CartQuote | null; codeApplies: boolean | null } | null>(null);
  const pricedFor = `${code ?? ""}|${key}`;
  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      void refreshCart(JSON.parse(key), isOpen, code)
        .catch(() => null)
        .then((live) => {
          if (cancelled) return;
          if (isOpen) setPriced({ key: `${code ?? ""}|${key}`, quote: live?.quote ?? null, codeApplies: live?.codeApplies ?? null });
          if (live) dispatch({ type: "sync", live: live.lines });
        });
    }, isOpen ? 200 : 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [key, isOpen, code]);

  const value = useMemo<CartContextValue>(() => {
    const count = lines.reduce((n, l) => n + l.quantity, 0);
    const answered = priced?.key === pricedFor;
    return {
      lines,
      count,
      quote: (answered && priced.quote) || estimateOf(lines),
      quoting: isOpen && Boolean(key) && !answered,
      code,
      codeApplies: answered ? priced.codeApplies : null,
      setCode,
      isOpen,
      open,
      close,
      add,
      setQuantity,
      remove,
      clear,
    };
  }, [lines, key, pricedFor, priced, code, setCode, isOpen, open, close, add, setQuantity, remove, clear]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside <CartProvider>");
  return ctx;
}
