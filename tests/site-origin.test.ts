// Shopify accepts only the registered sign-in addresses, so they must use the site's public address,
// never the deploy address Netlify can hand a function (see docs/INCIDENTS.md).
import assert from "node:assert/strict";
import { test } from "node:test";

import { publicOrigin } from "../src/lib/site-origin";

const deploy = "https://6adbf0d2c6e5806d765fb3b1--straight-shooter-merch.netlify.app";

test("the configured https address wins over the deploy address", () => {
  assert.equal(publicOrigin(deploy, ["https://straight-shooter-merch.netlify.app"]), "https://straight-shooter-merch.netlify.app");
  assert.equal(publicOrigin(deploy, ["https://shop.example.com/some/path"]), "https://shop.example.com");
});

test("without a usable https address the request's origin is used (local runs)", () => {
  assert.equal(publicOrigin("http://localhost:3000", ["http://localhost:3000", undefined]), "http://localhost:3000");
  assert.equal(publicOrigin(deploy, ["", undefined]), deploy);
  assert.equal(publicOrigin(deploy, ["not a url"]), deploy);
});

test("Netlify's own URL is the fallback when the public address is local or missing", () => {
  assert.equal(publicOrigin(deploy, ["http://localhost:3000", "https://straight-shooter-merch.netlify.app"]), "https://straight-shooter-merch.netlify.app");
  assert.equal(publicOrigin(deploy, [undefined, "https://straight-shooter-merch.netlify.app"]), "https://straight-shooter-merch.netlify.app");
});
