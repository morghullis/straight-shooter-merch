import type { Product, ProductColor } from "@/lib/catalog";
import { cn } from "@/lib/cn";

/**
 * The colours a product comes in: its "Color" option values (what can be bought), with the swatch
 * Shopify has for each in the product's category field "Color"; without a Color option, the
 * category field itself. Colours without a swatch are left out of the dots (their names still show
 * in the product details).
 */
export function productColors(product: Product): ProductColor[] {
  const known = new Map((product.colors ?? []).map((c) => [c.label.toLowerCase(), c]));
  const option = product.options.find((o) => ["color", "colour"].includes(o.name.toLowerCase()));
  if (!option) return product.colors ?? [];
  return option.values.map((value) => known.get(value.toLowerCase()) ?? { label: value, hex: null });
}

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
