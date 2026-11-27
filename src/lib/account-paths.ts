/** The account routes (src/app/account), shared by the server and the cart drawer. */
export const ACCOUNT_PATHS = {
  login: "/account/login",
  callback: "/account/authorize",
  refresh: "/account/refresh",
  logout: "/account/logout",
  /** Off to Shopify's account pages, through this site: pages never link to a Shopify address. */
  manage: "/account/manage",
};

/**
 * Set next to the session while a shopper is signed in, so the page can tell (the empty cart offers
 * their orders instead of sign in). Only a hint: the tokens stay in the httpOnly session cookie.
 */
export const SIGNED_IN_COOKIE = "ss_signed_in";

export function signedInHint(): boolean {
  return (
    typeof document !== "undefined" &&
    document.cookie.split("; ").includes(`${SIGNED_IN_COOKIE}=1`)
  );
}
