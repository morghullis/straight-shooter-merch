import type { Metadata } from "next";

import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { copy } from "@/config/copy";
import { site } from "@/config/site";

export const metadata: Metadata = {
  title: copy.account.title,
  robots: { index: false },
};

// Set NEXT_PUBLIC_SHOPIFY_ACCOUNT_URL to your store's customer-account login
// (for example https://shop.example.com/account) to enable the sign-in button.
const accountUrl = process.env.NEXT_PUBLIC_SHOPIFY_ACCOUNT_URL;

const sectionTitle =
  "font-display text-[1.8125rem] leading-none font-extrabold tracking-[-0.045em] [word-spacing:0.08em] uppercase";

export default function AccountPage() {
  return (
    <>
      <Container className="pt-8 pb-8 lg:pt-12">
        <h1 className="font-display text-[clamp(3rem,10vw,5.75rem)] leading-[0.9] font-extrabold uppercase">
          {copy.account.title}
        </h1>
      </Container>

      <section className="mx-auto max-w-(--container) bg-cream px-(--gutter) py-10 text-black sm:px-6 xl:px-10">
        <div className="grid gap-10 md:grid-cols-2">
          <div>
            <h2 className={sectionTitle}>{copy.account.ordersTitle}</h2>
            <p className="mt-3 max-w-[48ch] text-[0.9375rem] leading-relaxed text-black/70">{copy.account.ordersBody}</p>
            {accountUrl ? (
              <Button href={accountUrl} className="mt-5">
                {copy.account.signIn}
              </Button>
            ) : (
              <p className="mt-5 max-w-[48ch] border border-black/15 bg-white/60 px-4 py-3 text-[0.8125rem] text-black/70">
                {copy.account.notConnected}
              </p>
            )}
          </div>

          <div className="space-y-8">
            <div id="shipping" className="scroll-mt-24">
              <h2 className={sectionTitle}>{copy.account.shippingTitle}</h2>
              <p className="mt-3 text-[0.9375rem] leading-relaxed text-black/70">{copy.account.shippingBody}</p>
            </div>
            <div id="contact" className="scroll-mt-24">
              <h2 className={sectionTitle}>{copy.account.contactTitle}</h2>
              <p className="mt-3 text-[0.9375rem] leading-relaxed text-black/70">
                {copy.account.contactBody(site.shortName)}
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
