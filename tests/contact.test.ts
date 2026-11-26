import assert from "node:assert/strict";
import { test } from "node:test";

import {
  cleanMessage,
  contactTag,
  messageText,
} from "../src/lib/contact/message";

const ok = {
  name: "Ana",
  email: "Ana@Example.com ",
  topic: "order",
  order: "",
  message: "Where is my hoodie? It has been a week.",
};

test("a good message comes back cleaned", () => {
  const m = cleanMessage({ ...ok, order: "1042" });
  assert.deepEqual(m, {
    name: "Ana",
    email: "ana@example.com",
    topic: "order",
    order: "#1042",
    message: ok.message,
  });
});

test("each field says when it is wrong", () => {
  assert.deepEqual(cleanMessage({ ...ok, name: "" }), { wrong: "name" });
  assert.deepEqual(cleanMessage({ ...ok, email: "ana@" }), { wrong: "email" });
  assert.deepEqual(cleanMessage({ ...ok, topic: "toString" }), {
    wrong: "topic",
  });
  assert.deepEqual(cleanMessage({ ...ok, order: "<script>" }), {
    wrong: "order",
  });
  assert.deepEqual(cleanMessage({ ...ok, message: "hi" }), {
    wrong: "message",
  });
  assert.deepEqual(cleanMessage({ ...ok, message: "x".repeat(2001) }), {
    wrong: "message",
  });
});

test("the message keeps its lines and loses control characters", () => {
  const m = cleanMessage({
    ...ok,
    message: "Line one\r\n\r\n\r\n\r\nLine two\u0000​ ok",
  });
  assert.ok(!("wrong" in m));
  assert.equal(m.message, "Line one\n\nLine two ok");
});

test("what the team reads, and a new tag every time", () => {
  const m = cleanMessage(ok);
  assert.ok(!("wrong" in m));
  const at = new Date("2026-11-26T15:04:05Z");
  assert.equal(
    messageText(m, at),
    `Topic: An order\nOrder: -\nSent: 2026-11-26 15:04 UTC\n\n${ok.message}`,
  );
  assert.equal(contactTag(at), "contact:20261126150405");
});
