// Product descriptions come from Shopify's editor and are put into the page as HTML: only plain
// structure may get through (no scripts, handlers, styles or unsafe links).
import assert from "node:assert/strict";
import { test } from "node:test";

import { cleanDescriptionHtml } from "../src/lib/catalog/description";

test("keeps headings, paragraphs, lists and bold; drops spans, classes and styles", () => {
  const html = `<h2><strong>Thats just BLASPHEMOUS!</strong></h2><p class="p1"><span class="s1" style="color:red">Bold <b>look</b></span></p><ul><li><span>One</span></li></ul>`;
  assert.equal(cleanDescriptionHtml(html), `<h3><strong>Thats just BLASPHEMOUS!</strong></h3><p>Bold <strong>look</strong></p><ul><li>One</li></ul>`);
});

test("removes scripts, event handlers, iframes and javascript: links", () => {
  const html = `<p onclick="alert(1)">Hi<script>alert(1)</script></p><iframe src="https://x"></iframe><img src=x onerror=alert(1)><a href="javascript:alert(1)">x</a><a href="https://shop.example/a">ok</a>`;
  const clean = cleanDescriptionHtml(html);
  for (const bad of ["script", "onclick", "onerror", "iframe", "<img", "javascript:"]) assert.ok(!clean.includes(bad), `${bad} got through: ${clean}`);
  assert.match(clean, /<a href="https:\/\/shop\.example\/a" rel="noopener noreferrer" target="_blank">ok<\/a>/);
});

test("drops empty blocks and stray line breaks pasted from other apps", () => {
  const html = `<h3><meta charset="UTF-8"></h3><p><br></p><p><br>Text<br></p><ul data-spread="false"><li><p><span>Item</span></p></li></ul>`;
  assert.equal(cleanDescriptionHtml(html), `<p>Text</p><ul><li><p>Item</p></li></ul>`);
});

test("an empty description stays empty", () => {
  assert.equal(cleanDescriptionHtml(""), "");
  assert.equal(cleanDescriptionHtml("  "), "");
});
