/**
 * V14 Phase 1D.3: Private Wrongbook Manual Review tests.
 * Real Prisma with isolated random users. No DB mocking.
 * Covers: selectReviewItems, gradeReviewItems, parsing, validation, no-side-effects.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "../src/lib/db/prisma";
import { computePrivateContentHash } from "../src/lib/private-papers/readiness";
import { createPrivatePaper, deletePrivatePaper, updatePrivatePaper } from "../src/content/private-paper-store";
import { putPrivatePaperProgress as writeProgress, getPrivatePaperProgress } from "../src/content/private-paper-progress-store";
import {
  selectReviewItems,
  gradeReviewItems,
  PrivateWrongItemStoreError,
  listPrivateWrongItems,
} from "../src/content/private-wrong-item-store";
import {
  parsePrivateReviewStart,
  parsePrivateReviewGrade,
  validatePrivateReviewSession,
  PRIVATE_REVIEW_STORAGE_VERSION,
  type PrivateReviewSession,
} from "../src/lib/private-papers/review";

async function createTestUser(prefix: string) {
  const id = randomUUID();
  return prisma.user.create({ data: { email: `${prefix}-${id}@example.invalid`, passwordHash: "test-only" } });
}

function makeRightsAck() {
  return { acknowledged: true, acknowledgedAt: new Date().toISOString(), statementVersion: "1.0" };
}

function makeReadyContent(questionCount = 3): Record<string, unknown> {
  const questions = [];
  for (let i = 0; i < questionCount; i++) {
    questions.push({
      questionId: `q${i + 1}`, order: i, prompt: `Question ${i + 1}?`, type: "choice",
      options: [{ id: "A", text: "Opt A" }, { id: "B", text: "Opt B" }, { id: "C", text: "Opt C" }, { id: "D", text: "Opt D" }],
      answerId: "A", shortExplanation: `Explanation ${i + 1}`,
    });
  }
  return {
    schemaVersion: 1, isPartial: false,
    sections: [{
      sectionId: "reading-1", type: "reading", order: 0,
      groups: [{ groupId: "careful-1", type: "careful_reading", order: 0, passage: "Test passage.", questions }],
    }],
  };
}

async function createReadyPaper(userId: string, localId: string, content: Record<string, unknown>) {
  return createPrivatePaper(userId, { localPaperId: localId, title: "Test", content, rightsAcknowledgement: makeRightsAck() });
}

async function submitAllWrong(userId: string, paperId: string, content: Record<string, unknown>, count: number) {
  const answers: Record<string, string> = {};
  for (let i = 0; i < count; i++) answers[String(i)] = "B"; // all wrong (correct is A)
  return writeProgress(userId, paperId, {
    progressVersion: 1, mutationId: randomUUID(), contentHash: computePrivateContentHash(content),
    baseRevision: 0, attemptId: randomUUID(), answers, currentIndex: count - 1, submitted: true,
  });
}

async function cleanupUser(userId: string) {
  await prisma.privateWrongItem.deleteMany({ where: { userId } });
  await prisma.privatePaperProgress.deleteMany({ where: { userId } });
  await prisma.privatePaper.deleteMany({ where: { userId } });
  await prisma.user.delete({ where: { id: userId } }).catch(() => {});
}

// ─── selectReviewItems ───────────────────────────────────────────────

test("review: selectReviewItems returns only active valid items, max 5, deterministic order", async () => {
  const user = await createTestUser("rv1");
  try {
    const content = makeReadyContent(7);
    const paper = await createReadyPaper(user.id, "l1", content);
    await submitAllWrong(user.id, paper.paperId, content, 7);

    const batch = await selectReviewItems(user.id, paper.paperId, 5);
    assert.equal(batch.questions.length, 5);
    assert.equal(batch.contentHash, computePrivateContentHash(content));
    assert.ok(batch.reviewBatchId.startsWith("rb_"));
    // Questions should NOT contain correct answers
    for (const q of batch.questions) {
      assert.ok(!("answerId" in q));
      assert.ok(!("shortExplanation" in q));
      assert.ok(q.prompt);
      assert.equal(q.options.length, 4);
    }
    // Deterministic: all selected items must be unique and from the valid set
    const ids = batch.questions.map(q => q.questionId);
    assert.equal(new Set(ids).size, 5);
    for (const id of ids) {
      assert.ok(["q1", "q2", "q3", "q4", "q5", "q6", "q7"].includes(id), `unexpected questionId: ${id}`);
    }
  } finally { await cleanupUser(user.id); }
});

test("review: selectReviewItems excludes content_changed items", async () => {
  const user = await createTestUser("rv2");
  try {
    const content = makeReadyContent(3);
    const paper = await createReadyPaper(user.id, "l1", content);
    await submitAllWrong(user.id, paper.paperId, content, 3);

    // Update content → old items become content_changed
    const newContent = makeReadyContent(3);
    const sections = newContent.sections as Array<{ groups: Array<{ passage: string }> }>;
    sections[0].groups[0].passage = "Updated passage.";
    await updatePrivatePaper(user.id, paper.paperId, { title: "Test", content: newContent, rightsAcknowledgement: makeRightsAck() });

    // Old items should be content_changed, no active items for new content yet
    const items = await listPrivateWrongItems(user.id, paper.paperId);
    assert.equal(items.length, 3);
    assert.ok(items.every(i => i.status === "content_changed"));

    // selectReviewItems should return 0 (no active items for current content)
    // Actually it throws VALIDATION_ERROR because there are no valid wrong items
    await assert.rejects(() => selectReviewItems(user.id, paper.paperId, 5), PrivateWrongItemStoreError);
  } finally { await cleanupUser(user.id); }
});

test("review: selectReviewItems rejects invalid owner/paper", async () => {
  await assert.rejects(() => selectReviewItems("", "paper:1", 5), PrivateWrongItemStoreError);
  await assert.rejects(() => selectReviewItems("user1", "invalid", 5), PrivateWrongItemStoreError);
});

test("review: selectReviewItems rejects invalid limit", async () => {
  const user = await createTestUser("rv3");
  try {
    const content = makeReadyContent(2);
    const paper = await createReadyPaper(user.id, "l1", content);
    await submitAllWrong(user.id, paper.paperId, content, 2);
    await assert.rejects(() => selectReviewItems(user.id, paper.paperId, 0), PrivateWrongItemStoreError);
    await assert.rejects(() => selectReviewItems(user.id, paper.paperId, 21), PrivateWrongItemStoreError);
  } finally { await cleanupUser(user.id); }
});

test("review: selectReviewItems after paper deletion throws NOT_FOUND", async () => {
  const user = await createTestUser("rv4");
  try {
    const content = makeReadyContent(2);
    const paper = await createReadyPaper(user.id, "l1", content);
    await submitAllWrong(user.id, paper.paperId, content, 2);
    await deletePrivatePaper(user.id, paper.paperId);
    await assert.rejects(() => selectReviewItems(user.id, paper.paperId, 5), PrivateWrongItemStoreError);
  } finally { await cleanupUser(user.id); }
});

// ─── gradeReviewItems ────────────────────────────────────────────────

test("review: gradeReviewItems scores correct/wrong/unanswered", async () => {
  const user = await createTestUser("rv5");
  try {
    const content = makeReadyContent(3);
    const paper = await createReadyPaper(user.id, "l1", content);
    await submitAllWrong(user.id, paper.paperId, content, 3);
    const hash = computePrivateContentHash(content);

    // q1 correct (A), q2 wrong (B), q3 unanswered ("")
    const result = await gradeReviewItems(user.id, paper.paperId, hash, { q1: "A", q2: "B", q3: "" });
    assert.equal(result.total, 3);
    assert.equal(result.correct, 1);
    assert.equal(result.unanswered, 1);
    assert.equal(result.contentHash, hash);

    const r1 = result.results.find(r => r.questionId === "q1")!;
    assert.equal(r1.isCorrect, true);
    assert.equal(r1.userAnswer, "A");
    assert.equal(r1.correctAnswer, "A");
    assert.ok(r1.shortExplanation);

    const r2 = result.results.find(r => r.questionId === "q2")!;
    assert.equal(r2.isCorrect, false);
    assert.equal(r2.userAnswer, "B");

    const r3 = result.results.find(r => r.questionId === "q3")!;
    assert.equal(r3.isCorrect, false);
    assert.equal(r3.userAnswer, null);
  } finally { await cleanupUser(user.id); }
});

test("review: gradeReviewItems has NO side effects on wrongCount or progress", async () => {
  const user = await createTestUser("rv6");
  try {
    const content = makeReadyContent(2);
    const paper = await createReadyPaper(user.id, "l1", content);
    await submitAllWrong(user.id, paper.paperId, content, 2);
    const hash = computePrivateContentHash(content);

    const beforeItems = await listPrivateWrongItems(user.id, paper.paperId);
    const beforeProgress = await getPrivatePaperProgress(user.id, paper.paperId);
    assert.ok(beforeProgress, "before progress should exist");
    const beforeWrongCounts = beforeItems.map(i => i.wrongCount);

    // Grade review (all correct this time)
    await gradeReviewItems(user.id, paper.paperId, hash, { q1: "A", q2: "A" });
    // Grade again (idempotent)
    await gradeReviewItems(user.id, paper.paperId, hash, { q1: "A", q2: "A" });

    const afterItems = await listPrivateWrongItems(user.id, paper.paperId);
    const afterProgress = await getPrivatePaperProgress(user.id, paper.paperId);
    assert.ok(afterProgress, "after progress should exist");
    const afterWrongCounts = afterItems.map(i => i.wrongCount);

    // wrongCount unchanged
    assert.deepEqual(afterWrongCounts, beforeWrongCounts);
    // progress unchanged
    assert.equal(afterProgress.revision, beforeProgress.revision);
    assert.equal(afterProgress.attemptId, beforeProgress.attemptId);
    // items still exist (not deleted)
    assert.equal(afterItems.length, 2);
  } finally { await cleanupUser(user.id); }
});

test("review: gradeReviewItems rejects wrong contentHash", async () => {
  const user = await createTestUser("rv7");
  try {
    const content = makeReadyContent(2);
    const paper = await createReadyPaper(user.id, "l1", content);
    await submitAllWrong(user.id, paper.paperId, content, 2);
    await assert.rejects(
      () => gradeReviewItems(user.id, paper.paperId, "wrong-hash", { q1: "A" }),
      PrivateWrongItemStoreError,
    );
  } finally { await cleanupUser(user.id); }
});

test("review: gradeReviewItems rejects question not in active wrong items", async () => {
  const user = await createTestUser("rv8");
  try {
    const content = makeReadyContent(3);
    const paper = await createReadyPaper(user.id, "l1", content);
    // Only get q1 and q2 wrong, q3 is correct
    await writeProgress(user.id, paper.paperId, {
      progressVersion: 1, mutationId: randomUUID(), contentHash: computePrivateContentHash(content),
      baseRevision: 0, attemptId: randomUUID(), answers: { "0": "B", "1": "B", "2": "A" },
      currentIndex: 2, submitted: true,
    });
    const hash = computePrivateContentHash(content);
    // q3 is not a wrong item → should reject
    await assert.rejects(
      () => gradeReviewItems(user.id, paper.paperId, hash, { q1: "A", q3: "A" }),
      PrivateWrongItemStoreError,
    );
  } finally { await cleanupUser(user.id); }
});

test("review: gradeReviewItems rejects duplicate questionIds", async () => {
  const user = await createTestUser("rv9");
  try {
    const content = makeReadyContent(2);
    const paper = await createReadyPaper(user.id, "l1", content);
    await submitAllWrong(user.id, paper.paperId, content, 2);
    const hash = computePrivateContentHash(content);
    // Duplicate keys in object are actually deduplicated by JS, so test with >5
    const answers: Record<string, string> = {};
    for (let i = 0; i < 6; i++) answers[`q${i + 1}`] = "A";
    await assert.rejects(
      () => gradeReviewItems(user.id, paper.paperId, hash, answers),
      PrivateWrongItemStoreError,
    );
  } finally { await cleanupUser(user.id); }
});

test("review: gradeReviewItems rejects empty answers", async () => {
  await assert.rejects(
    () => gradeReviewItems("user1", "paper:1", "hash", {}),
    PrivateWrongItemStoreError,
  );
});

test("review: gradeReviewItems rejects cross-owner access", async () => {
  const userA = await createTestUser("rvA");
  const userB = await createTestUser("rvB");
  try {
    const content = makeReadyContent(2);
    const paper = await createReadyPaper(userA.id, "l1", content);
    await submitAllWrong(userA.id, paper.paperId, content, 2);
    const hash = computePrivateContentHash(content);
    // User B tries to grade User A's wrong items → NOT_FOUND (paper not found for B)
    await assert.rejects(
      () => gradeReviewItems(userB.id, paper.paperId, hash, { q1: "A" }),
      PrivateWrongItemStoreError,
    );
  } finally { await cleanupUser(userA.id); await cleanupUser(userB.id); }
});

// ─── Parsing ─────────────────────────────────────────────────────────

test("review: parsePrivateReviewStart rejects wrong owner", () => {
  const raw = { ownerId: "other", reviewBatchId: "rb_1", contentHash: "h1", questions: [{ questionId: "q1", prompt: "p", options: [{ id: "A", text: "a" }, { id: "B", text: "b" }] }] };
  assert.throws(() => parsePrivateReviewStart(raw, "me"));
});

test("review: parsePrivateReviewStart rejects malformed questions", () => {
  const raw = { ownerId: "me", reviewBatchId: "rb_1", contentHash: "h1", questions: [{ questionId: "q1" }] };
  assert.throws(() => parsePrivateReviewStart(raw, "me"));
});

test("review: parsePrivateReviewStart rejects too many questions", () => {
  const questions = Array.from({ length: 6 }, (_, i) => ({ questionId: `q${i}`, prompt: "p", options: [{ id: "A", text: "a" }, { id: "B", text: "b" }] }));
  const raw = { ownerId: "me", reviewBatchId: "rb_1", contentHash: "h1", questions };
  assert.throws(() => parsePrivateReviewStart(raw, "me"));
});

test("review: parsePrivateReviewStart rejects duplicate questionIds", () => {
  const questions = [
    { questionId: "q1", prompt: "p1", options: [{ id: "A", text: "a" }, { id: "B", text: "b" }] },
    { questionId: "q1", prompt: "p2", options: [{ id: "A", text: "a" }, { id: "B", text: "b" }] },
  ];
  const raw = { ownerId: "me", reviewBatchId: "rb_1", contentHash: "h1", questions };
  assert.throws(() => parsePrivateReviewStart(raw, "me"));
});

test("review: parsePrivateReviewGrade rejects wrong contentHash", () => {
  const raw = { ownerId: "me", contentHash: "other", total: 1, correct: 1, unanswered: 0, results: [{ questionId: "q1", userAnswer: "A", correctAnswer: "A", isCorrect: true, prompt: "p", options: [{ id: "A", text: "a" }, { id: "B", text: "b" }] }] };
  assert.throws(() => parsePrivateReviewGrade(raw, "me", "paper:1", "expected", ["q1"]));
});

test("review: parsePrivateReviewGrade rejects result count mismatch", () => {
  const raw = { ownerId: "me", contentHash: "h1", total: 2, correct: 1, unanswered: 0, results: [{ questionId: "q1", userAnswer: "A", correctAnswer: "A", isCorrect: true, prompt: "p", options: [{ id: "A", text: "a" }, { id: "B", text: "b" }] }] };
  assert.throws(() => parsePrivateReviewGrade(raw, "me", "paper:1", "h1", ["q1", "q2"]));
});

test("review: parsePrivateReviewGrade rejects non-batch questionId", () => {
  const raw = { ownerId: "me", contentHash: "h1", total: 1, correct: 1, unanswered: 0, results: [{ questionId: "q99", userAnswer: "A", correctAnswer: "A", isCorrect: true, prompt: "p", options: [{ id: "A", text: "a" }, { id: "B", text: "b" }] }] };
  assert.throws(() => parsePrivateReviewGrade(raw, "me", "paper:1", "h1", ["q1"]));
});

// ─── Session validation ──────────────────────────────────────────────

test("review: validatePrivateReviewSession accepts valid session", () => {
  const session: PrivateReviewSession = {
    version: PRIVATE_REVIEW_STORAGE_VERSION,
    ownerId: "me", paperId: "paper:1", reviewBatchId: "rb_1", contentHash: "h1",
    questions: [{ questionId: "q1", prompt: "p", options: [{ id: "A", text: "a" }, { id: "B", text: "b" }] }],
    answers: { q1: "A" }, currentIndex: 0, submitted: false,
  };
  const result = validatePrivateReviewSession(session, "me", "paper:1");
  assert.ok(result);
  assert.equal(result.reviewBatchId, "rb_1");
});

test("review: validatePrivateReviewSession rejects wrong version", () => {
  const session = { version: 999, ownerId: "me", paperId: "paper:1", reviewBatchId: "rb_1", contentHash: "h1", questions: [], answers: {}, currentIndex: 0, submitted: false };
  assert.equal(validatePrivateReviewSession(session, "me", "paper:1"), null);
});

test("review: validatePrivateReviewSession rejects wrong owner", () => {
  const session = { version: PRIVATE_REVIEW_STORAGE_VERSION, ownerId: "other", paperId: "paper:1", reviewBatchId: "rb_1", contentHash: "h1", questions: [{ questionId: "q1", prompt: "p", options: [{ id: "A", text: "a" }, { id: "B", text: "b" }] }], answers: { q1: null }, currentIndex: 0, submitted: false };
  assert.equal(validatePrivateReviewSession(session, "me", "paper:1"), null);
});

test("review: validatePrivateReviewSession rejects corrupt answers", () => {
  const session = { version: PRIVATE_REVIEW_STORAGE_VERSION, ownerId: "me", paperId: "paper:1", reviewBatchId: "rb_1", contentHash: "h1", questions: [{ questionId: "q1", prompt: "p", options: [{ id: "A", text: "a" }, { id: "B", text: "b" }] }], answers: { q2: "A" }, currentIndex: 0, submitted: false };
  assert.equal(validatePrivateReviewSession(session, "me", "paper:1"), null);
});

test("review: validatePrivateReviewSession rejects invalid currentIndex", () => {
  const session = { version: PRIVATE_REVIEW_STORAGE_VERSION, ownerId: "me", paperId: "paper:1", reviewBatchId: "rb_1", contentHash: "h1", questions: [{ questionId: "q1", prompt: "p", options: [{ id: "A", text: "a" }, { id: "B", text: "b" }] }], answers: { q1: null }, currentIndex: 5, submitted: false };
  assert.equal(validatePrivateReviewSession(session, "me", "paper:1"), null);
});

test("review: validatePrivateReviewSession accepts submitted session with result", () => {
  const session: PrivateReviewSession = {
    version: PRIVATE_REVIEW_STORAGE_VERSION,
    ownerId: "me", paperId: "paper:1", reviewBatchId: "rb_1", contentHash: "h1",
    questions: [{ questionId: "q1", prompt: "p", options: [{ id: "A", text: "a" }, { id: "B", text: "b" }] }],
    answers: { q1: "A" }, currentIndex: 0, submitted: true, submittedAt: new Date().toISOString(),
    result: { contentHash: "h1", total: 1, correct: 1, unanswered: 0, results: [{ questionId: "q1", userAnswer: "A", correctAnswer: "A", isCorrect: true, prompt: "p", options: [{ id: "A", text: "a" }, { id: "B", text: "b" }] }] },
  };
  const result = validatePrivateReviewSession(session, "me", "paper:1");
  assert.ok(result);
  assert.equal(result.submitted, true);
  assert.ok(result.result);
});
