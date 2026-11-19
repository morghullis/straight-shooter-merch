import Image from "next/image";
import type { ReactNode } from "react";

import { copy } from "@/config/copy";
import type { Product } from "@/lib/catalog";

import { AccordionGroup } from "./AccordionGroup";
import { productColors, Swatches } from "./Swatches";

const s = copy.product.sections;
const spec = copy.product.specs;

/** One folding block: a ruled row with the title and a plus that turns into a cross when open. Same `name`: one open at a time. */
function Section({ title, open = false, children }: { title: string; open?: boolean; children: ReactNode }) {
  return (
    <details name="product-info" open={open} className="fold group border-b border-black/10 [&_summary::-webkit-details-marker]:hidden">
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-4 py-3 font-nav text-[0.8125rem] font-semibold tracking-[0.12em] uppercase transition-colors duration-300 select-none hover:text-gold-soft focus-visible:outline-offset-2">
        <h2>{title}</h2>
        <span aria-hidden="true" className="relative size-3 flex-none transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-open:rotate-45">
          <span className="absolute inset-x-0 top-1/2 h-[0.09375rem] -translate-y-1/2 bg-current" />
          <span className="absolute inset-y-0 left-1/2 w-[0.09375rem] -translate-x-1/2 bg-current" />
        </span>
      </summary>
      <div className="pb-5 text-[0.9375rem] leading-relaxed text-black/75">{children}</div>
    </details>
  );
}

function DashList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-2.5">
          <span aria-hidden="true" className="mt-[0.6875rem] h-[0.125rem] w-3 flex-none bg-gold-soft" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

/** The short line under the product name, when the product has one. */
export function ProductTagline({ product }: { product: Product }) {
  const tagline = product.details?.tagline;
  if (!tagline) return null;
  return (
    <p className="mt-3 font-display text-[1.375rem] leading-[1.1] font-extrabold tracking-[-0.02em] text-black/70 uppercase">{tagline}</p>
  );
}

/** Key points right under the buy button, when the product has them. */
export function ProductHighlights({ product }: { product: Product }) {
  const highlights = product.details?.highlights ?? [];
  if (!highlights.length) return null;
  return (
    <section aria-label={s.highlights} className="mt-7 text-[0.9375rem] leading-relaxed text-black/80">
      <DashList items={highlights} />
    </section>
  );
}

/**
 * Everything else about the product, in folding blocks: description (as written in Shopify),
 * details, size guide, care, shipping. A block shows only when the product has content for it, so
 * a field filled in later in Shopify appears on its own, already styled.
 */
export function ProductInfo({ product }: { product: Product }) {
  const d = product.details;
  const colors = productColors(product);
  const sizes = product.options.find((o) => o.name.toLowerCase() === "size")?.values ?? [];

  const specs: { term: string; value: ReactNode }[] = [
    { term: spec.category, value: product.productType || null },
    { term: spec.material, value: d?.material },
    { term: spec.fit, value: d?.fit },
    { term: spec.madeFor, value: product.audience?.length ? product.audience.join(", ") : null },
    {
      term: spec.colors,
      value: colors.length ? (
        <span className="inline-flex flex-wrap items-center gap-2">
          <Swatches colors={colors} size="lg" />
          <span>{colors.map((c) => c.label).join(", ")}</span>
        </span>
      ) : null,
    },
    { term: spec.sizes, value: sizes.length > 1 ? sizes.join(" · ") : null },
  ].filter((row) => row.value);

  return (
    <AccordionGroup className="border-t border-black/10">
      {(product.descriptionHtml || product.description) && (
        <Section title={s.description} open>
          {product.descriptionHtml ? (
            // Cleaned in the catalog (cleanDescriptionHtml): headings, paragraphs, lists and links only.
            <div className="product-prose" dangerouslySetInnerHTML={{ __html: product.descriptionHtml }} />
          ) : (
            <p>{product.description}</p>
          )}
        </Section>
      )}

      {specs.length > 0 && (
        <Section title={s.details}>
          <dl className="grid grid-cols-[minmax(6.5rem,auto)_1fr] gap-x-6 gap-y-2.5">
            {specs.map((row) => (
              <div key={row.term} className="contents">
                <dt className="font-nav text-[0.75rem] font-semibold tracking-[0.1em] text-black/50 uppercase">{row.term}</dt>
                <dd className="text-black/85">{row.value}</dd>
              </div>
            ))}
          </dl>
        </Section>
      )}

      {d?.sizeChart && (
        <Section title={s.sizeGuide}>
          <a href={d.sizeChart.url} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-[0.25rem] bg-white">
            <Image
              src={d.sizeChart.url}
              alt={d.sizeChart.altText || copy.product.sizeChartAlt(product.title)}
              width={d.sizeChart.width}
              height={d.sizeChart.height}
              sizes="(min-width: 1326px) 36vw, (min-width: 1024px) 470px, 100vw"
              className="h-auto w-full object-contain"
            />
          </a>
        </Section>
      )}

      {d?.care.length ? (
        <Section title={s.care}>
          <DashList items={d.care} />
        </Section>
      ) : null}

      <Section title={s.shipping}>
        <DashList items={d?.shippingNote ? [d.shippingNote, ...copy.product.details] : [...copy.product.details]} />
      </Section>
    </AccordionGroup>
  );
}
