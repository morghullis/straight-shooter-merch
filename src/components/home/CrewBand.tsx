import { FanQuiz, type QuizPick } from "@/components/fans/FanQuiz";
import { JoinCrew } from "@/components/fans/JoinCrew";
import { Reveal } from "@/components/motion/Reveal";
import { Container } from "@/components/ui/Container";
import { lanes, type LaneId } from "@/config/fans";
import { getProducts } from "@/lib/catalog";
import { formatMoney } from "@/lib/format";

/** Ballot (recommends real products per lane) next to the season-pass sign-up. */
export async function CrewBand() {
  const entries = await Promise.all(
    lanes.map(async (lane) => {
      const products = await getProducts({ collection: lane.collection });
      const picks: QuizPick[] = products.slice(0, 3).map((p) => ({
        handle: p.handle,
        title: p.title,
        price: formatMoney(p.price.amount, p.price.currencyCode),
        image: p.featuredImage.url,
        alt: p.featuredImage.altText || p.title,
      }));
      return [lane.id, picks] as const;
    }),
  );
  const picks = Object.fromEntries(entries) as Record<LaneId, QuizPick[]>;

  return (
    <Container className="grid gap-5 pt-12 pb-20 lg:grid-cols-[1.1fr_1fr] lg:pt-16">
      <Reveal y={24}>
        <FanQuiz picks={picks} />
      </Reveal>
      <Reveal y={24} delay={0.1} className="[&>section]:h-full">
        <JoinCrew />
      </Reveal>
    </Container>
  );
}
