// A photo uploaded again must not spend Meshy credits twice, and the pipeline waits for the merchant to finish.
import assert from "node:assert/strict";
import { test } from "node:test";

import { fingerprint, newPhotos, quietIn } from "../tools/pipeline/lib/photos.mjs";

const photo = (id: string, file: string, more = {}) => ({
  id,
  createdAt: "2026-11-25T06:00:00Z",
  image: { url: `https://cdn.shopify.com/s/files/1/files/${file}?v=1`, width: 1200, height: 1200 },
  originalSource: { fileSize: 1000 },
  ...more,
});
const first = photo("1", "HBCU-Shirt-Black-0.jpg");
const again = photo("2", "HBCU-Shirt-Black-0_9b7fe595-325a-4bc1-ab3f-4e9427cdca7a.jpg");

test("the same file uploaded again is not a new photo", () => {
  assert.equal(fingerprint(first), fingerprint(again));
  assert.deepEqual(newPhotos([again], ["1"], [fingerprint(first)]), []);
});

test("another picture is, even with the same name", () => {
  const other = photo("3", "HBCU-Shirt-Black-0.jpg", { originalSource: { fileSize: 2222 } });
  assert.deepEqual(newPhotos([first, other], ["1"], [fingerprint(first)]), [other]);
  assert.deepEqual(newPhotos([first], [], []), [first], "nothing used yet");
});

test("photos just added are left to settle", () => {
  const at = (m: number) => Date.parse("2026-11-25T06:00:00Z") + m * 60_000;
  assert.equal(quietIn([first], 10 * 60_000, at(4)), 6 * 60_000);
  assert.equal(quietIn([first], 10 * 60_000, at(11)), 0);
  assert.equal(quietIn([], 10 * 60_000, at(0)), 0);
});
