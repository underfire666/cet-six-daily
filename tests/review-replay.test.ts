import test from "node:test";
import assert from "node:assert/strict";
import { resetRegistry, registerContentPack, getContentPack } from "../src/content/registry";
import { registerBuiltinPacks } from "../src/content/packs";
import { replayReviewItem } from "../src/lib/review/replay";
import type { ReviewItem } from "../src/types/review";
import type { ContentPack } from "../src/content/types";

function setup() {
  resetRegistry();
  registerBuiltinPacks();
}

function baseItem(over: Partial<ReviewItem>): ReviewItem {
  return {
    id: "x",
    contentType: "question",
    sourceModule: "reading",
    sourceActivityId: "r-ai-screening",
    questionId: "q1",
    createdAt: "2026-09-21T00:00:00.000Z",
    updatedAt: "2026-09-21T00:00:00.000Z",
    nextReviewAt: "2026-09-22",
    masteryStatus: "weak",
    reviewCount: 1,
    correctStreak: 0,
    wrongCount: 1,
    priority: 0,
    favorite: false,
    removed: false,
    history: [],
    schemaVersion: 1,
    ...over,
  };
}

test("replay: reading ReviewItem resolves question via Repository", () => {
  setup();
  const item = baseItem({});
  const r = replayReviewItem(item);
  assert.ok(r);
  assert.equal(r!.sourceModule, "reading");
  assert.equal(r!.questionId, "q1");
  assert.ok(r!.prompt.length > 0);
  assert.equal(r!.options.length, 4);
  assert.ok(r!.options.some((o) => o.id === r!.correctOptionId));
  assert.ok(r!.shortExplanation.length > 0);
  assert.ok(r!.articlePassage && r!.articlePassage.length > 0);
});

test("replay: listening ReviewItem resolves via Repository with transcript", () => {
  setup();
  const item = baseItem({ sourceModule: "listening", sourceActivityId: "l-campus-meeting", questionId: "q1" });
  const r = replayReviewItem(item);
  assert.ok(r);
  assert.equal(r!.sourceModule, "listening");
  assert.ok(r!.transcript && r!.transcript.length > 0);
});

test("replay: vocabulary ReviewItem generates a 4-option question", () => {
  setup();
  const item = baseItem({ sourceModule: "vocabulary", sourceActivityId: "word_sustain", questionId: "vq:word_sustain" });
  const r = replayReviewItem(item);
  assert.ok(r);
  assert.equal(r!.sourceModule, "vocabulary");
  assert.equal(r!.options.length, 4);
  assert.ok(r!.options.some((o) => o.id === r!.correctOptionId));
});

test("replay: wrongOptionId snapshot is surfaced", () => {
  setup();
  const item = baseItem({ lastWrongOptionId: "b" });
  const r = replayReviewItem(item);
  assert.ok(r);
  assert.equal(r!.wrongOptionId, "b");
});

test("replay: legacy item without snapshot still replays (wrongOptionId undefined)", () => {
  setup();
  const item = baseItem({});
  assert.equal(item.lastWrongOptionId, undefined);
  const r = replayReviewItem(item);
  assert.ok(r);
  assert.equal(r!.wrongOptionId, undefined);
});

test("replay: missing content returns null (graceful degradation)", () => {
  setup();
  const item = baseItem({ sourceActivityId: "r-does-not-exist" });
  assert.equal(replayReviewItem(item), null);
});

test("replay: missing question id returns null", () => {
  setup();
  const item = baseItem({ questionId: "q99" });
  assert.equal(replayReviewItem(item), null);
});

test("replay: deprecated content still resolves historically", () => {
  setup();
  const pack = structuredClone(getContentPack("pack-reading-mock")!) as ContentPack;
  pack.id = "replay-archive";
  pack.items = [{ ...(pack.items[0] as object), id: "r-old", status: "deprecated" }];
  registerContentPack(pack);
  const item = baseItem({ sourceActivityId: "r-old" });
  const r = replayReviewItem(item);
  assert.ok(r);
  assert.equal(r!.activityId, "r-old");
});
