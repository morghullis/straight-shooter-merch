import { CollectionStrip } from "@/components/home/CollectionStrip";
import { FeaturedProducts } from "@/components/home/FeaturedProducts";
import { Hero } from "@/components/home/Hero";
import { Marquee } from "@/components/home/Marquee";
import { Showroom } from "@/components/home/Showroom";

export default function HomePage() {
  return (
    <>
      {/* The reference design: header (layout) + these three blocks. */}
      <Hero />
      <CollectionStrip />
      <FeaturedProducts />

      {/* Below the fold: the 3D showroom and the catchphrases. */}
      <Showroom />
      <Marquee />
    </>
  );
}
