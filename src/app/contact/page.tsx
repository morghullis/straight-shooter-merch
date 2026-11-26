import type { Metadata } from "next";

import { ContactForm } from "@/components/contact/ContactForm";
import { Art, textureStyle } from "@/components/ui/Art";
import { Container } from "@/components/ui/Container";
import { copy } from "@/config/copy";

const t = copy.contact;

export const metadata: Metadata = {
  title: t.title,
  description: t.description,
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  const [first, second] = t.heading;
  return (
    <Container
      as="section"
      className="grid gap-10 py-12 sm:py-16 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-14"
    >
      <div>
        <p className="font-type text-[0.75rem] tracking-[0.14em] text-gold uppercase">
          {t.kicker}
        </p>
        <h1 className="mt-3 font-display text-[clamp(4rem,12vw,8.5rem)] leading-[0.85] font-extrabold uppercase">
          {first} <span className="block text-gold">{second}</span>
        </h1>
        <p className="mt-5 max-w-[42ch] text-[0.9375rem] leading-relaxed text-white/70">
          {t.lead}
        </p>
        <ul className="mt-8 grid gap-5 border-t border-white/15 pt-6">
          {t.points.map((p) => (
            <li key={p.title}>
              <p className="font-nav text-[0.8125rem] font-semibold tracking-[0.12em] text-gold uppercase">
                {p.title}
              </p>
              <p className="mt-1 max-w-[46ch] text-[0.875rem] leading-relaxed text-white/65">
                {p.text}
              </p>
            </li>
          ))}
        </ul>
      </div>

      <div className="relative self-start overflow-hidden bg-gold px-6 py-7 text-[#14110a] shadow-[0_2rem_4rem_-1rem_rgba(0,0,0,0.9)] sm:px-9 sm:py-10">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-45 mix-blend-multiply"
          style={textureStyle("paper")}
        />
        <Art
          name="stickerOfficial"
          sizes="130px"
          className="pointer-events-none absolute -right-5 -bottom-6 h-auto w-[7.5rem] rotate-12 opacity-25 mix-blend-multiply"
        />
        {/* The perforation of the ticket */}
        <span
          aria-hidden="true"
          className="absolute inset-x-0 top-0 border-t-2 border-dashed border-[#14110a]/40"
        />
        <div className="relative">
          <ContactForm />
        </div>
      </div>
    </Container>
  );
}
