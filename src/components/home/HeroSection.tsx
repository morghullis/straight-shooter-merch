import { hero } from "@/config/site";
import { getHeroSlides } from "@/lib/catalog";

import { Hero } from "./Hero";
import { HeroCarousel } from "./HeroCarousel";
import { HeroSlide } from "./HeroSlide";

/** The home hero: the brand's own slide first, then one per collection with a hero photo in Shopify. */
export async function HeroSection() {
  const slides = await getHeroSlides();
  if (!slides.length) return <Hero />;

  return (
    <HeroCarousel
      slides={[
        { id: "home", title: hero.lines.map((l) => l.text).join(" "), content: <Hero /> },
        ...slides.flatMap(({ collection, sale }) =>
          collection.hero
            ? [{ id: collection.handle, title: collection.hero.title.join(" "), content: <HeroSlide collection={collection} hero={collection.hero} sale={sale} /> }]
            : [],
        ),
      ]}
    />
  );
}
