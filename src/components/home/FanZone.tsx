import { LaneTicket } from "@/components/fans/LaneTicket";
import { Reveal } from "@/components/motion/Reveal";
import { RevealText } from "@/components/motion/RevealText";
import { Carousel } from "@/components/ui/Carousel";
import { Container } from "@/components/ui/Container";
import { copy } from "@/config/copy";
import { lanes } from "@/config/fans";

/**
 * "Pick your lane": one studio pass per show with its real channel and air days. A swipeable
 * stack on phones, three across from tablet up.
 */
export function FanZone() {
  return (
    <Container as="section" aria-labelledby="fan-title" className="pt-16 pb-6 lg:pt-24">
      <RevealText
        id="fan-title"
        lines={copy.rundown.title}
        accentLine={1}
        className="font-display text-[clamp(3.75rem,11vw,7.5rem)] leading-[0.86] font-extrabold tracking-[-0.01em] uppercase"
      />
      <Reveal y={16} delay={0.2}>
        <p className="mt-5 max-w-[52ch] text-[0.9375rem] leading-relaxed text-white/65">{copy.rundown.lead}</p>
      </Reveal>

      <Carousel
        label={copy.rundown.title.join(" ")}
        className="mt-10 text-white"
        gapClassName="gap-4"
        gridClassName="md:grid md:grid-cols-3"
      >
        {lanes.map((lane, i) => (
          <Reveal
            as="li"
            key={lane.id}
            delay={i * 0.1}
            className="w-[82vw] max-w-[23.75rem] flex-none snap-start py-3 md:w-auto md:max-w-none"
          >
            <LaneTicket lane={lane} number={i + 1} />
          </Reveal>
        ))}
      </Carousel>
    </Container>
  );
}
