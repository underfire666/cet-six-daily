import { test } from "node:test";
import assert from "node:assert/strict";
import { practiceStageHref, readPracticeStage } from "../src/lib/offline/practice-route";

test("local practice route keeps a new session on the loaded module page", () => {
  const href = practiceStageHref("/practice/vocabulary", "", { kind: "session", id: "a1-b2" });
  assert.equal(href, "/practice/vocabulary?session=a1-b2");
  assert.deepEqual(readPracticeStage(new URL(href, "http://local.test").search), {
    kind: "session", id: "a1-b2",
  });
});

test("completion and return replace only the stage, preserving other query state", () => {
  const complete = practiceStageHref("/practice/reading", "?date=2026-09-24&session=abc", {
    kind: "complete", id: "abc",
  });
  assert.equal(complete, "/practice/reading?date=2026-09-24&complete=abc");
  assert.deepEqual(readPracticeStage(new URL(complete, "http://local.test").search), {
    kind: "complete", id: "abc",
  });
  assert.equal(
    practiceStageHref("/practice/reading", "?date=2026-09-24&complete=abc", { kind: "home", id: null }),
    "/practice/reading?date=2026-09-24",
  );
});

test("ambiguous or malformed stage IDs never select another local session", () => {
  for (const search of ["?session=", "?session=abc&complete=xyz", "?session=../../api/auth/session", "?complete=x%2Fy"]) {
    assert.deepEqual(readPracticeStage(search), { kind: "home", id: null });
  }
});

test("wordbook can open from the loaded vocabulary page without a route request", () => {
  const href = practiceStageHref("/practice/vocabulary", "?complete=abc", { kind: "wordbook", id: null });
  assert.equal(href, "/practice/vocabulary?wordbook=1");
  assert.deepEqual(readPracticeStage("?wordbook=1"), { kind: "wordbook", id: null });
});
