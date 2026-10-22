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
import { trackInteraction } from "@/lib/track";

export interface CartLine {
  variantId: string;
  handle: string;
  title: string;
  variantTitle: string;
  price: number;
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
  subtotal: number;
  currency: string;
  isOpen: boolean;
  open: () => void;
  close: () => void;
  add: (line: NewLine, quantity?: number) => void;
  setQuantity: (variantId: string, quantity: number) => void;
  remove: (variantId: string) => void;
  clear: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const lines = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
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

  // Keep the stored cart in step with the store: on arrival and whenever the cart is opened,
  // prices, names and pictures are refreshed and items the store no longer has are dropped.
  const ids = lines.map((l) => l.variantId).join(",");
  useEffect(() => {
    if (!ids) return;
    let cancelled = false;
    void refreshCart(ids.split(",")).then((live) => {
      if (!cancelled && live) dispatch({ type: "sync", live });
    });
    return () => {
      cancelled = true;
    };
  }, [ids, isOpen]);

  const value = useMemo<CartContextValue>(() => {
    const count = lines.reduce((n, l) => n + l.quantity, 0);
    const subtotal = lines.reduce((n, l) => n + l.price * l.quantity, 0);
    return {
      lines,
      count,
      subtotal,
      currency: lines[0]?.currency ?? "USD",
      isOpen,
      open,
      close,
      add,
      setQuantity,
      remove,
      clear,
    };
  }, [lines, isOpen, open, close, add, setQuantity, remove, clear]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside <CartProvider>");
  return ctx;
}
