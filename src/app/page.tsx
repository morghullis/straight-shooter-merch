import { CollectionStrip } from "@/components/home/CollectionStrip";
import { CrewBand } from "@/components/home/CrewBand";
import { FanZone } from "@/components/home/FanZone";
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

      {/* Below the fold: 3D first, then the fan experience. */}
      <Showroom />
      <Marquee />
      <FanZone />
      <CrewBand />
    </>
  );
}
