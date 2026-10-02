/**
 * V14 Phase 1E.2: Private Wrongbook Review Progress Cloud Sync tests.
 * Real Prisma with isolated random users. No DB mocking.
 * Covers: startPrivateReviewBatch, readPrivateReviewProgressSnapshot,
 * savePrivateReviewProgress, submitPrivateReviewProgress, CAS revision,
 * batch mismatch, content changed, cross-owner isolation, validation.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "../src/lib/db/prisma";
import { computePrivateContentHash } from "../src/lib/private-papers/readiness";
import { createPrivatePaper, updatePrivatePaper } from "../src/content/private-paper-store";
import { putPrivatePaperProgress as writeProgress } from "../src/content/private-paper-progress-store";
import {
  startPrivateReviewBatch,
  readPrivateReviewProgressSnapshot,
  savePrivateReviewProgress,
  submitPrivateReviewProgress,
  PrivateReviewProgressStoreError,
} from "../src/content/private-review-progress-store";

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
  for (let i = 0; i < count; i++) answers[String(i)] = "B";
  return writeProgress(userId, paperId, {
    progressVersion: 1, mutationId: randomUUID(), contentHash: computePrivateContentHash(content),
    baseRevision: 0, attemptId: randomUUID(), answers, currentIndex: count - 1, submitted: true,
  });
}

async function cleanupUser(userId: string) {
  await prisma.privateReviewProgress.deleteMany({ where: { userId } });
  await prisma.privateWrongItem.deleteMany({ where: { userId } });
  await prisma.privatePaperProgress.deleteMany({ where: { userId } });
  await prisma.privatePaper.deleteMany({ where: { userId } });
  await prisma.user.delete({ where: { id: userId } }).catch(() => {});
}

// ─── startPrivateReviewBatch ─────────────────────────────────────────

test("review-progress: startPrivateReviewBatch creates and persists batch", async () => {
  const user = await createTestUser("rp1");
  try {
    const content = makeReadyContent(4);
    const paper = await createReadyPaper(user.id, "l1", content);
    await submitAllWrong(user.id, paper.paperId, content, 4);

    const batch = await startPrivateReviewBatch(user.id, paper.paperId, 5);
    assert.equal(batch.questions.length, 4);
    assert.ok(batch.reviewBatchId.startsWith("rb_"));
    assert.equal(batch.contentHash, computePrivateContentHash(content));
    assert.equal(batch.submitted, false);
    assert.equal(batch.revision, 1);
    assert.equal(batch.currentIndex, 0);
    for (const q of batch.questions) {
      assert.equal(batch.answers[q.questionId], null);
    }

    // Verify persisted in DB
    const row = await prisma.privateReviewProgress.findUnique({ where: { userId_paperId: { userId: user.id, paperId: paper.paperId } } });
    assert.ok(row);
    assert.equal(row!.reviewBatchId, batch.reviewBatchId);
    assert.equal(row!.revision, 1);
    assert.equal(row!.submitted, false);
  } finally { await cleanupUser(user.id); }
});

test("review-progress: startPrivateReviewBatch replaces existing batch and increments revision", async () => {
  const user = await createTestUser("rp2");
  try {
    const content = makeReadyContent(3);
    const paper = await createReadyPaper(user.id, "l1", content);
    await submitAllWrong(user.id, paper.paperId, content, 3);

    const first = await startPrivateReviewBatch(user.id, paper.paperId, 5);
    assert.equal(first.revision, 1);

    const second = await startPrivateReviewBatch(user.id, paper.paperId, 5);
    assert.equal(second.revision, 2);
    assert.notEqual(second.reviewBatchId, first.reviewBatchId);

    const row = await prisma.privateReviewProgress.findUnique({ where: { userId_paperId: { userId: user.id, paperId: paper.paperId } } });
    assert.ok(row);
    assert.equal(row!.revision, 2);
  } finally { await cleanupUser(user.id); }
});

// ─── readPrivateReviewProgressSnapshot ────────────────────────────────

test("review-progress: readPrivateReviewProgressSnapshot returns persisted progress", async () => {
  const user = await createTestUser("rp3");
  try {
    const content = makeReadyContent(3);
    const paper = await createReadyPaper(user.id, "l1", content);
    await submitAllWrong(user.id, paper.paperId, content, 3);
    await startPrivateReviewBatch(user.id, paper.paperId, 5);

    const snapshot = await readPrivateReviewProgressSnapshot(user.id, paper.paperId);
    assert.ok(snapshot.progress);
    assert.equal(snapshot.progress.questions.length, 3);
    assert.equal(snapshot.revision, 1);
    assert.equal(snapshot.invalidated, false);
  } finally { await cleanupUser(user.id); }
});

test("review-progress: readPrivateReviewProgressSnapshot returns null when no batch", async () => {
  const user = await createTestUser("rp4");
  try {
    const content = makeReadyContent(3);
    const paper = await createReadyPaper(user.id, "l1", content);

    const snapshot = await readPrivateReviewProgressSnapshot(user.id, paper.paperId);
    assert.equal(snapshot.progress, null);
    assert.equal(snapshot.revision, 0);
    assert.equal(snapshot.invalidated, false);
  } finally { await cleanupUser(user.id); }
});

test("review-progress: readPrivateReviewProgressSnapshot invalidated when content changes", async () => {
  const user = await createTestUser("rp5");
  try {
    const content = makeReadyContent(3);
    const paper = await createReadyPaper(user.id, "l1", content);
    await submitAllWrong(user.id, paper.paperId, content, 3);
    await startPrivateReviewBatch(user.id, paper.paperId, 5);

    // Update content (change a question prompt to change content hash)
    const newContent: Record<string, unknown> = {
      schemaVersion: 1, isPartial: false,
      sections: [{
        sectionId: "reading-1", type: "reading", order: 0,
        groups: [{ groupId: "careful-1", type: "careful_reading", order: 0, passage: "Test passage.", questions: [
          { questionId: "q1", order: 0, prompt: "CHANGED Question 1?", type: "choice", options: [{ id: "A", text: "Opt A" }, { id: "B", text: "Opt B" }, { id: "C", text: "Opt C" }, { id: "D", text: "Opt D" }], answerId: "A", shortExplanation: "Explanation 1" },
          { questionId: "q2", order: 1, prompt: "Question 2?", type: "choice", options: [{ id: "A", text: "Opt A" }, { id: "B", text: "Opt B" }, { id: "C", text: "Opt C" }, { id: "D", text: "Opt D" }], answerId: "A", shortExplanation: "Explanation 2" },
          { questionId: "q3", order: 2, prompt: "Question 3?", type: "choice", options: [{ id: "A", text: "Opt A" }, { id: "B", text: "Opt B" }, { id: "C", text: "Opt C" }, { id: "D", text: "Opt D" }], answerId: "A", shortExplanation: "Explanation 3" },
        ] }],
      }],
    };
    await updatePrivatePaper(user.id, paper.paperId, { content: newContent, rightsAcknowledgement: makeRightsAck() });

    const snapshot = await readPrivateReviewProgressSnapshot(user.id, paper.paperId);
    assert.equal(snapshot.progress, null);
    assert.equal(snapshot.invalidated, true);
    assert.equal(snapshot.invalidReason, "content version changed");
  } finally { await cleanupUser(user.id); }
});

// ─── savePrivateReviewProgress ────────────────────────────────────────

test("review-progress: savePrivateReviewProgress saves answers and currentIndex", async () => {
  const user = await createTestUser("rp6");
  try {
    const content = makeReadyContent(3);
    const paper = await createReadyPaper(user.id, "l1", content);
    await submitAllWrong(user.id, paper.paperId, content, 3);
    const batch = await startPrivateReviewBatch(user.id, paper.paperId, 5);

    const qid = batch.questions[0].questionId;
    const result = await savePrivateReviewProgress(user.id, paper.paperId, {
      reviewBatchId: batch.reviewBatchId,
      contentHash: batch.contentHash,
      answers: { [qid]: "A" },
      currentIndex: 1,
      baseRevision: batch.revision,
    });
    assert.equal(result.revision, 2);

    const snapshot = await readPrivateReviewProgressSnapshot(user.id, paper.paperId);
    assert.ok(snapshot.progress);
    assert.equal(snapshot.progress!.answers[qid], "A");
    assert.equal(snapshot.progress!.currentIndex, 1);
    assert.equal(snapshot.progress!.submitted, false);
  } finally { await cleanupUser(user.id); }
});

test("review-progress: savePrivateReviewProgress rejects stale revision (CAS conflict)", async () => {
  const user = await createTestUser("rp7");
  try {
    const content = makeReadyContent(3);
    const paper = await createReadyPaper(user.id, "l1", content);
    await submitAllWrong(user.id, paper.paperId, content, 3);
    const batch = await startPrivateReviewBatch(user.id, paper.paperId, 5);

    // First save succeeds (revision 1 -> 2)
    await savePrivateReviewProgress(user.id, paper.paperId, {
      reviewBatchId: batch.reviewBatchId, contentHash: batch.contentHash,
      answers: {}, currentIndex: 0, baseRevision: 1,
    });

    // Second save with stale baseRevision=1 should fail
    await assert.rejects(
      () => savePrivateReviewProgress(user.id, paper.paperId, {
        reviewBatchId: batch.reviewBatchId, contentHash: batch.contentHash,
        answers: {}, currentIndex: 1, baseRevision: 1,
      }),
      (err: PrivateReviewProgressStoreError) => err.code === "CONFLICT",
    );
  } finally { await cleanupUser(user.id); }
});

test("review-progress: savePrivateReviewProgress rejects batch mismatch", async () => {
  const user = await createTestUser("rp8");
  try {
    const content = makeReadyContent(3);
    const paper = await createReadyPaper(user.id, "l1", content);
    await submitAllWrong(user.id, paper.paperId, content, 3);
    const batch = await startPrivateReviewBatch(user.id, paper.paperId, 5);

    await assert.rejects(
      () => savePrivateReviewProgress(user.id, paper.paperId, {
        reviewBatchId: "rb_wrong_batch", contentHash: batch.contentHash,
        answers: {}, currentIndex: 0, baseRevision: 1,
      }),
      (err: PrivateReviewProgressStoreError) => err.code === "BATCH_MISMATCH",
    );
  } finally { await cleanupUser(user.id); }
});

test("review-progress: savePrivateReviewProgress rejects when already submitted", async () => {
  const user = await createTestUser("rp9");
  try {
    const content = makeReadyContent(3);
    const paper = await createReadyPaper(user.id, "l1", content);
    await submitAllWrong(user.id, paper.paperId, content, 3);
    const batch = await startPrivateReviewBatch(user.id, paper.paperId, 5);

    // Submit first
    await submitPrivateReviewProgress(user.id, paper.paperId, {
      reviewBatchId: batch.reviewBatchId, contentHash: batch.contentHash,
      answers: {}, baseRevision: 1,
    });

    // Then try to save - should reject
    await assert.rejects(
      () => savePrivateReviewProgress(user.id, paper.paperId, {
        reviewBatchId: batch.reviewBatchId, contentHash: batch.contentHash,
        answers: {}, currentIndex: 0, baseRevision: 2,
      }),
      (err: PrivateReviewProgressStoreError) => err.code === "CONFLICT",
    );
  } finally { await cleanupUser(user.id); }
});

// ─── submitPrivateReviewProgress ──────────────────────────────────────

test("review-progress: submitPrivateReviewProgress grades and persists result", async () => {
  const user = await createTestUser("rp10");
  try {
    const content = makeReadyContent(3);
    const paper = await createReadyPaper(user.id, "l1", content);
    await submitAllWrong(user.id, paper.paperId, content, 3);
    const batch = await startPrivateReviewBatch(user.id, paper.paperId, 5);

    // Answer first question correctly (correct is A)
    const qid = batch.questions[0].questionId;
    const submitted = await submitPrivateReviewProgress(user.id, paper.paperId, {
      reviewBatchId: batch.reviewBatchId, contentHash: batch.contentHash,
      answers: { [qid]: "A" }, baseRevision: 1,
    });

    assert.equal(submitted.submitted, true);
    assert.equal(submitted.revision, 2);
    assert.ok(submitted.result);
    assert.equal(submitted.result.total, 3);
    assert.equal(submitted.result.correct, 1);
    assert.equal(submitted.result.unanswered, 2);

    const row = await prisma.privateReviewProgress.findUnique({ where: { userId_paperId: { userId: user.id, paperId: paper.paperId } } });
    assert.ok(row);
    assert.equal(row!.submitted, true);
    assert.ok(row!.result);
  } finally { await cleanupUser(user.id); }
});

test("review-progress: submitPrivateReviewProgress rejects stale revision", async () => {
  const user = await createTestUser("rp11");
  try {
    const content = makeReadyContent(3);
    const paper = await createReadyPaper(user.id, "l1", content);
    await submitAllWrong(user.id, paper.paperId, content, 3);
    const batch = await startPrivateReviewBatch(user.id, paper.paperId, 5);

    // Save first (revision 1 -> 2)
    await savePrivateReviewProgress(user.id, paper.paperId, {
      reviewBatchId: batch.reviewBatchId, contentHash: batch.contentHash,
      answers: {}, currentIndex: 0, baseRevision: 1,
    });

    // Submit with stale baseRevision=1 should fail
    await assert.rejects(
      () => submitPrivateReviewProgress(user.id, paper.paperId, {
        reviewBatchId: batch.reviewBatchId, contentHash: batch.contentHash,
        answers: {}, baseRevision: 1,
      }),
      (err: PrivateReviewProgressStoreError) => err.code === "CONFLICT",
    );
  } finally { await cleanupUser(user.id); }
});

// ─── Cross-owner isolation ────────────────────────────────────────────

test("review-progress: cross-owner isolation - user B cannot read user A progress", async () => {
  const userA = await createTestUser("rpA");
  const userB = await createTestUser("rpB");
  try {
    const content = makeReadyContent(3);
    const paperA = await createReadyPaper(userA.id, "l1", content);
    await submitAllWrong(userA.id, paperA.paperId, content, 3);
    await startPrivateReviewBatch(userA.id, paperA.paperId, 5);

    // User B tries to read user A's paper - should get NOT_FOUND
    await assert.rejects(
      () => readPrivateReviewProgressSnapshot(userB.id, paperA.paperId),
      (err: PrivateReviewProgressStoreError) => err.code === "NOT_FOUND",
    );
  } finally {
    await cleanupUser(userA.id);
    await cleanupUser(userB.id);
  }
});

// ─── Validation ────────────────────────────────────────────────────────

test("review-progress: startPrivateReviewBatch rejects invalid limit", async () => {
  const user = await createTestUser("rp12");
  try {
    const content = makeReadyContent(3);
    const paper = await createReadyPaper(user.id, "l1", content);
    await submitAllWrong(user.id, paper.paperId, content, 3);

    await assert.rejects(
      () => startPrivateReviewBatch(user.id, paper.paperId, 0),
      (err: PrivateReviewProgressStoreError) => err.code === "VALIDATION_ERROR",
    );
    await assert.rejects(
      () => startPrivateReviewBatch(user.id, paper.paperId, 6),
      (err: PrivateReviewProgressStoreError) => err.code === "VALIDATION_ERROR",
    );
  } finally { await cleanupUser(user.id); }
});

test("review-progress: savePrivateReviewProgress validates required fields", async () => {
  const user = await createTestUser("rp13");
  try {
    const content = makeReadyContent(3);
    const paper = await createReadyPaper(user.id, "l1", content);
    await submitAllWrong(user.id, paper.paperId, content, 3);
    const batch = await startPrivateReviewBatch(user.id, paper.paperId, 5);

    await assert.rejects(
      () => savePrivateReviewProgress(user.id, paper.paperId, {}),
      (err: PrivateReviewProgressStoreError) => err.code === "VALIDATION_ERROR",
    );
    await assert.rejects(
      () => savePrivateReviewProgress(user.id, paper.paperId, { reviewBatchId: batch.reviewBatchId, contentHash: batch.contentHash, baseRevision: -1 }),
      (err: PrivateReviewProgressStoreError) => err.code === "VALIDATION_ERROR",
    );
  } finally { await cleanupUser(user.id); }
});

// ─── No side effects on wrong items / progress / XP ───────────────────

test("review-progress: review operations do not modify wrong items or paper progress", async () => {
  const user = await createTestUser("rp14");
  try {
    const content = makeReadyContent(3);
    const paper = await createReadyPaper(user.id, "l1", content);
    await submitAllWrong(user.id, paper.paperId, content, 3);

    const wrongBefore = await prisma.privateWrongItem.count({ where: { userId: user.id, paperId: paper.paperId } });
    const progressBefore = await prisma.privatePaperProgress.findUnique({ where: { userId_paperId: { userId: user.id, paperId: paper.paperId } } });

    const batch = await startPrivateReviewBatch(user.id, paper.paperId, 5);
    await savePrivateReviewProgress(user.id, paper.paperId, {
      reviewBatchId: batch.reviewBatchId, contentHash: batch.contentHash,
      answers: { [batch.questions[0].questionId]: "A" }, currentIndex: 1, baseRevision: 1,
    });
    await submitPrivateReviewProgress(user.id, paper.paperId, {
      reviewBatchId: batch.reviewBatchId, contentHash: batch.contentHash,
      answers: { [batch.questions[0].questionId]: "A" }, baseRevision: 2,
    });

    const wrongAfter = await prisma.privateWrongItem.count({ where: { userId: user.id, paperId: paper.paperId } });
    const progressAfter = await prisma.privatePaperProgress.findUnique({ where: { userId_paperId: { userId: user.id, paperId: paper.paperId } } });

    assert.equal(wrongAfter, wrongBefore);
    assert.ok(progressBefore);
    assert.ok(progressAfter);
    assert.equal(progressAfter!.submitted, progressBefore!.submitted);
    assert.deepEqual(progressAfter!.answers, progressBefore!.answers);
  } finally { await cleanupUser(user.id); }
});
