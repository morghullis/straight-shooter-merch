import assert from "node:assert/strict";
import { test } from "node:test";

import { groupFaqs } from "../src/lib/catalog/faq";

const entry = (section: string, question: string, position: number | null, answer = "Yes.") => ({ section, question, answer, position });

test("groups by section in the order of the numbers", () => {
  const sections = groupFaqs([
    entry("Shipping", "When?", 30),
    entry("Orders", "Cancel?", 10),
    entry("Orders", "Combine?", 20),
    entry("Shipping", "Where?", 40),
  ]);
  assert.deepEqual(
    sections.map((s) => [s.title, s.items.map((i) => i.question)]),
    [["Orders", ["Cancel?", "Combine?"]], ["Shipping", ["When?", "Where?"]]],
  );
});

test("entries without a number come last, empty ones are left out", () => {
  const sections = groupFaqs([entry("A", "Later?", null), entry("A", "First?", 5), entry("A", "  ", 1), entry("A", "No answer?", 2, " ")]);
  assert.deepEqual(sections[0].items.map((i) => i.question), ["First?", "Later?"]);
});

test("nothing written: no sections", () => {
  assert.deepEqual(groupFaqs([]), []);
});
