import { cn } from "@/lib/cn";

/**
 * A sale label: a gold price ticket with notched ends, the figures big, and a glint that crosses it now and
 * then (see `.sale-tag`). Used wherever something is off and there is no sticker for it; sized by its
 * font size.
 */
export function SaleTag({ children, className }: { children: string; className?: string }) {
  // "10% off" reads big-small: the figures first, the words smaller.
  const [, before, figure, after] = /^(.*?)([$€£]?\d+(?:\.\d+)?%?)(.*)$/.exec(children) ?? [null, "", "", children];
  return (
    <span className={cn("sale-tag inline-flex items-baseline gap-[0.22em] font-display leading-none font-extrabold whitespace-nowrap text-[#14110a] uppercase", className)}>
      {before.trim() && <span className="text-[0.68em] tracking-[0.03em]">{before.trim()}</span>}
      {figure && <span className="text-[1.12em] tracking-[-0.01em]">{figure}</span>}
      {after.trim() && <span className="text-[0.78em] tracking-[0.04em]">{after.trim()}</span>}
    </span>
  );
}
