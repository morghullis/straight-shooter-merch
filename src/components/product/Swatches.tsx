import type { ProductColor } from "@/lib/catalog";
import { cn } from "@/lib/cn";

export { productColors } from "@/lib/catalog/colors";

const MAX_DOTS = 4;

/** Small colour dots with an accessible list of names. Renders nothing when no colour has a swatch. */
export function Swatches({ colors, size = "sm", className }: { colors: ProductColor[]; size?: "sm" | "lg"; className?: string }) {
  const dots = colors.filter((c) => c.hex);
  if (!dots.length) return null;
  const shown = dots.slice(0, MAX_DOTS);
  const more = colors.length - shown.length;

  return (
    <span className={cn("inline-flex items-center gap-1", className)} aria-label={colors.map((c) => c.label).join(", ")} role="img">
      {shown.map((c) => (
        <span
          key={c.label}
          aria-hidden="true"
          title={c.label}
          style={{ backgroundColor: c.hex ?? undefined }}
          className={cn("rounded-full ring-1 ring-black/20 ring-offset-1 ring-offset-cream", size === "lg" ? "size-[0.625rem]" : "size-[0.5rem]")}
        />
      ))}
      {more > 0 && (
        <span aria-hidden="true" className={cn("font-nav text-black/50", size === "lg" ? "text-[0.6875rem]" : "text-[0.5625rem]")}>
          +{more}
        </span>
      )}
    </span>
  );
}
