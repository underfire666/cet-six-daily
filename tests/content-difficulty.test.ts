import test from "node:test";
import assert from "node:assert/strict";
import { unifiedDifficulty } from "../src/content/difficulty";
import { registerBuiltinPacks } from "../src/content/packs";
import { getItems } from "../src/content/registry";
import { resetRegistry } from "../src/content/registry";

function setup() {
  resetRegistry();
  registerBuiltinPacks();
}

test("difficulty: vocabulary 1-5 maps to easy/normal/hard", () => {
  assert.equal(unifiedDifficulty({ type: "vocabulary", difficulty: 1 }), "easy");
  assert.equal(unifiedDifficulty({ type: "vocabulary", difficulty: 2 }), "easy");
  assert.equal(unifiedDifficulty({ type: "vocabulary", difficulty: 3 }), "normal");
  assert.equal(unifiedDifficulty({ type: "vocabulary", difficulty: 4 }), "hard");
  assert.equal(unifiedDifficulty({ type: "vocabulary", difficulty: 5 }), "hard");
});

test("difficulty: invalid vocabulary difficulty falls back to normal (documented)", () => {
  assert.equal(unifiedDifficulty({ type: "vocabulary", difficulty: 9 }), "normal");
  assert.equal(unifiedDifficulty({ type: "vocabulary" }), "normal");
});

test("difficulty: reading/listening keep their own value", () => {
  assert.equal(unifiedDifficulty({ type: "reading", difficulty: "easy" }), "easy");
  assert.equal(unifiedDifficulty({ type: "listening", difficulty: "hard" }), "hard");
});

test("difficulty: translation/writing (no difficulty field) resolve to normal", () => {
  assert.equal(unifiedDifficulty({ type: "translation" }), "normal");
  assert.equal(unifiedDifficulty({ type: "writing" }), "normal");
});

test("difficulty: every registered mock item has a unified difficulty (no unspecified)", () => {
  setup();
  const items = getItems<{ type?: string; difficulty?: unknown }>();
  assert.ok(items.length >= 59);
  for (const item of items) {
    const d = unifiedDifficulty(item);
    assert.ok(["easy", "normal", "hard"].includes(d), `unexpected difficulty ${d}`);
  }
});
