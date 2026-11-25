// The coupon popup: what it takes from a visitor, one code per person, and on only between the dates set in Shopify.
import assert from "node:assert/strict";
import { test } from "node:test";

import { cleanCode, cleanLead, codeTag, existingCode, isOn, personalCode, timeLeft } from "../src/lib/coupon/code";

const bytes = new Uint8Array([0, 1, 2, 3, 250, 251, 252, 253]);

test("each person's code belongs to the discount and is easy to type", () => {
  const code = personalCode("WELCOME10", bytes);
  assert.match(code, /^WELCOME10-[A-HJKMNP-Z2-9]{8}$/);
  assert.equal(cleanCode(code.toLowerCase()), code, "codes are not case sensitive");
  assert.ok(codeTag(personalCode("A".repeat(60), bytes)).length <= 40, "fits in a Shopify tag");
});

test("asking twice for the same discount finds the first code", () => {
  const code = personalCode("WELCOME10", bytes);
  assert.equal(existingCode(["vip", codeTag(code)], "WELCOME10"), code);
  assert.equal(existingCode([codeTag(code)], "SUMMER"), null, "another discount is another code");
  assert.equal(existingCode([], "WELCOME10"), null);
});

test("only codes reach Shopify", () => {
  for (const bad of ["", "ab", "a b c", "<script>", "x".repeat(61), null, 12, "DROP'TABLE"]) assert.equal(cleanCode(bad), null, String(bad));
  assert.equal(cleanCode("  hbcu-10 "), "HBCU-10");
});

test("the form: a name, an email, no links", () => {
  assert.deepEqual(cleanLead({ name: "  Ana   María ", email: " Ana@Example.COM " }), { name: "Ana María", email: "ana@example.com" });
  for (const name of ["", "A", "12", "http://spam.example", "www.spam.example"]) assert.deepEqual(cleanLead({ name, email: "a@b.co" }), { wrong: "name" }, name);
  for (const email of ["", "a", "a@b", "a b@c.de", "@b.co", `${"x".repeat(250)}@b.co`]) assert.deepEqual(cleanLead({ name: "Ana", email }), { wrong: "email" }, email);
  assert.deepEqual(cleanLead({ name: "<b>Ana</b>", email: "a@b.co" }), { name: "bAna/b", email: "a@b.co" }, "no markup in Shopify or in the email");
});

test("on exactly between its dates", () => {
  const at = (iso: string) => Date.parse(iso);
  const offer = { startsAt: "2026-11-27T05:00:00Z", endsAt: "2026-11-30T05:00:00Z" };
  assert.equal(isOn(offer, at("2026-11-27T04:59:59Z")), false);
  assert.equal(isOn(offer, at("2026-11-27T05:00:00Z")), true);
  assert.equal(isOn(offer, at("2026-11-30T05:00:00Z")), false);
  assert.equal(isOn({ startsAt: null, endsAt: null }, 0), true, "no dates: always");
});

test("the time left", () => {
  const now = Date.parse("2026-11-27T00:00:00Z");
  assert.equal(timeLeft("2026-11-29T04:30:00Z", now), "2d 4h");
  assert.equal(timeLeft("2026-11-27T05:12:00Z", now), "5h 12m");
  assert.equal(timeLeft("2026-11-27T00:08:00Z", now), "8m");
  assert.equal(timeLeft("2026-11-26T00:00:00Z", now), null);
  assert.equal(timeLeft(null, now), null);
});
