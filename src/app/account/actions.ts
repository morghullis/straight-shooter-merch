"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";

import { ACCOUNT_PATHS, isFresh, readSession, setEmailMarketing } from "@/lib/customer-account";

/** The account page's "new drops by email" button: signs the shopper up, or stops the emails. */
export async function setDropEmails(formData: FormData) {
  const session = await readSession();
  if (!session) redirect("/account");
  // Cookies are rewritten by the refresh route; the shopper comes back and presses again.
  if (!isFresh(session)) redirect(`${ACCOUNT_PATHS.refresh}?to=/account`);

  const subscribe = formData.get("subscribe") === "1";
  const accepted = await setEmailMarketing(session.accessToken, subscribe).catch(() => undefined);
  if (accepted === false) redirect(`${ACCOUNT_PATHS.refresh}?to=/account`);
  // The account page is per shopper and the browser keeps a copy: it must show the new state now.
  refresh();
  redirect(accepted ? "/account#drops" : "/account?drops=failed#drops");
}
