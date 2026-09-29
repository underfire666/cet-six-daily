import test from "node:test";
import assert from "node:assert/strict";
import { resetRegistry, getPaperById, getPublishableItems } from "../src/content/registry";
import { registerBuiltinPacks } from "../src/content/packs";
import { registerSyntheticPaperFixture, SYNTHETIC_PAPER_ID } from "../src/content/fixture/cet6-2025-12-synthetic";
import { replayReviewItem, replayReviewItemQa } from "../src/lib/review/replay";
import { MOCK_PAPER_001_ID } from "../src/content/papers/cet6-mock-paper-001";
import type { ReviewItem } from "../src/types/review";

function basePaperReviewItem(over: Partial<ReviewItem>): ReviewItem {
  return {
    id: "paper-review-1",
    contentType: "question",
    sourceModule: "reading",
    sourceActivityId: SYNTHETIC_PAPER_ID,
    questionId: `${SYNTHETIC_PAPER_ID}:reading:cloze:g1:q1`,
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

// V13 Final: Paper 001 已发布（active），进入 production 池
test("production boundary: registerBuiltinPacks exposes Paper001 (active) in production", () => {
  resetRegistry();
  registerBuiltinPacks();
  const paper = getPaperById(MOCK_PAPER_001_ID) as { status?: string } | undefined;
  assert.ok(paper, "Paper001 (active) must be registered by registerBuiltinPacks");
  assert.equal(paper!.status, "active");
  const publishable = getPublishableItems("paper");
  assert.ok(publishable.some((p) => (p as { paperId?: string }).paperId === MOCK_PAPER_001_ID), "Paper001 must be in publishable pool");
});

test("staging boundary: synthetic fixture (staging) is NOT exposed by registerBuiltinPacks", () => {
  resetRegistry();
  registerBuiltinPacks();
  const paper = getPaperById(SYNTHETIC_PAPER_ID);
  assert.equal(paper, undefined, "Synthetic fixture (staging) must not be registered by registerBuiltinPacks");
});

test("staging boundary: getPublishableItems excludes synthetic fixture even when QA-registered", () => {
  resetRegistry();
  registerBuiltinPacks();
  registerSyntheticPaperFixture(); // QA/staging registration should not affect publishable pool
  const publishable = getPublishableItems("paper");
  assert.ok(!publishable.some((p) => (p as { paperId?: string }).paperId === SYNTHETIC_PAPER_ID), "Synthetic fixture (staging) must not be publishable");
  // Paper 001 (active) IS publishable
  assert.ok(publishable.some((p) => (p as { paperId?: string }).paperId === MOCK_PAPER_001_ID), "Paper001 (active) must be publishable");
});

test("staging boundary: production replay cannot resolve crafted staging Paper ReviewItem", () => {
  resetRegistry();
  registerBuiltinPacks();
  registerSyntheticPaperFixture(); // even when registered, production replay must reject staging
  const item = basePaperReviewItem({});
  const r = replayReviewItem(item);
  assert.equal(r, null, "Production replay must NOT resolve staging Paper content");
});

test("staging boundary: production replay CAN resolve active Paper001 ReviewItem", () => {
  resetRegistry();
  registerBuiltinPacks();
  const item: ReviewItem = {
    ...basePaperReviewItem({}),
    sourceActivityId: MOCK_PAPER_001_ID,
    questionId: `${MOCK_PAPER_001_ID}:reading:cloze:g1:q1`,
  };
  const r = replayReviewItem(item);
  assert.ok(r, "Production replay must resolve active Paper001 content");
  assert.equal(r!.activityId, MOCK_PAPER_001_ID);
});

test("staging boundary: QA replay CAN resolve legitimate staging Paper ReviewItem", () => {
  resetRegistry();
  registerBuiltinPacks();
  registerSyntheticPaperFixture();
  const item = basePaperReviewItem({});
  const r = replayReviewItemQa(item);
  assert.ok(r, "QA replay must resolve staging Paper content");
  assert.equal(r!.activityId, SYNTHETIC_PAPER_ID);
  assert.ok(r!.prompt.length > 0);
  assert.ok(r!.options.length >= 2);
});

test("staging boundary: QA replay cannot resolve staging Paper when not registered", () => {
  resetRegistry();
  registerBuiltinPacks(); // no registerSyntheticPaperFixture
  const item = basePaperReviewItem({});
  const r = replayReviewItemQa(item);
  assert.equal(r, null, "QA replay must return null when staging Paper is not registered");
});

test("staging boundary: V9 reading replay unchanged after staging guard", () => {
  resetRegistry();
  registerBuiltinPacks();
  const item: ReviewItem = {
    id: "r1",
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
  };
  const r = replayReviewItem(item);
  assert.ok(r, "Reading replay must still work");
  assert.equal(r!.sourceModule, "reading");
  assert.equal(r!.questionId, "q1");
  assert.ok(r!.articlePassage);
});

test("staging boundary: V9 listening replay unchanged after staging guard", () => {
  resetRegistry();
  registerBuiltinPacks();
  const item: ReviewItem = {
    id: "l1",
    contentType: "question",
    sourceModule: "listening",
    sourceActivityId: "l-campus-meeting",
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
  };
  const r = replayReviewItem(item);
  assert.ok(r, "Listening replay must still work");
  assert.equal(r!.sourceModule, "listening");
  assert.ok(r!.transcript);
});

test("staging boundary: V9 vocabulary replay unchanged after staging guard", () => {
  resetRegistry();
  registerBuiltinPacks();
  const item: ReviewItem = {
    id: "v1",
    contentType: "question",
    sourceModule: "vocabulary",
    sourceActivityId: "word_sustain",
    questionId: "vq:word_sustain",
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
  };
  const r = replayReviewItem(item);
  assert.ok(r, "Vocabulary replay must still work");
  assert.equal(r!.sourceModule, "vocabulary");
  assert.equal(r!.options.length, 4);
});
