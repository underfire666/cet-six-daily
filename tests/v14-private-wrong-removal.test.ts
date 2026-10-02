/**
 * V14 Phase 1D.4: PrivateWrongItem manual remove/restore tests.
 * Real Prisma with isolated random users. No DB mocking.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "../src/lib/db/prisma";
import { computePrivateContentHash, type PrivateFlatQuestion } from "../src/lib/private-papers/readiness";
import { createPrivatePaper, updatePrivatePaper, deletePrivatePaper } from "../src/content/private-paper-store";
import { putPrivatePaperProgress, getPrivatePaperProgress } from "../src/content/private-paper-progress-store";
import { parsePrivateWrongItems, parsePrivateWrongManagement } from "../src/lib/private-papers/wrong-items";
import { privateQuestionIdFromPageRoute } from "../src/lib/private-papers/validation";
import {
  recordWrongItems,
  listPrivateWrongItems,
  removeWrongItem,
  restoreWrongItem,
  countWrongItems,
  selectReviewItems,
  gradeReviewItems,
  countPrivateWrongItemViews,
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

async function submittedFixture(userId: string) {
  const content = makeReadyContent(), paper = await createReadyPaper(userId, randomUUID(), content);
  const input = { progressVersion: 1, mutationId: randomUUID(), attemptId: randomUUID(), contentHash: computePrivateContentHash(content), baseRevision: 0, answers: {0:"B",1:"C",2:"B"}, currentIndex: 2, submitted: true };
  const accepted = await putPrivatePaperProgress(userId, paper.paperId, input);
  const item = (await listPrivateWrongItems(userId, paper.paperId))[0];
  return { content, paper, input, accepted, item };
}
const conflict = (e: unknown) => e instanceof PrivateWrongItemStoreError && e.code === "CONFLICT";

test("management: page routes preserve distinct percent, encoded-percent and Unicode identities", () => {
  for (const id of ["q%", "q%25", "q 中文", "q%2525", "q /?"]) assert.equal(privateQuestionIdFromPageRoute(encodeURIComponent(id)),id);
  for (const segment of ["%", "", "%00", encodeURIComponent(" ")]) assert.throws(()=>privateQuestionIdFromPageRoute(segment));
});

test("management: parallel duplicate remove/restore applies exactly one transition per operation", async () => {
  const user = await createTestUser("cas-parallel");
  try {
    const {paper,item} = await submittedFixture(user.id);
    const removed = await Promise.all(Array.from({length:12}, () => removeWrongItem(user.id,paper.paperId,item.contentHash,item.questionId,0)));
    assert.ok(removed.every(i=>i.revision===1));
    assert.equal(new Set(removed.map(i=>i.removedAt)).size,1);
    const restored = await Promise.all(Array.from({length:12}, () => restoreWrongItem(user.id,paper.paperId,item.contentHash,item.questionId,1)));
    assert.ok(restored.every(i=>i.revision===2 && i.removedAt===null));
    assert.equal((await listPrivateWrongItems(user.id,paper.paperId))[0].revision,2);
  } finally { await cleanupUser(user.id); }
});

test("management: stale operations cannot reverse a later restore or removal", async () => {
  const user = await createTestUser("cas-replay");
  try {
    const {paper,item} = await submittedFixture(user.id);
    const removed = await removeWrongItem(user.id,paper.paperId,item.contentHash,item.questionId,0);
    const restored = await restoreWrongItem(user.id,paper.paperId,item.contentHash,item.questionId,1);
    await assert.rejects(()=>removeWrongItem(user.id,paper.paperId,item.contentHash,item.questionId,0),conflict);
    assert.deepEqual((await listPrivateWrongItems(user.id,paper.paperId))[0],restored);
    const removedAgain=await removeWrongItem(user.id,paper.paperId,item.contentHash,item.questionId,2);
    await assert.rejects(()=>restoreWrongItem(user.id,paper.paperId,item.contentHash,item.questionId,removed.revision),conflict);
    await assert.rejects(()=>removeWrongItem(user.id,paper.paperId,item.contentHash,item.questionId,0),conflict);
    assert.deepEqual((await listPrivateWrongItems(user.id,paper.paperId))[0],removedAgain);
  } finally { await cleanupUser(user.id); }
});

test("management: concurrent new learning submission wins over stale removal without duplicate wrong count", async () => {
  const user = await createTestUser("cas-learning");
  try {
    const {paper,item,input,accepted} = await submittedFixture(user.id);
    const next = {...input,mutationId:randomUUID(),attemptId:randomUUID(),mode:"restart",baseRevision:accepted.revision};
    const results=await Promise.allSettled([removeWrongItem(user.id,paper.paperId,item.contentHash,item.questionId,0),putPrivatePaperProgress(user.id,paper.paperId,next)]);
    assert.equal(results[1].status,"fulfilled");
    const current=(await listPrivateWrongItems(user.id,paper.paperId))[0];
    assert.equal(current.removedAt,null); assert.equal(current.wrongCount,2); assert.equal(current.attemptId,next.attemptId);
    await assert.rejects(()=>removeWrongItem(user.id,paper.paperId,item.contentHash,item.questionId,0),conflict);
    await putPrivatePaperProgress(user.id,paper.paperId,next);
    assert.deepEqual((await listPrivateWrongItems(user.id,paper.paperId))[0],current);
  } finally { await cleanupUser(user.id); }
});

test("management: original accepted mutation replay does not undo a later removal or change its receipt", async () => {
  const user=await createTestUser("cas-receipt");
  try {
    const {paper,item,input,accepted}=await submittedFixture(user.id);
    const progress=await getPrivatePaperProgress(user.id,paper.paperId);
    const removed=await removeWrongItem(user.id,paper.paperId,item.contentHash,item.questionId,0);
    assert.deepEqual(await putPrivatePaperProgress(user.id,paper.paperId,input),accepted);
    assert.deepEqual(await getPrivatePaperProgress(user.id,paper.paperId),progress);
    assert.deepEqual((await listPrivateWrongItems(user.id,paper.paperId))[0],removed);
  } finally { await cleanupUser(user.id); }
});

test("management: concurrent content edit invalidates old records and prevents restoration", async () => {
  const user=await createTestUser("cas-edit");
  try {
    const {paper,item,content}=await submittedFixture(user.id);
    const changed=structuredClone(content);
    (changed.sections as Array<{groups:Array<{passage:string}>}>)[0].groups[0].passage="Changed version";
    const results=await Promise.allSettled([removeWrongItem(user.id,paper.paperId,item.contentHash,item.questionId,0),updatePrivatePaper(user.id,paper.paperId,{content:changed})]);
    assert.equal(results[1].status,"fulfilled");
    const current=(await listPrivateWrongItems(user.id,paper.paperId))[0];
    assert.equal(current.status,"content_changed");assert.equal(current.question,undefined);
    await assert.rejects(()=>restoreWrongItem(user.id,paper.paperId,item.contentHash,item.questionId,current.revision),e=>e instanceof PrivateWrongItemStoreError&&e.code==="VALIDATION_ERROR");
    const items=await listPrivateWrongItems(user.id,paper.paperId),counts=await countWrongItems(user.id,paper.paperId);
    assert.deepEqual(counts,countPrivateWrongItemViews(items));
    assert.equal(counts.active+counts.removed+counts.contentChanged,counts.total);
  } finally { await cleanupUser(user.id); }
});

test("management: concurrent delete cannot resurrect wrong items", async () => {
  const user=await createTestUser("cas-delete");
  try {
    const {paper,item}=await submittedFixture(user.id);
    const results=await Promise.allSettled([removeWrongItem(user.id,paper.paperId,item.contentHash,item.questionId,0),deletePrivatePaper(user.id,paper.paperId)]);
    assert.equal(results[1].status,"fulfilled");
    assert.equal(await prisma.privateWrongItem.count({where:{userId:user.id,paperId:paper.paperId}}),0);
    await assert.rejects(()=>restoreWrongItem(user.id,paper.paperId,item.contentHash,item.questionId,1),e=>e instanceof PrivateWrongItemStoreError&&e.code==="NOT_FOUND");
    await assert.rejects(()=>countWrongItems(user.id,paper.paperId),e=>e instanceof PrivateWrongItemStoreError&&e.code==="NOT_FOUND");
  } finally { await cleanupUser(user.id); }
});

test("management: removed stale physical active records are counted from enriched validity and cannot restore", async () => {
  const user=await createTestUser("cas-hash");
  try {
    const {paper,item}=await submittedFixture(user.id);
    await removeWrongItem(user.id,paper.paperId,item.contentHash,item.questionId,0);
    await prisma.privateWrongItem.update({where:{id:item.id},data:{contentHash:"mismatch"}});
    const items=await listPrivateWrongItems(user.id,paper.paperId),counts=await countWrongItems(user.id,paper.paperId);
    assert.deepEqual(counts,{active:0,removed:1,contentChanged:0,total:1});
    assert.equal(items[0].question,undefined);
    assert.equal(parsePrivateWrongItems({ownerId:user.id,items,counts},user.id,paper.paperId).counts.removed,1);
    await assert.rejects(()=>restoreWrongItem(user.id,paper.paperId,"mismatch",item.questionId,1),e=>e instanceof PrivateWrongItemStoreError&&e.code==="VALIDATION_ERROR");
  } finally { await cleanupUser(user.id); }
});

test("management: parser rejects malformed removed questions, negative or inconsistent counts and duplicates", async () => {
  const user=await createTestUser("cas-parser");
  try {
    const {paper,item}=await submittedFixture(user.id);
    const removed=await removeWrongItem(user.id,paper.paperId,item.contentHash,item.questionId,0);
    const counts={active:0,removed:1,contentChanged:0,total:1};
    const parse=(entry:unknown,c:unknown=counts)=>parsePrivateWrongItems({ownerId:user.id,items:[entry],counts:c},user.id,paper.paperId);
    assert.ok(parse(removed));
    for(const entry of [{...removed,question:{prompt:"p",options:"invalid"}},{...removed,removedAt:"invalid"},{...removed,revision:-1},{...removed,question:{...removed.question,options:[{id:"A",text:"a"},{id:"A",text:"duplicate"}]}},{...removed,correctAnswer:"INVALID"},{...removed,userAnswer:"INVALID"}])assert.throws(()=>parse(entry));
    assert.throws(()=>parse(removed,{...counts,active:-10}));
    assert.throws(()=>parse(removed,{...counts,total:2}));
    assert.throws(()=>parsePrivateWrongItems({ownerId:user.id,items:[removed,removed],counts:{...counts,removed:2,total:2}},user.id,paper.paperId));
  } finally { await cleanupUser(user.id); }
});

test("management: success response is bound to owner, exact item, operation and revision", async () => {
  const user=await createTestUser("cas-response");
  try {
    const {paper,item}=await submittedFixture(user.id);
    const removed=await removeWrongItem(user.id,paper.paperId,item.contentHash,item.questionId,0),raw={ownerId:user.id,item:removed};
    assert.equal(parsePrivateWrongManagement(raw,user.id,item,true).revision,1);
    for(const response of [{...raw,ownerId:"other"},{item:removed},{...raw,item:{...removed,paperId:"other"}},{...raw,item:{...removed,revision:3}},{...raw,item:{...removed,removedAt:null}},{...raw,item:{...removed,wrongCount:2}}])assert.throws(()=>parsePrivateWrongManagement(response,user.id,item,true));
  } finally { await cleanupUser(user.id); }
});
