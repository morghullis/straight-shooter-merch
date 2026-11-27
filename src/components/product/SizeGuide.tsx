import Image from "next/image";

import { copy } from "@/config/copy";
import type { SizeGuide } from "@/lib/catalog";

/** A size guide from Shopify: its table, fit note and picture, each only when filled in. */
export function SizeGuideTable({
  guide,
  title,
}: {
  guide: SizeGuide;
  title: string;
}) {
  return (
    <div className="space-y-4">
      {guide.rows.length > 0 && (
        <div className="overflow-x-auto rounded-[0.25rem] bg-white ring-1 ring-black/10">
          <table className="w-full text-left text-[0.875rem] tabular-nums">
            <caption className="px-4 pt-3 text-left font-nav text-[0.6875rem] font-semibold tracking-[0.1em] text-black/50 uppercase">
              <span className="sr-only">
                {copy.product.sizeChartAlt(title)}{" "}
              </span>
              {guide.unit}
            </caption>
            {guide.columns.length > 0 && (
              <thead>
                <tr className="border-b border-black/10">
                  {guide.columns.map((c, i) => (
                    <th
                      key={i}
                      scope="col"
                      className="px-4 py-2.5 font-nav text-[0.75rem] font-semibold tracking-[0.08em] whitespace-nowrap uppercase"
                    >
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody>
              {guide.rows.map((row, r) => (
                <tr key={r} className="border-b border-black/5 last:border-0">
                  {row.map((cell, i) =>
                    i === 0 ? (
                      <th
                        key={i}
                        scope="row"
                        className="px-4 py-2 font-semibold whitespace-nowrap"
                      >
                        {cell}
                      </th>
                    ) : (
                      <td
                        key={i}
                        className="px-4 py-2 whitespace-nowrap text-black/75"
                      >
                        {cell}
                      </td>
                    ),
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {guide.note && <p className="whitespace-pre-line">{guide.note}</p>}
      {guide.chart && (
        <Image
          src={guide.chart.url}
          alt={guide.chart.altText || copy.product.sizeChartAlt(title)}
          width={guide.chart.width}
          height={guide.chart.height}
          sizes="(min-width: 1326px) 36vw, (min-width: 1024px) 470px, 100vw"
          className="h-auto w-full rounded-[0.25rem] bg-white object-contain"
        />
      )}
    </div>
  );
}
