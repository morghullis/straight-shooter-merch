import Link from "next/link";

import { Reveal } from "@/components/motion/Reveal";
import { ProductCard } from "@/components/product/ProductCard";
import { ArrowRightIcon } from "@/components/ui/Icons";
import { Carousel } from "@/components/ui/Carousel";
import { home } from "@/config/site";
import { getFeaturedProducts } from "@/lib/catalog";

/**
 * Off-white section: heading, gold rule and "View all", then the featured products.
 * Six across on desktop (the reference), three on tablets, a snap carousel on phones.
 */
export async function FeaturedProducts() {
  const { title, count, cta } = home.featured;
  const products = await getFeaturedProducts(count);

  return (
    <section
      aria-labelledby="featured-title"
      className="mx-auto mt-[0.625rem] max-w-(--container) bg-cream px-(--gutter) pt-4 pb-6 text-black md:px-6 xl:pt-[0.1875rem] xl:pr-[1.75rem] xl:pl-[2.5rem]"
    >
      <Reveal className="flex items-center justify-between xl:pr-[1.125rem] xl:pl-[0.1875rem]" y={14}>
        <div className="flex items-center gap-[1.1875rem]">
          <h2
            id="featured-title"
            className="font-display text-[1.8125rem] leading-[1.8125rem] font-extrabold tracking-[-0.045em] [word-spacing:0.08em] uppercase"
          >
            {title}
          </h2>
          <span aria-hidden="true" className="hidden h-[0.125rem] w-[3.0625rem] bg-gold-soft sm:block" />
        </div>

        <Link
          href={cta.href}
          className="inline-flex min-h-10 items-center gap-[0.3125rem] font-nav text-[0.75rem] font-semibold tracking-[0.06em] uppercase hover:text-gold-soft xl:min-h-0 xl:text-[0.65625rem]"
        >
          {cta.label}
          <ArrowRightIcon size={11} strokeWidth={2} />
        </Link>
      </Reveal>

      <Carousel
        label={title}
        className="mt-3 xl:mt-[0.4375rem]"
        gridClassName="md:grid md:grid-cols-3 md:gap-x-[0.625rem] md:gap-y-6 lg:grid-cols-6"
      >
        {products.map((product, i) => (
          <Reveal
            as="li"
            key={product.id}
            delay={0.08 + i * 0.07}
            className="w-[46vw] max-w-[13.125rem] flex-none snap-start md:w-auto md:max-w-none"
          >
            <ProductCard product={product} priority={i < 3} rail />
          </Reveal>
        ))}
      </Carousel>
    </section>
  );
}
