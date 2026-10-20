"use client";

import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { copy } from "@/config/copy";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <Container as="section" className="flex flex-col items-start py-20">
      <p className="font-type text-[0.75rem] tracking-[0.14em] text-gold uppercase">{copy.errors.errorKicker}</p>
      <h1 className="mt-3 font-display text-[clamp(3.5rem,12vw,7.5rem)] leading-[0.88] font-extrabold uppercase">
        {copy.errors.errorTitle}
      </h1>
      <p className="mt-5 max-w-[46ch] text-[0.9375rem] leading-relaxed text-white/65">{copy.errors.errorBody}</p>
      <Button onClick={reset} className="mt-8">
        {copy.errors.retry}
      </Button>
    </Container>
  );
}
