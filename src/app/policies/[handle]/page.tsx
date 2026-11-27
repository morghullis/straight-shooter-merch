import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { textureStyle } from "@/components/ui/Art";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { copy } from "@/config/copy";
import { getPolicies, getPolicy } from "@/lib/catalog";

export async function generateStaticParams() {
  const handles = (await getPolicies()).map((p) => ({ handle: p.handle }));
  // Cache Components needs one page to check at build time, even before any policy is written
  // (or without Shopify): Shopify's own handle for the refund policy, a 404 until it exists.
  return handles.length ? handles : [{ handle: "refund-policy" }];
}

export async function generateMetadata({
  params,
}: PageProps<"/policies/[handle]">): Promise<Metadata> {
  const policy = await getPolicy((await params).handle);
  return policy
    ? {
        title: policy.title,
        alternates: { canonical: `/policies/${policy.handle}` },
      }
    : {};
}

/** A store policy (returns, shipping, privacy, terms) exactly as written in Shopify > Settings > Policies. */
export default function PolicyPage({ params }: PageProps<"/policies/[handle]">) {
  // The handle is read inside Suspense, so a policy written after the deploy renders on demand.
  return (
    <Suspense>
      <Policy params={params} />
    </Suspense>
  );
}

async function Policy({ params }: Pick<PageProps<"/policies/[handle]">, "params">) {
  const policy = await getPolicy((await params).handle);
  if (!policy) notFound();

  return (
    <Container as="article" className="py-12 sm:py-16">
      <p className="font-type text-[0.75rem] tracking-[0.14em] text-gold uppercase">
        {copy.policies.kicker}
      </p>
      <h1 className="mt-3 font-display text-[clamp(3rem,9vw,6rem)] leading-[0.88] font-extrabold uppercase">
        {policy.title}
      </h1>
      <div className="relative mt-8 max-w-[52rem] overflow-hidden bg-cream px-6 py-8 text-black sm:px-10 sm:py-10">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-30 mix-blend-multiply"
          style={textureStyle("paper")}
        />
        {/* Cleaned in the catalog (cleanDescriptionHtml): headings, paragraphs, lists and links only. */}
        <div
          className="product-prose relative text-[0.9375rem] leading-relaxed"
          dangerouslySetInnerHTML={{ __html: policy.body }}
        />
      </div>
      <div className="mt-8 flex flex-wrap items-center gap-4">
        <p className="text-[0.9375rem] text-white/70">
          {copy.policies.question}
        </p>
        <Button href="/contact" variant="outline" size="sm">
          {copy.policies.contact}
        </Button>
      </div>
    </Container>
  );
}
