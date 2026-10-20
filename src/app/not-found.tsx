import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { copy } from "@/config/copy";

export default function NotFound() {
  const [first, second] = copy.errors.notFoundTitle;
  return (
    <Container as="section" className="flex flex-col items-start py-20">
      <p className="font-type text-[0.75rem] tracking-[0.14em] text-gold uppercase">{copy.errors.notFoundKicker}</p>
      <h1 className="mt-3 font-display text-[clamp(4rem,14vw,10rem)] leading-[0.85] font-extrabold uppercase">
        {first} <span className="text-gold">{second}</span>
      </h1>
      <p className="mt-5 max-w-[46ch] text-[0.9375rem] leading-relaxed text-white/65">{copy.errors.notFoundBody}</p>
      <Button href="/collections/all" className="mt-8">
        {copy.errors.notFoundCta}
      </Button>
    </Container>
  );
}
