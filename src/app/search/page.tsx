import type { Metadata } from "next";
import { Suspense } from "react";

import { Reveal } from "@/components/motion/Reveal";
import { ProductCard } from "@/components/product/ProductCard";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { copy } from "@/config/copy";
import { searchProducts } from "@/lib/catalog";

export const metadata: Metadata = {
  title: copy.search.title,
  robots: { index: false },
};

async function Results({ q }: { q: string }) {
  if (!q) return <p className="py-10 text-center text-black/60">{copy.search.prompt}</p>;

  const products = await searchProducts(q);

  if (products.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-black/70">{copy.search.none(q)}</p>
        <Button href="/collections/all" className="mt-6">
          {copy.search.cta}
        </Button>
      </div>
    );
  }

  return (
    <>
      <p className="text-[0.8125rem] text-black/60" aria-live="polite">
        {copy.search.results(products.length, q)}
      </p>
      <ul className="mt-5 grid grid-cols-2 gap-x-3 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
        {products.map((p, i) => (
          <Reveal as="li" key={p.id} delay={(i % 4) * 0.06}>
            <ProductCard product={p} size="lg" />
          </Reveal>
        ))}
      </ul>
    </>
  );
}

function ResultsSkeleton() {
  return (
    <ul aria-hidden="true" className="mt-5 grid grid-cols-2 gap-x-3 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: 4 }, (_, i) => (
        <li key={i}>
          <div className="aspect-(--card-ratio) animate-pulse rounded-[0.375rem] bg-sand" />
          <div className="mt-2 h-4 w-2/3 animate-pulse bg-sand" />
        </li>
      ))}
    </ul>
  );
}

export default function SearchPage({ searchParams }: PageProps<"/search">) {
  return (
    <>
      <Container className="pt-8 pb-8 lg:pt-12">
        <h1 className="font-display text-[clamp(3rem,10vw,5.75rem)] leading-[0.9] font-extrabold uppercase">
          {copy.search.title}
        </h1>
      </Container>

      <section className="mx-auto min-h-[20rem] max-w-(--container) bg-cream px-(--gutter) py-8 text-black sm:px-6 xl:px-10">
        <Suspense fallback={<ResultsSkeleton />}>
          {searchParams.then((sp) => {
            const raw = sp.q;
            const q = (Array.isArray(raw) ? raw[0] : raw) ?? "";
            return <Results q={q.trim().slice(0, 80)} />;
          })}
        </Suspense>
      </section>
    </>
  );
}
