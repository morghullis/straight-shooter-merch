import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { textureStyle } from "@/components/ui/Art";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { copy } from "@/config/copy";
import { getFaqs, getPolicies } from "@/lib/catalog";

export const metadata: Metadata = {
  title: copy.faq.title,
  description: copy.faq.description,
  alternates: { canonical: "/faq" },
};

/** Questions and answers from Shopify (Content > Metaobjects > FAQ), grouped by section. */
export default async function FaqPage() {
  const [sections, policies] = await Promise.all([getFaqs(), getPolicies()]);
  if (!sections.length) notFound();

  // Search engines read the same questions as the page shows.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: sections.flatMap((s) =>
      s.items.map((i) => ({ "@type": "Question", name: i.question, acceptedAnswer: { "@type": "Answer", text: i.answer } })),
    ),
  };

  return (
    <Container as="article" className="py-12 sm:py-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <p className="font-type text-[0.75rem] tracking-[0.14em] text-gold uppercase">{copy.faq.kicker}</p>
      <h1 className="mt-3 font-display text-[clamp(3rem,9vw,6rem)] leading-[0.88] font-extrabold uppercase">{copy.faq.title}</h1>

      <div className="relative mt-8 max-w-[52rem] overflow-hidden bg-cream px-6 py-8 text-black sm:px-10 sm:py-10">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-30 mix-blend-multiply" style={textureStyle("paper")} />
        <div className="relative space-y-10">
          {sections.map((section) => (
            <section key={section.title} aria-labelledby={`faq-${slug(section.title)}`}>
              <h2
                id={`faq-${slug(section.title)}`}
                className="font-display text-[1.8125rem] leading-none font-extrabold tracking-[-0.045em] [word-spacing:0.08em] uppercase"
              >
                {section.title}
              </h2>
              <ul className="mt-4 divide-y divide-black/10 border-y border-black/10">
                {section.items.map((item) => (
                  <li key={item.question}>
                    <details className="group [&_summary::-webkit-details-marker]:hidden">
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-[1rem] font-semibold select-none">
                        {item.question}
                        <span aria-hidden="true" className="relative size-2.5 flex-none transition-transform duration-500 group-open:rotate-45">
                          <span className="absolute inset-x-0 top-1/2 h-[0.09375rem] -translate-y-1/2 bg-current" />
                          <span className="absolute inset-y-0 left-1/2 w-[0.09375rem] -translate-x-1/2 bg-current" />
                        </span>
                      </summary>
                      <p className="pb-5 text-[0.9375rem] leading-relaxed whitespace-pre-line text-black/75">{item.answer}</p>
                    </details>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-3">
        {policies.map((p) => (
          <a key={p.handle} href={`/policies/${p.handle}`} className="text-[0.9375rem] font-semibold underline underline-offset-4 hover:text-gold">
            {p.title}
          </a>
        ))}
      </div>
      <div className="mt-6 flex flex-wrap items-center gap-4">
        <p className="text-[0.9375rem] text-white/70">{copy.policies.question}</p>
        <Button href="/contact" variant="outline" size="sm">
          {copy.policies.contact}
        </Button>
      </div>
    </Container>
  );
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
