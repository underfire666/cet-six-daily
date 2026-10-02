/**
 * V14 Phase 1D.4: PrivateWrongItem manual remove/restore tests.
 * Real Prisma with isolated random users. No DB mocking.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "../src/lib/db/prisma";
import { computePrivateContentHash, type PrivateFlatQuestion } from "../src/lib/private-papers/readiness";
import { createPrivatePaper } from "../src/content/private-paper-store";
import {
  recordWrongItems,
  listPrivateWrongItems,
  removeWrongItem,
  restoreWrongItem,
  countWrongItems,
  selectReviewItems,
  gradeReviewItems,
  PrivateWrongItemStoreError,
} from "../src/content/private-wrong-item-store";

async function createTestUser(prefix: string) {
  const id = randomUUID();
  return prisma.user.create({ data: { email: `${prefix}-${id}@example.invalid`, passwordHash: "test-only" } });
}

function makeRightsAck() {
  return { acknowledged: true, acknowledgedAt: new Date().toISOString(), statementVersion: "1.0" };
}

function makeReadyContent(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: 1, isPartial: false,
    sections: [{
      sectionId: "reading-1", type: "reading", order: 0,
      groups: [{
        groupId: "careful-1", type: "careful_reading", order: 0,
        passage: "Test passage about AI and ML.",
        questions: [
          { questionId: "q1", order: 0, prompt: "Main topic?", type: "choice",
            options: [{id:"A",text:"AI"},{id:"B",text:"Bio"},{id:"C",text:"Chem"},{id:"D",text:"Phys"}], answerId: "A", shortExplanation: "AI" },
          { questionId: "q2", order: 1, prompt: "Options count?", type: "choice",
            options: [{id:"A",text:"2"},{id:"B",text:"3"},{id:"C",text:"4"},{id:"D",text:"5"}], answerId: "C", shortExplanation: "4" },
          { questionId: "q3", order: 2, prompt: "ML field?", type: "choice",
            options: [{id:"A",text:"Phys"},{id:"B",text:"AI"},{id:"C",text:"Chem"},{id:"D",text:"Bio"}], answerId: "B", shortExplanation: "AI" },
        ],
      }],
    }],
    ...overrides,
  };
}

async function createReadyPaper(userId: string, localId: string, content: Record<string, unknown>) {
  return createPrivatePaper(userId, { localPaperId: localId, title: "Test", content, rightsAcknowledgement: makeRightsAck() });
}

async function cleanupUser(userId: string) {
  await prisma.privateWrongItem.deleteMany({ where: { userId } });
  await prisma.privatePaperProgress.deleteMany({ where: { userId } });
  await prisma.privatePaper.deleteMany({ where: { userId } });
  await prisma.user.delete({ where: { id: userId } }).catch(() => {});
}

function makeQuestions(): PrivateFlatQuestion[] {
  return [
    { questionId: "q1", index: 0, answerId: "A", sectionId: "s1", sectionOrder: 0, groupId: "g1", groupOrder: 0, questionOrder: 0, prompt: "Main topic?", options: [{id:"A",text:"AI"},{id:"B",text:"Bio"}] },
    { questionId: "q2", index: 1, answerId: "C", sectionId: "s1", sectionOrder: 0, groupId: "g1", groupOrder: 0, questionOrder: 1, prompt: "Options count?", options: [{id:"C",text:"4"},{id:"D",text:"5"}] },
    { questionId: "q3", index: 2, answerId: "B", sectionId: "s1", sectionOrder: 0, groupId: "g1", groupOrder: 0, questionOrder: 2, prompt: "ML field?", options: [{id:"A",text:"Phys"},{id:"B",text:"AI"}] },
  ];
}

test("remove wrong item sets removedAt and increments revision", async () => {
  const user = await createTestUser("rm1");
  try {
    const content = makeReadyContent();
    const paper = await createReadyPaper(user.id, "l1", content);
    await prisma.$transaction(async tx => {
      await recordWrongItems(tx, user.id, paper.paperId, computePrivateContentHash(content), "att1", makeQuestions(), { "0": "B", "1": "D", "2": "A" });
    });
    const items = await listPrivateWrongItems(user.id, paper.paperId);
    assert.equal(items.length, 3);
    const item = items[0];
    assert.equal(item.removedAt, null);
    assert.equal(item.revision, 0);
    const removed = await removeWrongItem(user.id, paper.paperId, item.contentHash, item.questionId, item.revision);
    assert.ok(removed.removedAt !== null);
    assert.equal(removed.revision, 1);
    const after = await listPrivateWrongItems(user.id, paper.paperId);
    const found = after.find(i => i.questionId === item.questionId)!;
    assert.ok(found.removedAt !== null);
    assert.equal(found.revision, 1);
  } finally { await cleanupUser(user.id); }
});

test("remove already-removed item is idempotent", async () => {
  const user = await createTestUser("rm2");
  try {
    const content = makeReadyContent();
    const paper = await createReadyPaper(user.id, "l1", content);
    await prisma.$transaction(async tx => {
      await recordWrongItems(tx, user.id, paper.paperId, computePrivateContentHash(content), "att1", makeQuestions(), { "0": "B" });
    });
    const items = await listPrivateWrongItems(user.id, paper.paperId);
    const item = items[0];
    const first = await removeWrongItem(user.id, paper.paperId, item.contentHash, item.questionId, item.revision);
    assert.equal(first.revision, 1);
    const second = await removeWrongItem(user.id, paper.paperId, item.contentHash, item.questionId, first.revision);
    assert.equal(second.revision, 1, "idempotent remove should not increment revision");
    assert.ok(second.removedAt !== null);
  } finally { await cleanupUser(user.id); }
});

test("remove with wrong revision throws CONFLICT", async () => {
  const user = await createTestUser("rm3");
  try {
    const content = makeReadyContent();
    const paper = await createReadyPaper(user.id, "l1", content);
    await prisma.$transaction(async tx => {
      await recordWrongItems(tx, user.id, paper.paperId, computePrivateContentHash(content), "att1", makeQuestions(), { "0": "B" });
    });
    const items = await listPrivateWrongItems(user.id, paper.paperId);
    const item = items[0];
    await assert.rejects(
      () => removeWrongItem(user.id, paper.paperId, item.contentHash, item.questionId, item.revision + 1),
      (e: unknown) => e instanceof PrivateWrongItemStoreError && e.code === "CONFLICT",
    );
  } finally { await cleanupUser(user.id); }
});

test("remove non-existent item throws NOT_FOUND", async () => {
  const user = await createTestUser("rm4");
  try {
    const content = makeReadyContent();
    const paper = await createReadyPaper(user.id, "l1", content);
    await assert.rejects(
      () => removeWrongItem(user.id, paper.paperId, computePrivateContentHash(content), "nonexistent", 0),
      (e: unknown) => e instanceof PrivateWrongItemStoreError && e.code === "NOT_FOUND",
    );
  } finally { await cleanupUser(user.id); }
});

test("remove cross-owner throws NOT_FOUND", async () => {
  const userA = await createTestUser("rm5a");
  const userB = await createTestUser("rm5b");
  try {
    const content = makeReadyContent();
    const paper = await createReadyPaper(userA.id, "l1", content);
    await prisma.$transaction(async tx => {
      await recordWrongItems(tx, userA.id, paper.paperId, computePrivateContentHash(content), "att1", makeQuestions(), { "0": "B" });
    });
    const items = await listPrivateWrongItems(userA.id, paper.paperId);
    const item = items[0];
    await assert.rejects(
      () => removeWrongItem(userB.id, paper.paperId, item.contentHash, item.questionId, 0),
      (e: unknown) => e instanceof PrivateWrongItemStoreError && e.code === "NOT_FOUND",
    );
  } finally { await cleanupUser(userA.id); await cleanupUser(userB.id); }
});

test("restore removed item clears removedAt and increments revision", async () => {
  const user = await createTestUser("rs1");
  try {
    const content = makeReadyContent();
    const paper = await createReadyPaper(user.id, "l1", content);
    await prisma.$transaction(async tx => {
      await recordWrongItems(tx, user.id, paper.paperId, computePrivateContentHash(content), "att1", makeQuestions(), { "0": "B" });
    });
    const items = await listPrivateWrongItems(user.id, paper.paperId);
    const item = items[0];
    const removed = await removeWrongItem(user.id, paper.paperId, item.contentHash, item.questionId, item.revision);
    assert.ok(removed.removedAt !== null);
    const restored = await restoreWrongItem(user.id, paper.paperId, item.contentHash, item.questionId, removed.revision);
    assert.equal(restored.removedAt, null);
    assert.equal(restored.revision, 2);
    const after = await listPrivateWrongItems(user.id, paper.paperId);
    const found = after.find(i => i.questionId === item.questionId)!;
    assert.equal(found.removedAt, null);
  } finally { await cleanupUser(user.id); }
});

test("restore non-removed item is idempotent", async () => {
  const user = await createTestUser("rs2");
  try {
    const content = makeReadyContent();
    const paper = await createReadyPaper(user.id, "l1", content);
    await prisma.$transaction(async tx => {
      await recordWrongItems(tx, user.id, paper.paperId, computePrivateContentHash(content), "att1", makeQuestions(), { "0": "B" });
    });
    const items = await listPrivateWrongItems(user.id, paper.paperId);
    const item = items[0];
    const restored = await restoreWrongItem(user.id, paper.paperId, item.contentHash, item.questionId, item.revision);
    assert.equal(restored.removedAt, null);
    assert.equal(restored.revision, 0, "idempotent restore should not increment revision");
  } finally { await cleanupUser(user.id); }
});

test("restore content-changed item throws VALIDATION_ERROR", async () => {
  const user = await createTestUser("rs3");
  try {
    const content = makeReadyContent();
    const paper = await createReadyPaper(user.id, "l1", content);
    const contentHash = computePrivateContentHash(content);
    await prisma.$transaction(async tx => {
      await recordWrongItems(tx, user.id, paper.paperId, contentHash, "att1", makeQuestions(), { "0": "B" });
    });
    const items = await listPrivateWrongItems(user.id, paper.paperId);
    const item = items[0];
    await removeWrongItem(user.id, paper.paperId, item.contentHash, item.questionId, item.revision);
    await prisma.privateWrongItem.updateMany({ where: { userId: user.id, paperId: paper.paperId }, data: { status: "content_changed" } });
    const removedItems = await listPrivateWrongItems(user.id, paper.paperId);
    const removedItem = removedItems[0];
    await assert.rejects(
      () => restoreWrongItem(user.id, paper.paperId, removedItem.contentHash, removedItem.questionId, removedItem.revision),
      (e: unknown) => e instanceof PrivateWrongItemStoreError && e.code === "VALIDATION_ERROR",
    );
  } finally { await cleanupUser(user.id); }
});

test("new attempt wrong answer re-activates removed item", async () => {
  const user = await createTestUser("react1");
  try {
    const content = makeReadyContent();
    const paper = await createReadyPaper(user.id, "l1", content);
    const contentHash = computePrivateContentHash(content);
    await prisma.$transaction(async tx => {
      await recordWrongItems(tx, user.id, paper.paperId, contentHash, "att1", makeQuestions(), { "0": "B", "1": "D", "2": "A" });
    });
    const items = await listPrivateWrongItems(user.id, paper.paperId);
    assert.equal(items.length, 3);
    const item = items[0];
    assert.equal(item.wrongCount, 1);
    await removeWrongItem(user.id, paper.paperId, item.contentHash, item.questionId, item.revision);
    const result = await prisma.$transaction(async tx => {
      return recordWrongItems(tx, user.id, paper.paperId, contentHash, "att2", makeQuestions(), { "0": "B", "1": "D", "2": "A" });
    });
    assert.equal(result.reactivated, 1);
    assert.equal(result.updated, 3);
    assert.equal(result.recorded, 0);
    const after = await listPrivateWrongItems(user.id, paper.paperId);
    const found = after.find(i => i.questionId === item.questionId)!;
    assert.equal(found.removedAt, null);
    assert.equal(found.wrongCount, 2);
    assert.equal(found.attemptId, "att2");
  } finally { await cleanupUser(user.id); }
});

test("same attempt retry does not re-activate or increment", async () => {
  const user = await createTestUser("react2");
  try {
    const content = makeReadyContent();
    const paper = await createReadyPaper(user.id, "l1", content);
    const contentHash = computePrivateContentHash(content);
    await prisma.$transaction(async tx => {
      await recordWrongItems(tx, user.id, paper.paperId, contentHash, "att1", makeQuestions(), { "0": "B" });
    });
    const items = await listPrivateWrongItems(user.id, paper.paperId);
    const item = items[0];
    await removeWrongItem(user.id, paper.paperId, item.contentHash, item.questionId, item.revision);
    const result = await prisma.$transaction(async tx => {
      return recordWrongItems(tx, user.id, paper.paperId, contentHash, "att1", makeQuestions(), { "0": "B" });
    });
    assert.equal(result.reactivated, 0);
    assert.equal(result.updated, 0);
    const after = await listPrivateWrongItems(user.id, paper.paperId);
    const found = after.find(i => i.questionId === item.questionId)!;
    assert.ok(found.removedAt !== null, "same attempt retry should not re-activate");
    assert.equal(found.wrongCount, 1);
  } finally { await cleanupUser(user.id); }
});

test("countWrongItems returns correct active/removed/contentChanged counts", async () => {
  const user = await createTestUser("cnt1");
  try {
    const content = makeReadyContent();
    const paper = await createReadyPaper(user.id, "l1", content);
    const contentHash = computePrivateContentHash(content);
    await prisma.$transaction(async tx => {
      await recordWrongItems(tx, user.id, paper.paperId, contentHash, "att1", makeQuestions(), { "0": "B", "1": "D", "2": "A" });
    });
    let counts = await countWrongItems(user.id, paper.paperId);
    assert.equal(counts.active, 3);
    assert.equal(counts.removed, 0);
    assert.equal(counts.contentChanged, 0);
    assert.equal(counts.total, 3);
    const items = await listPrivateWrongItems(user.id, paper.paperId);
    await removeWrongItem(user.id, paper.paperId, items[0].contentHash, items[0].questionId, items[0].revision);
    counts = await countWrongItems(user.id, paper.paperId);
    assert.equal(counts.active, 2);
    assert.equal(counts.removed, 1);
    assert.equal(counts.total, 3);
  } finally { await cleanupUser(user.id); }
});

test("selectReviewItems excludes removed items", async () => {
  const user = await createTestUser("rev1");
  try {
    const content = makeReadyContent();
    const paper = await createReadyPaper(user.id, "l1", content);
    const contentHash = computePrivateContentHash(content);
    await prisma.$transaction(async tx => {
      await recordWrongItems(tx, user.id, paper.paperId, contentHash, "att1", makeQuestions(), { "0": "B", "1": "D", "2": "A" });
    });
    let batch = await selectReviewItems(user.id, paper.paperId, 5);
    assert.equal(batch.questions.length, 3);
    const items = await listPrivateWrongItems(user.id, paper.paperId);
    await removeWrongItem(user.id, paper.paperId, items[0].contentHash, items[0].questionId, items[0].revision);
    batch = await selectReviewItems(user.id, paper.paperId, 5);
    assert.equal(batch.questions.length, 2);
  } finally { await cleanupUser(user.id); }
});

test("gradeReviewItems rejects removed items", async () => {
  const user = await createTestUser("rev2");
  try {
    const content = makeReadyContent();
    const paper = await createReadyPaper(user.id, "l1", content);
    const contentHash = computePrivateContentHash(content);
    await prisma.$transaction(async tx => {
      await recordWrongItems(tx, user.id, paper.paperId, contentHash, "att1", makeQuestions(), { "0": "B" });
    });
    const items = await listPrivateWrongItems(user.id, paper.paperId);
    const item = items[0];
    await removeWrongItem(user.id, paper.paperId, item.contentHash, item.questionId, item.revision);
    await assert.rejects(
      () => gradeReviewItems(user.id, paper.paperId, contentHash, { [item.questionId]: "A" }),
      (e: unknown) => e instanceof PrivateWrongItemStoreError && e.code === "VALIDATION_ERROR",
    );
  } finally { await cleanupUser(user.id); }
});

test("remove preserves all original fields", async () => {
  const user = await createTestUser("pres1");
  try {
    const content = makeReadyContent();
    const paper = await createReadyPaper(user.id, "l1", content);
    const contentHash = computePrivateContentHash(content);
    await prisma.$transaction(async tx => {
      await recordWrongItems(tx, user.id, paper.paperId, contentHash, "att1", makeQuestions(), { "0": "B" });
    });
    const items = await listPrivateWrongItems(user.id, paper.paperId);
    const item = items[0];
    const removed = await removeWrongItem(user.id, paper.paperId, item.contentHash, item.questionId, item.revision);
    assert.equal(removed.userAnswer, item.userAnswer);
    assert.equal(removed.correctAnswer, item.correctAnswer);
    assert.equal(removed.wrongCount, item.wrongCount);
    assert.equal(removed.attemptId, item.attemptId);
    assert.equal(removed.firstSeenAt, item.firstSeenAt);
    assert.equal(removed.lastSeenAt, item.lastSeenAt);
    assert.equal(removed.questionId, item.questionId);
    assert.equal(removed.contentHash, item.contentHash);
  } finally { await cleanupUser(user.id); }
});

test("recordWrongItems returns reactivated count", async () => {
  const user = await createTestUser("react3");
  try {
    const content = makeReadyContent();
    const paper = await createReadyPaper(user.id, "l1", content);
    const contentHash = computePrivateContentHash(content);
    const qs = makeQuestions();
    await prisma.$transaction(async tx => {
      await recordWrongItems(tx, user.id, paper.paperId, contentHash, "att1", qs, { "0": "B", "1": "D", "2": "A" });
    });
    const items = await listPrivateWrongItems(user.id, paper.paperId);
    assert.equal(items.length, 3);
    for (const item of items) {
      await removeWrongItem(user.id, paper.paperId, item.contentHash, item.questionId, item.revision);
    }
    const result = await prisma.$transaction(async tx => {
      return recordWrongItems(tx, user.id, paper.paperId, contentHash, "att2", qs, { "0": "B", "1": "D", "2": "A" });
    });
    assert.equal(result.reactivated, 3);
    assert.equal(result.recorded, 0);
    assert.equal(result.updated, 3);
  } finally { await cleanupUser(user.id); }
});
