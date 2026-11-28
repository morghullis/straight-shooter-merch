import Link from "next/link";
import { cacheLife } from "next/cache";

import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { copy } from "@/config/copy";
import { FOOTER_END_ID, footerHelp, footerShopTitle, site } from "@/config/site";
import { getFaqs, getPolicies } from "@/lib/catalog";
import { getNavLinks } from "@/lib/navigation";

async function CurrentYear() {
  "use cache";
  cacheLife("days");
  return <>{new Date().getFullYear()}</>;
}

const columnTitle =
  "font-display text-[1.375rem] leading-none font-extrabold tracking-[0.02em] text-gold uppercase";

export async function Footer() {
  // The shop column is the navigation (collections come from Shopify), without "Home".
  const shop = { title: footerShopTitle, links: (await getNavLinks()).filter((l) => l.href !== "/") };
  // The store's policies (returns, shipping, privacy, terms), as many as have a text in Shopify.
  const [policyList, faqs] = await Promise.all([getPolicies(), getFaqs()]);
  const policies = policyList.map((p) => ({ label: p.title, href: `/policies/${p.handle}` }));
  // The FAQ page once Shopify has questions for it.
  const faq = faqs.length ? [{ label: copy.faq.title, href: "/faq" }] : [];
  const columns = [shop, { ...footerHelp, links: [...footerHelp.links, ...faq, ...policies] }];

  return (
    <footer className="mt-[0.625rem] border-t border-white/10 bg-black">
      <Container className="grid grid-cols-2 gap-x-6 gap-y-10 py-12 lg:grid-cols-[1.4fr_1fr_1fr_1.2fr]">
        <div className="col-span-2 lg:col-span-1">
          <Link href="/" aria-label={copy.header.home(site.name)} className="inline-block">
            <Logo sizes="(min-width: 1326px) 19.3vw, 256px" className="[--logo-w:16rem]" />
          </Link>
          <p className="mt-4 max-w-[30ch] text-sm leading-relaxed text-white/60">{copy.footer.tagline}</p>
        </div>

        {columns.map((col) => (
          <nav key={col.title} aria-label={col.title}>
            <h2 className={columnTitle}>{col.title}</h2>
            <ul className="mt-4 space-y-1">
              {col.links.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="-mx-1 inline-block px-1 py-2 text-sm text-white/70 transition-colors hover:text-white"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}

        <div className="col-span-2 lg:col-span-1">
          <h2 className={columnTitle}>{copy.footer.officialTitle}</h2>
          <p className="mt-4 max-w-[44ch] text-sm leading-relaxed text-white/60">{copy.footer.officialBody}</p>
          <Button href="/contact" variant="outline" size="sm" className="mt-5">
            {copy.footer.contact}
          </Button>
        </div>
      </Container>

      <div id={FOOTER_END_ID} className="border-t border-white/10">
        <Container className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <p className="py-2 text-xs text-white/40">
            © <CurrentYear /> {site.name}. {copy.footer.rights}
          </p>
        </Container>
      </div>
    </footer>
  );
}
