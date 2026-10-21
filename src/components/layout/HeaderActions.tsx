"use client";

import { AnimatePresence, motion, useAnimationControls } from "motion/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Suspense, useEffect, useId, useRef, useState, type FormEvent } from "react";

import { useCart } from "@/components/cart/CartProvider";
import { useMotionEnabled } from "@/components/motion/motion-preference";
import { Button } from "@/components/ui/Button";
import { CartIcon, CloseIcon, MenuIcon, SearchIcon, UserIcon } from "@/components/ui/Icons";
import { copy } from "@/config/copy";
import { nav, site } from "@/config/site";
import { cn } from "@/lib/cn";
import { lockPageScroll } from "@/lib/scroll-lock";

const iconButton =
  "grid size-11 place-items-center text-white transition-colors hover:text-gold focus-visible:text-gold";

/** Runs `onClose` on Escape for as long as the panel is mounted. */
function useEscape(onClose: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
}

function SearchPanel({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const id = useId();
  useEscape(onClose);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const q = inputRef.current?.value.trim() ?? "";
    if (!q) return;
    onClose();
    router.push(`/search?q=${encodeURIComponent(q)}`);
  };

  return (
    <div className="absolute inset-x-0 top-(--header-h) z-50 border-y border-white/10 bg-[#0a0a0a]">
      <form
        onSubmit={submit}
        role="search"
        className="mx-auto flex max-w-(--container) items-center gap-3 px-(--gutter) py-3 xl:px-1"
      >
        <label htmlFor={id} className="sr-only">
          {copy.header.searchStore}
        </label>
        <SearchIcon size={20} className="flex-none text-white/60" />
        <input
          ref={inputRef}
          id={id}
          type="search"
          name="q"
          autoComplete="off"
          enterKeyHint="search"
          placeholder={copy.header.searchPlaceholder}
          className="h-12 w-full min-w-0 bg-transparent font-display text-[clamp(1.375rem,5vw,1.75rem)] font-extrabold tracking-[0.01em] text-white uppercase placeholder:text-white/30 focus:outline-none"
        />
        <Button type="submit" size="sm" className="hidden sm:inline-flex">
          {copy.header.search}
        </Button>
        <button type="button" onClick={onClose} aria-label={copy.header.closeSearch} className={iconButton}>
          <CloseIcon size={20} />
        </button>
      </form>
    </div>
  );
}

/** Full-screen menu for phones and tablets: big type, numbered, staggered in. */
function MobileMenu({ onClose }: { onClose: () => void }) {
  const motionOn = useMotionEnabled();
  const first = useRef<HTMLAnchorElement>(null);
  useEscape(onClose);

  // Lock page scroll behind the menu and start with focus inside it.
  useEffect(() => {
    const unlock = lockPageScroll();
    first.current?.focus();
    return unlock;
  }, []);

  const item = (i: number) =>
    motionOn
      ? {
          initial: { y: 36, opacity: 0 },
          animate: { y: 0, opacity: 1 },
          transition: { delay: 0.06 + i * 0.06, duration: 0.5, ease: [0.16, 1, 0.3, 1] as const },
        }
      : {};

  return (
    <motion.div
      id="mobile-menu"
      role="dialog"
      aria-modal="true"
      aria-label={copy.a11y.mobileNav}
      initial={motionOn ? { opacity: 0 } : false}
      animate={{ opacity: 1 }}
      exit={motionOn ? { opacity: 0 } : undefined}
      transition={{ duration: 0.25 }}
      className="fixed inset-0 z-[60] flex flex-col overflow-y-auto bg-black px-(--gutter) pt-[calc(var(--header-h)+0.75rem)] pb-[calc(1.5rem+env(safe-area-inset-bottom))] lg:hidden"
    >
      <nav aria-label={copy.a11y.mobileNav}>
        <ul>
          {nav.map((link, i) => (
            <motion.li key={link.href} {...item(i)} className="border-t border-white/15 last:border-b">
              <Link
                ref={i === 0 ? first : undefined}
                href={link.href}
                onClick={onClose}
                className="group flex items-baseline gap-4 py-4 font-display text-[clamp(2.75rem,13vw,4.25rem)] leading-none font-extrabold uppercase transition-colors hover:text-gold"
              >
                <span className="font-nav text-[0.8125rem] font-semibold tracking-[0.12em] text-gold tabular-nums">
                  {String(i + 1).padStart(2, "0")}
                </span>
                {link.label}
              </Link>
            </motion.li>
          ))}
        </ul>
      </nav>

      <motion.div {...item(nav.length)} className="mt-auto pt-8">
        <Button href="/collections/all" onClick={onClose} size="lg" arrow className="w-full">
          {copy.header.menuCta}
        </Button>
        <div className="mt-5 flex items-center justify-between text-[0.8125rem] text-white/55">
          <Link href="/account" onClick={onClose} className="min-h-10 py-2 underline underline-offset-4 hover:text-gold">
            {copy.header.account}
          </Link>
          <p>{site.shortName}</p>
        </div>
        <p className="mt-3 text-[0.75rem] text-white/35">{copy.header.menuFootnote}</p>
      </motion.div>
    </motion.div>
  );
}

/** Search, account and cart icons (plus the menu toggle below lg). */
function Actions({ pathname }: { pathname: string }) {
  const { count, open: openCart } = useCart();

  // A panel only counts as open on the route where it was opened, so navigating
  // closes it without needing an effect.
  const [open, setOpen] = useState<{ panel: "search" | "menu"; path: string } | null>(null);
  const panel = open && open.path === pathname ? open.panel : null;
  const setPanel = (next: "search" | "menu" | null) => setOpen(next ? { panel: next, path: pathname } : null);
  const closePanel = () => setPanel(null);

  // Pop the badge whenever the cart count changes (not on first paint).
  const badge = useAnimationControls();
  const previousCount = useRef(count);
  useEffect(() => {
    if (previousCount.current !== count) {
      void badge.start({ scale: [1, 1.7, 1], transition: { duration: 0.45, ease: "easeOut" } });
      previousCount.current = count;
    }
  }, [count, badge]);

  return (
    <>
      <div
        className={cn(
          "absolute top-2 right-1 z-[70] flex items-center gap-[0.15625rem] lg:top-(--icons-top) lg:right-2 xl:right-(--icons-right)",
          // The bar must stay clickable above the full-screen menu
          panel === "menu" && "z-[70]",
        )}
      >
        <button
          type="button"
          aria-label={copy.header.search}
          aria-expanded={panel === "search"}
          onClick={() => setPanel(panel === "search" ? null : "search")}
          className={iconButton}
        >
          <SearchIcon size={22} />
        </button>

        <Link href="/account" aria-label={copy.header.account} className={cn(iconButton, "hidden sm:grid")}>
          <UserIcon size={22} />
        </Link>

        <button
          type="button"
          aria-label={copy.header.openCart(count)}
          onClick={openCart}
          className={cn(iconButton, "relative")}
        >
          <CartIcon size={22} />
          <motion.span
            aria-hidden="true"
            animate={badge}
            className="absolute top-1/2 left-1/2 -mt-[0.96875rem] ml-[0.28125rem] grid h-[0.875rem] min-w-[0.875rem] place-items-center rounded-full bg-gold px-[0.1875rem] text-[0.53125rem] leading-none font-bold text-black"
          >
            {count}
          </motion.span>
        </button>

        <button
          type="button"
          aria-label={panel === "menu" ? copy.header.closeMenu : copy.header.openMenu}
          aria-expanded={panel === "menu"}
          aria-controls="mobile-menu"
          onClick={() => setPanel(panel === "menu" ? null : "menu")}
          className={cn(iconButton, "lg:hidden")}
        >
          {panel === "menu" ? <CloseIcon size={22} /> : <MenuIcon size={22} />}
        </button>
      </div>

      {panel === "search" && <SearchPanel onClose={closePanel} />}
      <AnimatePresence>{panel === "menu" && <MobileMenu onClose={closePanel} />}</AnimatePresence>
    </>
  );
}

function ActionsAtRoute() {
  const pathname = usePathname();
  return <Actions pathname={pathname} />;
}

/**
 * The current route is read inside <Suspense>, so pages rendered on demand (a product added after the
 * last deploy) can still be prerendered with an instant shell; the fallback is the same bar.
 */
export function HeaderActions() {
  return (
    <Suspense fallback={<Actions pathname="" />}>
      <ActionsAtRoute />
    </Suspense>
  );
}
