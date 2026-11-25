import Image from "next/image";

import { copy } from "@/config/copy";
import { cn } from "@/lib/cn";

/**
 * A discount's sticker with what it takes off printed on its black centre. The picture (made by the
 * asset pipeline) has no text, so it stays right when the discount changes. Sized by its font size:
 * the sticker is 5.6em wide.
 */
export function SaleSticker({ src, percent, upTo, eager = false, className }: { src: string; percent: number; upTo?: boolean; eager?: boolean; className?: string }) {
  return (
    <span role="img" aria-label={copy.product.percentOff(percent, upTo)} className={cn("relative inline-grid size-[5.6em] flex-none place-items-center", className)}>
      <Image src={src} alt="" fill sizes="128px" loading={eager ? "eager" : "lazy"} fetchPriority={eager ? "low" : "auto"} draggable={false} className="object-contain drop-shadow-[0_0.1em_0.25em_rgba(0,0,0,0.45)]" />
      <span aria-hidden="true" className="relative flex flex-col items-center font-display leading-none font-extrabold text-gold uppercase">
        {upTo && <span className="text-[0.62em] tracking-[0.04em] text-white">{copy.product.upTo}</span>}
        <span className="text-[1.75em] leading-[0.88] tracking-[-0.02em]">{percent}%</span>
        <span className="text-[0.95em] leading-[0.95] tracking-[0.06em] text-white">{copy.product.off}</span>
      </span>
    </span>
  );
}
