import { CollectionStrip } from "@/components/home/CollectionStrip";
import { FeaturedProducts } from "@/components/home/FeaturedProducts";
import { HeroSection } from "@/components/home/HeroSection";
import { Marquee } from "@/components/home/Marquee";
import { Showroom } from "@/components/home/Showroom";

export default function HomePage() {
  return (
    <>
      {/* The reference design: header (layout) + these three blocks. */}
      <HeroSection />
      <CollectionStrip />
      <FeaturedProducts />

      {/* Below the fold: the 3D showroom and the catchphrases. */}
      <Showroom />
      <Marquee />
    </>
  );
}
