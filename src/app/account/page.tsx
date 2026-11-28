import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";

import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { copy } from "@/config/copy";
import { site } from "@/config/site";
import {
  ACCOUNT_PATHS,
  accountsConnected,
  fetchCustomer,
  isFresh,
  readSession,
  shopAccountsAvailable,
  type Customer,
  type CustomerOrder,
  type EmailMarketingState,
  type Shipment,
} from "@/lib/customer-account";
import { getFaqs, getPolicies } from "@/lib/catalog";
import { formatMoney } from "@/lib/format";

import { setDropEmails } from "./actions";

export const metadata: Metadata = {
  title: copy.account.title,
  robots: { index: false },
};

const sectionTitle =
  "font-display text-[1.8125rem] leading-none font-extrabold tracking-[-0.045em] [word-spacing:0.08em] uppercase";

type SignInError = keyof typeof copy.account.signInErrors;
type AccountParams = Promise<{ signin?: string; drops?: string }>;

export default function AccountPage({ searchParams }: { searchParams: AccountParams }) {
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
              <Suspense>
                <PolicyLinks />
              </Suspense>
            </div>
            <div id="contact" className="scroll-mt-24">
              <h2 className={sectionTitle}>{copy.account.contactTitle}</h2>
              <p className="mt-3 text-[0.9375rem] leading-relaxed text-black/70">
                {copy.account.contactBody(site.shortName)}
              </p>
              <Button href="/contact" variant="ink" size="sm" className="mt-4">
                {copy.account.contactCta}
              </Button>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

/** The store's policies from Shopify, as links. */
async function PolicyLinks() {
  const [policies, faqs] = await Promise.all([getPolicies(), getFaqs()]);
  const links = [
    ...(faqs.length ? [{ href: "/faq", label: copy.faq.title }] : []),
    ...policies.map((p) => ({ href: `/policies/${p.handle}`, label: p.title })),
  ];
  if (!links.length) return null;
  return (
    <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-[0.9375rem]">
      {links.map((l) => (
        <li key={l.href}>
          <a href={l.href} className="font-semibold underline underline-offset-4 hover:text-gold-soft">
            {l.label}
          </a>
        </li>
      ))}
    </ul>
  );
}

async function AccountPanel({ searchParams }: { searchParams: AccountParams }) {
  const { signin, drops } = await searchParams;
  const error = signin && signin in copy.account.signInErrors ? (signin as SignInError) : null;
  if (!accountsConnected) return <SignedOut error={error} />;

  const session = await readSession();
  if (!session) return <SignedOut error={error} />;
  // Signed in: everything below is this request's (the token's age is checked against the clock).
  await connection();
  // Cookies can only be rewritten by a route, so an expired token is renewed there and comes back.
  if (!isFresh(session)) redirect(`${ACCOUNT_PATHS.refresh}?to=/account`);

  const customer = await fetchCustomer(session.accessToken).catch(() => undefined);
  if (customer === null) redirect(`${ACCOUNT_PATHS.refresh}?to=/account`);
  if (!customer) return <SignedOut error="failed" />;
  return <SignedIn customer={customer} dropsFailed={drops === "failed"} />;
}

/** Sign in or create an account: both on Shopify's page (an emailed code; new emails get an account). */
function SignedOut({ error }: { error?: SignInError | null }) {
  // Forms, not links: the browser goes there for real (Shopify's page), no prefetching.
  const action = accountsConnected ? ACCOUNT_PATHS.login : shopAccountsAvailable ? ACCOUNT_PATHS.manage : null;
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

const small = "font-nav text-[0.6875rem] font-semibold tracking-[0.1em] text-black/50 uppercase";

/** One order: a folding row (number, date, status, total) with its items and shipments inside. */
function OrderRow({ order }: { order: CustomerOrder }) {
  const money = (m: { amount: string; currencyCode: string }) => formatMoney(m.amount, m.currencyCode);
  return (
    <details className="group [&_summary::-webkit-details-marker]:hidden">
      <summary
        aria-label={copy.account.orderDetails(order.name)}
        className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-x-4 gap-y-1 py-3 text-[0.9375rem] select-none"
      >
        <span className="font-semibold">{order.name}</span>
        <span className="text-black/60">{dateFormat.format(new Date(order.processedAt))}</span>
        <span className="capitalize text-black/70">{statusOf(order)}</span>
        <span className="flex items-center gap-3 font-semibold">
          {money(order.totalPrice)}
          <span aria-hidden="true" className="relative size-2.5 transition-transform duration-500 group-open:rotate-45">
            <span className="absolute inset-x-0 top-1/2 h-[0.09375rem] -translate-y-1/2 bg-current" />
            <span className="absolute inset-y-0 left-1/2 w-[0.09375rem] -translate-x-1/2 bg-current" />
          </span>
        </span>
      </summary>

      <div className="space-y-5 pb-5">
        <div>
          <h4 className={small}>{copy.account.items}</h4>
          <ul className="mt-2 space-y-3">
            {order.lineItems.nodes.map((line) => (
              <li key={line.id} className="flex items-center gap-3 text-[0.875rem]">
                <span className="relative size-14 flex-none overflow-hidden rounded-[0.1875rem] bg-sand">
                  {line.image && <Image src={line.image.url} alt={line.image.altText ?? ""} fill sizes="56px" className="object-cover" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{line.name}</span>
                  <span className="block text-black/60">
                    {[line.variantTitle, copy.account.quantity(line.quantity)].filter(Boolean).join(" · ")}
                  </span>
                </span>
                {line.totalPrice && <span className="font-semibold">{money(line.totalPrice)}</span>}
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className={small}>{copy.account.shipments}</h4>
          {order.fulfillments.nodes.length ? (
            <ul className="mt-2 space-y-2 text-[0.875rem]">
              {order.fulfillments.nodes.map((f) => (
                <li key={f.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="font-semibold">{shipmentStatus(f)}</span>
                  <span className="text-black/50">{dateFormat.format(new Date(f.updatedAt))}</span>
                  {f.trackingInformation.map((t, i) => (
                    <span key={t.number ?? i} className="text-black/70">
                      {[t.company, t.number && `${copy.account.trackingNumber} ${t.number}`].filter(Boolean).join(" · ")}
                      {t.url && (
                        <a href={t.url} target="_blank" rel="noopener noreferrer" className="ml-2 font-semibold underline underline-offset-4 hover:text-gold-soft">
                          {copy.account.trackPackage}
                        </a>
                      )}
                    </span>
                  ))}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-[0.875rem] text-black/60">{order.cancelledAt ? copy.account.status.cancelled : copy.account.noShipments}</p>
          )}
        </div>

        <a href={order.statusPageUrl} className="inline-block text-[0.875rem] font-semibold underline underline-offset-4 hover:text-gold-soft">
          {copy.account.trackOrder}
        </a>
      </div>
    </details>
  );
}

function shipmentStatus(f: Shipment): string {
  if (f.status === "CANCELLED") return copy.account.status.cancelled;
  const carrier = copy.account.shipment as Record<string, string>;
  // Without a carrier update yet, it has left the store: "Shipped".
  return (f.latestShipmentStatus && carrier[f.latestShipmentStatus]) || copy.account.status.fulfillment.FULFILLED;
}

/**
 * Sign up for (or stop) the store's emails about new drops. Shopify keeps the consent, so its own emails
 * (New drop / New collection, sent from Shopify Messaging) go to exactly the shoppers who said yes here,
 * at checkout or in the coupon form.
 */
function DropEmails({ state, failed }: { state: EmailMarketingState | null; failed: boolean }) {
  if (!state || state === "REDACTED" || state === "INVALID") return null;
  const on = state === "SUBSCRIBED" || state === "PENDING";
  const text = state === "SUBSCRIBED" ? copy.account.drops.on : state === "PENDING" ? copy.account.drops.pending : copy.account.drops.off;
  return (
    <section id="drops" aria-labelledby="drops-title" className="mt-8 scroll-mt-24 border border-black/15 bg-white/60 px-5 py-4">
      <h3 id="drops-title" className="font-nav text-[0.8125rem] font-semibold tracking-[0.08em] uppercase">
        {copy.account.drops.title}
      </h3>
      <p className="mt-2 max-w-[48ch] text-[0.9375rem] leading-relaxed text-black/70">{text}</p>
      {failed && (
        <p role="alert" className="mt-2 text-[0.8125rem] text-black/80">
          {copy.account.drops.failed}
        </p>
      )}
      <form action={setDropEmails} className="mt-3">
        <input type="hidden" name="subscribe" value={on ? "0" : "1"} />
        <Button type="submit" variant={on ? "ghost" : "ink"} size={on ? "none" : "sm"} className={on ? "text-[0.8125rem] text-black" : undefined}>
          {on ? copy.account.drops.stop : copy.account.drops.start}
        </Button>
      </form>
    </section>
  );
}

function SignedIn({ customer, dropsFailed }: { customer: Customer; dropsFailed: boolean }) {
  const name = customer.firstName || customer.email || "";
  return (
    <div>
      <h2 className={sectionTitle}>{copy.account.greeting(name)}</h2>
      {customer.email && <p className="mt-2 text-[0.9375rem] text-black/60">{customer.email}</p>}

      <h3 className="mt-8 font-nav text-[0.8125rem] font-semibold tracking-[0.08em] uppercase">{copy.account.ordersHeading}</h3>
      {customer.orders.length ? (
        <ul className="mt-3 divide-y divide-black/10 border-y border-black/10">
          {customer.orders.map((order) => (
            <li key={order.id}>
              <OrderRow order={order} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-[0.9375rem] text-black/70">{copy.account.noOrders}</p>
      )}

      <DropEmails state={customer.emailMarketing} failed={dropsFailed} />

      <div className="mt-6 flex flex-wrap items-center gap-3">
        {shopAccountsAvailable && (
          <form action={ACCOUNT_PATHS.manage} method="get">
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
