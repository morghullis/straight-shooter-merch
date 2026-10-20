import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { Reveal } from "@/components/motion/Reveal";
import { RevealText } from "@/components/motion/RevealText";
import { ProductCard } from "@/components/product/ProductCard";
import { Container } from "@/components/ui/Container";
import { copy } from "@/config/copy";
import { getCollection, getCollections, getProducts } from "@/lib/catalog";
import { cn } from "@/lib/cn";
import { isSafeHandle } from "@/lib/format";

export async function generateStaticParams() {
  const collections = await getCollections();
  return collections.map((c) => ({ handle: c.handle }));
}

export async function generateMetadata({ params }: PageProps<"/collections/[handle]">): Promise<Metadata> {
  const { handle } = await params;
  if (!isSafeHandle(handle)) return {};
  const collection = await getCollection(handle);
  if (!collection) return {};
  return { title: collection.title, description: collection.description || undefined };
}

/** `params` is read inside <Suspense> so any collection, even one created after the deploy, gets an instant shell. */
export default function CollectionPage({ params }: PageProps<"/collections/[handle]">) {
  return (
    <Suspense fallback={<CollectionSkeleton />}>
      <CollectionContent params={params} />
    </Suspense>
  );
}

function CollectionSkeleton() {
  return (
    <div aria-hidden="true">
      <Container className="pt-8 pb-8 lg:pt-12">
        <div className="h-16 w-2/3 max-w-[30rem] animate-pulse bg-white/10" />
      </Container>
      <section className="mx-auto max-w-(--container) bg-cream px-(--gutter) pt-5 pb-10 sm:px-6 xl:px-10">
        <ul className="mt-6 grid grid-cols-2 gap-x-3 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => (
            <li key={i}>
              <div className="aspect-(--card-ratio) animate-pulse rounded-[0.375rem] bg-sand" />
              <div className="mt-2 h-4 w-2/3 animate-pulse bg-sand" />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

async function CollectionContent({ params }: Pick<PageProps<"/collections/[handle]">, "params">) {
  const { handle } = await params;
  if (!isSafeHandle(handle)) notFound();

  const [collection, products, collections] = await Promise.all([
    getCollection(handle),
    getProducts({ collection: handle }),
    getCollections(),
  ]);
  if (!collection) notFound();

  return (
    <>
      <Container className="pt-8 pb-8 lg:pt-12">
        <RevealText
          as="h1"
          lines={[collection.title]}
          className="font-display text-[clamp(3rem,10vw,5.75rem)] leading-[0.9] font-extrabold tracking-[-0.01em] [word-spacing:0.05em] uppercase"
        />
        {collection.description && (
          <Reveal y={14} delay={0.15}>
            <p className="mt-4 max-w-[60ch] text-[0.9375rem] leading-relaxed text-white/65">{collection.description}</p>
          </Reveal>
        )}
      </Container>

      <section className="mx-auto max-w-(--container) bg-cream px-(--gutter) pt-5 pb-10 text-black sm:px-6 xl:px-10">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <nav
            aria-label={copy.collection.filter}
            className="scrollbar-none -mx-(--gutter) flex min-w-0 gap-2 overflow-x-auto px-(--gutter) [mask-image:linear-gradient(to_right,#000_calc(100%-1rem),transparent)] sm:mx-0 sm:flex-1 sm:flex-wrap sm:px-0 sm:[mask-image:none]"
          >
            {collections.map((c) => {
              const active = c.handle === handle;
              return (
                <Link
                  key={c.handle}
                  href={`/collections/${c.handle}`}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex-none border px-3.5 py-2.5 font-nav text-[0.75rem] font-semibold tracking-[0.06em] uppercase transition-colors",
                    active ? "border-black bg-black text-white" : "border-black/15 hover:border-black",
                  )}
                >
                  {c.handle === "all" ? copy.collection.all : c.title.replace(/^The\s+/i, "")}
                </Link>
              );
            })}
          </nav>
          <p className="order-first text-[0.75rem] text-black/60 sm:order-last" aria-live="polite">
            {copy.collection.count(products.length)}
          </p>
        </div>

        {products.length === 0 ? (
          <p className="py-16 text-center text-black/60">{copy.collection.empty}</p>
        ) : (
          <ul className="mt-6 grid grid-cols-2 gap-x-3 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
            {products.map((product, i) => (
              <Reveal as="li" key={product.id} delay={(i % 4) * 0.06}>
                <ProductCard product={product} size="lg" priority={i < 4} />
              </Reveal>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
