import { cn } from "@/lib/cn";
import { formatMoney, moneyParts } from "@/lib/format";

/**
 * A price set like a price tag, the way the Showroom's register shows it: big dollars in the display
 * type, the currency sign and the cents small and raised, the cents underlined. Static (no script),
 * so it costs nothing in a grid of cards. Screen readers hear the plain "$34.99". A small price can
 * raise `--price-minor` (the sign and cents, 0.46em of the dollars) so the cents stay readable.
 */
export function Price({ amount, currency, className }: { amount: string | number; currency: string; className?: string }) {
  return (
    <span className={cn("inline-flex items-start font-display leading-none font-extrabold tabular-nums", className)}>
      <span className="sr-only">{formatMoney(amount, currency)}</span>
      <span aria-hidden="true" className="inline-flex items-start">
        {moneyParts(amount, currency).map((part, i) => {
          if (part.type === "decimal") return null; // the cents sit raised instead of after a point
          if (part.type === "currency") {
            return (
              <span key={i} className="mt-[0.08em] mr-[0.04em] text-[length:var(--price-minor,0.46em)]">
                {part.value}
              </span>
            );
          }
          if (part.type === "fraction") {
            return (
              <span key={i} className="mt-[0.08em] ml-[0.06em] border-b-[0.06em] border-current text-[length:var(--price-minor,0.46em)]">
                {part.value}
              </span>
            );
          }
          // The dollars give the price its baseline, so a label beside it ("From", a "was" price) can
          // sit on the same line as the digits with `items-baseline`.
          return (
            <span key={i} className="self-baseline">
              {part.value}
            </span>
          );
        })}
      </span>
    </span>
  );
}
