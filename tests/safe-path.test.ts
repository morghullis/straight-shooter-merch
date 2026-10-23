// The return path after signing in must never lead to another site (open redirect). These are the
// tricks that got through earlier versions (see docs/INCIDENTS.md), plus the ordinary cases.
import assert from "node:assert/strict";
import { test } from "node:test";

import { safeReturnPath } from "../src/lib/safe-path";

const site = "https://site.example";
const leavesSite = (path: string) => new URL(path, site).origin !== site;

const cases: [string | null | undefined, string][] = [
  ["/account", "/account"],
  ["/account?x=1#y", "/account?x=1#y"],
  ["/products/hoodie", "/products/hoodie"],
  ["/a//b", "/a//b"],
  ["evil.com", "/evil.com"],
  ["/%2F%2Fevil.com", "/%2F%2Fevil.com"],
  // other sites, directly
  ["//evil.com", "/account"],
  ["///evil.com", "/account"],
  ["https://evil.com", "/account"],
  ["javascript:alert(1)", "/account"],
  // characters a browser drops or rewrites
  ["/\t/evil.com", "/account"],
  ["/\n/evil.com", "/account"],
  ["/\\evil.com", "/account"],
  ["\\\\evil.com", "/account"],
  // dot segments that collapse into "//evil.com"
  ["/.//evil.com", "/account"],
  ["/..//evil.com", "/account"],
  ["/a/..//evil.com", "/account"],
  ["/././/evil.com", "/account"],
  ["/%2e//evil.com", "/account"],
  ["/%2E%2E//evil.com", "/account"],
  // nothing
  ["", "/account"],
  [null, "/account"],
  [undefined, "/account"],
];

for (const [input, expected] of cases) {
  test(`safeReturnPath(${JSON.stringify(input)})`, () => {
    const got = safeReturnPath(input);
    assert.equal(got, expected);
    assert.equal(leavesSite(got), false, `${got} leaves the site`);
  });
}
