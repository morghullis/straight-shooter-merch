"use client";

import { useId, useRef, type ReactNode } from "react";

import { CloseIcon } from "@/components/ui/Icons";
import { copy } from "@/config/copy";
import { lockPageScroll } from "@/lib/scroll-lock";

/**
 * "Size guide" next to the size picker: opens the product's size guide in a dialog (the browser's
 * own modal: focus stays inside, Escape or a click outside closes it).
 */
export function SizeGuideDialog({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const release = useRef<(() => void) | null>(null);
  const headingId = useId();

  const open = () => {
    dialog.current?.showModal();
    release.current ??= lockPageScroll();
  };
  const closed = () => {
    release.current?.();
    release.current = null;
  };

  return (
    <>
      <button
        type="button"
        onClick={open}
        aria-haspopup="dialog"
        className="font-nav text-[0.75rem] font-semibold tracking-[0.1em] text-black/60 uppercase underline decoration-gold-soft decoration-2 underline-offset-4 transition-colors duration-300 hover:text-black"
      >
        {copy.product.sections.sizeGuide}
      </button>
      <dialog
        ref={dialog}
        aria-labelledby={headingId}
        onClose={closed}
        // The dialog's own box is only reached around the panel: a click there is outside it.
        onClick={(event) =>
          event.target === event.currentTarget && dialog.current?.close()
        }
        className="m-auto max-h-[calc(100dvh-2rem)] w-[min(36rem,calc(100vw-2rem))] overflow-hidden rounded-[0.25rem] bg-cream p-0 text-black shadow-2xl backdrop:bg-black/70"
      >
        <div
          data-lenis-prevent
          className="max-h-[calc(100dvh-2rem)] overflow-y-auto p-6 text-[0.9375rem] leading-relaxed text-black/75"
        >
          <div className="mb-5 flex items-start justify-between gap-4">
            <h2
              id={headingId}
              className="font-display text-[1.875rem] leading-none font-extrabold text-black uppercase"
            >
              {copy.product.sections.sizeGuide}
              <span className="mt-1 block font-nav text-[0.75rem] font-semibold tracking-[0.1em] text-black/50">
                {title}
              </span>
            </h2>
            <form method="dialog">
              <button
                type="submit"
                aria-label={copy.product.closeSizeGuide}
                className="-m-2 grid size-11 place-items-center text-black/70 transition hover:text-black"
              >
                <CloseIcon size={22} />
              </button>
            </form>
          </div>
          {children}
        </div>
      </dialog>
    </>
  );
}
