"use client";

let locks = 0;
let previous = "";

/**
 * Stops the page from scrolling while an overlay (cart, menu, search) is open. The lock is put on
 * <html>, which is also what the smooth-scroll layer watches, so it pauses with the page. Locks nest:
 * the page scrolls again once every overlay that locked it has released it.
 */
export function lockPageScroll(): () => void {
  const root = document.documentElement;
  if (locks === 0) {
    previous = root.style.overflow;
    root.style.overflow = "hidden";
  }
  locks += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    locks -= 1;
    if (locks === 0) root.style.overflow = previous;
  };
}
