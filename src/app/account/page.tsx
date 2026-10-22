import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { copy } from "@/config/copy";
import { site } from "@/config/site";
import {
  ACCOUNT_PATHS,
  accountsConnected,
  fetchCustomer,
  hostedAccountUrl,
  isFresh,
  readSession,
  type Customer,
  type CustomerOrder,
} from "@/lib/customer-account";
import { formatMoney } from "@/lib/format";

export const metadata: Metadata = {
  title: copy.account.title,
  robots: { index: false },
};

const sectionTitle =
  "font-display text-[1.8125rem] leading-none font-extrabold tracking-[-0.045em] [word-spacing:0.08em] uppercase";

type SignInError = keyof typeof copy.account.signInErrors;

export default function AccountPage({ searchParams }: { searchParams: Promise<{ signin?: string }> }) {
  return (
    <>
      <Container className="pt-8 pb-8 lg:pt-12">
        <h1 className="font-display text-[clamp(3rem,10vw,5.75rem)] leading-[0.9] font-extrabold uppercase">
          {copy.account.title}
        </h1>
      </Container>

      <section className="mx-auto max-w-(--container) bg-cream px-(--gutter) py-10 text-black sm:px-6 xl:px-10">
        <div className="grid gap-10 md:grid-cols-2">
          {/* Reads the shopper's session, so it streams in at request time; the rest is static. */}
          <Suspense fallback={<SignedOut />}>
            <AccountPanel searchParams={searchParams} />
          </Suspense>

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

async function AccountPanel({ searchParams }: { searchParams: Promise<{ signin?: string }> }) {
  const { signin } = await searchParams;
  const error = signin && signin in copy.account.signInErrors ? (signin as SignInError) : null;
  if (!accountsConnected) return <SignedOut error={error} />;

  const session = await readSession();
  if (!session) return <SignedOut error={error} />;
  // Cookies can only be rewritten by a route, so an expired token is renewed there and comes back.
  if (!isFresh(session)) redirect(`${ACCOUNT_PATHS.refresh}?to=/account`);

  const customer = await fetchCustomer(session.accessToken).catch(() => undefined);
  if (customer === null) redirect(`${ACCOUNT_PATHS.refresh}?to=/account`);
  if (!customer) return <SignedOut error="failed" />;
  return <SignedIn customer={customer} />;
}

/** Sign in or create an account: both on Shopify's page (an emailed code; new emails get an account). */
function SignedOut({ error }: { error?: SignInError | null }) {
  // Forms, not links: the browser goes there for real (Shopify's page), no prefetching.
  const action = accountsConnected ? ACCOUNT_PATHS.login : hostedAccountUrl;
  return (
    <div>
      <h2 className={sectionTitle}>{copy.account.ordersTitle}</h2>
      <p className="mt-3 max-w-[48ch] text-[0.9375rem] leading-relaxed text-black/70">{copy.account.ordersBody}</p>
      {error && (
        <p role="alert" className="mt-4 max-w-[48ch] border border-black/15 bg-white/60 px-4 py-3 text-[0.8125rem] text-black/80">
          {copy.account.signInErrors[error]}
        </p>
      )}
      {action ? (
        <>
          <form action={action} method="get" className="mt-5 flex flex-wrap gap-3">
            <Button type="submit">{copy.account.signIn}</Button>
            <Button type="submit" variant="ink">
              {copy.account.createAccount}
            </Button>
          </form>
          <p className="mt-4 max-w-[48ch] text-[0.8125rem] leading-relaxed text-black/60">{copy.account.howItWorks}</p>
        </>
      ) : (
        <p className="mt-5 max-w-[48ch] border border-black/15 bg-white/60 px-4 py-3 text-[0.8125rem] text-black/70">
          {copy.account.notConnected}
        </p>
      )}
    </div>
  );
}

const dateFormat = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });

function statusOf(order: CustomerOrder): string {
  if (order.cancelledAt) return copy.account.status.cancelled;
  const s = copy.account.status.fulfillment as Record<string, string>;
  return s[order.fulfillmentStatus] ?? order.fulfillmentStatus.replace(/_/g, " ").toLowerCase();
}

function SignedIn({ customer }: { customer: Customer }) {
  const name = customer.firstName || customer.email || "";
  return (
    <div>
      <h2 className={sectionTitle}>{copy.account.greeting(name)}</h2>
      {customer.email && <p className="mt-2 text-[0.9375rem] text-black/60">{customer.email}</p>}

      <h3 className="mt-8 font-nav text-[0.8125rem] font-semibold tracking-[0.08em] uppercase">{copy.account.ordersHeading}</h3>
      {customer.orders.length ? (
        <ul className="mt-3 divide-y divide-black/10 border-y border-black/10">
          {customer.orders.map((order) => (
            <li key={order.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-3 text-[0.9375rem]">
              <span className="font-semibold">{order.name}</span>
              <span className="text-black/60">{dateFormat.format(new Date(order.processedAt))}</span>
              <span className="capitalize text-black/70">{statusOf(order)}</span>
              <span className="font-semibold">{formatMoney(order.totalPrice.amount, order.totalPrice.currencyCode)}</span>
              <a href={order.statusPageUrl} className="underline underline-offset-4 hover:text-gold-soft">
                {copy.account.trackOrder}
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-[0.9375rem] text-black/70">{copy.account.noOrders}</p>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        {hostedAccountUrl && (
          <form action={hostedAccountUrl} method="get">
            <Button type="submit" variant="ink">
              {copy.account.manage}
            </Button>
          </form>
        )}
        <form action={ACCOUNT_PATHS.logout} method="post">
          <Button type="submit" variant="ghost" className="text-black">
            {copy.account.signOut}
          </Button>
        </form>
      </div>
    </div>
  );
}
