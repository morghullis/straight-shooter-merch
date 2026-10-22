import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { Reveal } from "@/components/motion/Reveal";
import { ProductCard } from "@/components/product/ProductCard";
import { ProductForm } from "@/components/product/ProductForm";
import { ProductMedia } from "@/components/product/ProductMedia";
import { TrackProductView } from "@/components/product/TrackProductView";
import { Carousel } from "@/components/ui/Carousel";
import { Container } from "@/components/ui/Container";
import { copy } from "@/config/copy";
import { modelSpecFor } from "@/config/models";
import { site } from "@/config/site";
import { getProduct, getProducts, getRelatedProducts } from "@/lib/catalog";
import { isSafeHandle } from "@/lib/format";

export async function generateStaticParams() {
  const products = await getProducts();
  return products.map((p) => ({ handle: p.handle }));
}

export async function generateMetadata({ params }: PageProps<"/products/[handle]">): Promise<Metadata> {
  const { handle } = await params;
  if (!isSafeHandle(handle)) return {};
  const product = await getProduct(handle);
  if (!product) return {};

  return {
    title: product.title,
    description: product.description.slice(0, 160),
    openGraph: {
      title: product.title,
      description: product.description.slice(0, 160),
      images: [{ url: product.featuredImage.url, alt: product.featuredImage.altText }],
    },
  };
}

/**
 * The page itself never reads `params`: the product is read inside <Suspense>. With Partial
 * Prefetching that lets Next.js serve an instant shell for any product, including ones added to the
 * store after the last deploy, and cache the finished page after the first visit.
 */
export default function ProductPage({ params }: PageProps<"/products/[handle]">) {
  return (
    <Suspense fallback={<ProductSkeleton />}>
      <ProductDetails params={params} />
    </Suspense>
  );
}

function ProductSkeleton() {
  return (
    <div aria-hidden="true">
      <Container className="pt-5 pb-4 lg:pt-[2.125rem]">
        <div className="h-5 w-48 animate-pulse bg-white/10" />
      </Container>
      <section className="mx-auto max-w-(--container) bg-cream px-(--gutter) py-6 sm:px-6 lg:px-10 lg:py-10">
        <div className="grid gap-8 lg:grid-cols-[1.15fr_1fr] lg:gap-12">
          <div className="aspect-(--card-ratio) animate-pulse rounded-[0.375rem] bg-sand" />
          <div className="space-y-4">
            <div className="h-4 w-32 animate-pulse bg-sand" />
            <div className="h-14 w-4/5 animate-pulse bg-sand" />
            <div className="h-6 w-24 animate-pulse bg-sand" />
            <div className="h-12 w-full animate-pulse bg-sand" />
          </div>
        </div>
      </section>
    </div>
  );
}

async function ProductDetails({ params }: Pick<PageProps<"/products/[handle]">, "params">) {
  const { handle } = await params;
  if (!isSafeHandle(handle)) notFound();

  const product = await getProduct(handle);
  if (!product) notFound();

  const related = await getRelatedProducts(product, 4);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    description: product.description,
    image: product.images.map((i) => i.url),
    brand: { "@type": "Brand", name: site.shortName },
    offers: {
      "@type": "Offer",
      priceCurrency: product.price.currencyCode,
      price: product.price.amount,
      availability: product.availableForSale ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        // Escape "<" so product copy can never close the script tag.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />

      <Container className="pt-5 pb-4 lg:pt-[2.125rem]">
        <nav aria-label={copy.a11y.breadcrumb} className="text-[0.75rem] text-white/55">
          <Link href="/" className="inline-block py-1 hover:text-gold">
            {copy.product.home}
          </Link>
          <span aria-hidden="true" className="mx-2">
            /
          </span>
          <Link href="/collections/all" className="inline-block py-1 hover:text-gold">
            {copy.product.shopAll}
          </Link>
          <span aria-hidden="true" className="mx-2">
            /
          </span>
          <span aria-current="page" className="text-white/85">
            {product.title}
          </span>
        </nav>
      </Container>

      <section className="mx-auto max-w-(--container) bg-cream px-(--gutter) py-6 text-black sm:px-6 lg:px-10 lg:py-10">
        <div className="grid gap-8 lg:grid-cols-[1.15fr_1fr] lg:gap-12">
          <ProductMedia
            title={product.title}
            images={product.images.map((i) => ({ url: i.url, alt: i.altText }))}
            model={modelSpecFor(product)}
          />
          <TrackProductView handle={product.handle} />

          <div>
            <p className="font-nav text-[0.75rem] font-semibold tracking-[0.12em] text-gold-soft uppercase">
              {site.shortName}
            </p>
            <h1 className="mt-2 font-display text-[clamp(2.75rem,8vw,3.75rem)] leading-[0.95] font-extrabold tracking-[-0.01em] [word-spacing:0.05em] uppercase">
              {product.title}
            </h1>

            <div className="mt-4">
              <ProductForm product={product} />
            </div>

            <p className="mt-8 text-[0.9375rem] leading-relaxed text-black/75">{product.description}</p>

            <ul className="mt-6 space-y-2 border-t border-black/10 pt-5 text-[0.8125rem] text-black/70">
              {copy.product.details.map((d) => (
                <li key={d} className="flex items-start gap-2">
                  <span aria-hidden="true" className="mt-[0.4375rem] h-[0.125rem] w-3 flex-none bg-gold-soft" />
                  {d}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {related.length > 0 && (
        <section
          aria-labelledby="related-title"
          className="mx-auto mt-[0.625rem] max-w-(--container) bg-cream px-(--gutter) py-8 pb-24 text-black sm:px-6 lg:px-10 lg:pb-8"
        >
          <h2
            id="related-title"
            className="font-display text-[1.8125rem] leading-none font-extrabold tracking-[-0.045em] [word-spacing:0.08em] uppercase"
          >
            {copy.product.related}
          </h2>
          <Carousel
            label={copy.product.related}
            className="mt-5"
            gridClassName="md:grid md:grid-cols-4 md:gap-x-3 md:gap-y-6"
          >
            {related.map((p, i) => (
              <Reveal as="li" key={p.id} delay={i * 0.06} className="w-[58vw] max-w-[16.25rem] flex-none snap-start md:w-auto md:max-w-none">
                <ProductCard product={p} size="lg" rail />
              </Reveal>
            ))}
          </Carousel>
        </section>
      )}
    </>
  );
}
