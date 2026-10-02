/**
 * V14 Phase 1D.2: PrivateWrongItem store + submission integration tests.
 * Real Prisma with isolated random users. No DB mocking.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "../src/lib/db/prisma";
import { computePrivateContentHash } from "../src/lib/private-papers/readiness";
import { createPrivatePaper, deletePrivatePaper, updatePrivatePaper } from "../src/content/private-paper-store";
import { putPrivatePaperProgress as writeProgress, getPrivatePaperProgress, PrivatePaperProgressStoreError } from "../src/content/private-paper-progress-store";
import { parsePrivateWrongItems } from "../src/lib/private-papers/wrong-items";
import {
  recordWrongItems,
  listPrivateWrongItems,
  getPrivateWrongItem,
  markWrongItemsContentChanged,
  deleteWrongItemsForPaper,
  PrivateWrongItemStoreError,
  listAllPrivateWrongItems,
  getPrivateWrongItemByQuestionId,
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

async function submitProgress(userId: string, paperId: string, content: Record<string, unknown>, input: Record<string, unknown>) {
  return writeProgress(userId, paperId, { progressVersion: 1, mutationId: randomUUID(), contentHash: computePrivateContentHash(content), baseRevision: 0, ...input });
}

async function cleanupUser(userId: string) {
  await prisma.privateWrongItem.deleteMany({ where: { userId } });
  await prisma.privatePaperProgress.deleteMany({ where: { userId } });
  await prisma.privatePaper.deleteMany({ where: { userId } });
  await prisma.user.delete({ where: { id: userId } }).catch(() => {});
}

test("1 wrong answer recorded", async () => {
  const user = await createTestUser("t1");
  try {
    const content = makeReadyContent();
    const paper = await createReadyPaper(user.id, "l1", content);
    const r = await submitProgress(user.id, paper.paperId, content, { attemptId: randomUUID(), answers: {0:"B",1:"C",2:"B"}, currentIndex: 2, submitted: true });
    assert.equal(r.wrongItemsRecorded, 1);
    const items = await listPrivateWrongItems(user.id, paper.paperId);
    assert.equal(items.length, 1);
    assert.equal(items[0].questionId, "q1");
    assert.equal(items[0].userAnswer, "B");
    assert.equal(items[0].correctAnswer, "A");
    assert.equal(items[0].wrongCount, 1);
    assert.equal(items[0].status, "active");
    assert.ok(items[0].question);
  } finally { await cleanupUser(user.id); }
});

test("2 correct answers not recorded", async () => {
  const user = await createTestUser("t2");
  try {
    const content = makeReadyContent();
    const paper = await createReadyPaper(user.id, "l1", content);
    const r = await submitProgress(user.id, paper.paperId, content, { attemptId: randomUUID(), answers: {0:"A",1:"C",2:"B"}, currentIndex: 2, submitted: true });
    assert.equal(r.wrongItemsRecorded, 0);
    assert.equal((await listPrivateWrongItems(user.id, paper.paperId)).length, 0);
  } finally { await cleanupUser(user.id); }
});

test("3 unanswered recorded as wrong", async () => {
  const user = await createTestUser("t3");
  try {
    const content = makeReadyContent();
    const paper = await createReadyPaper(user.id, "l1", content);
    const r = await submitProgress(user.id, paper.paperId, content, { attemptId: randomUUID(), answers: {0:"A",1:"C"}, currentIndex: 2, submitted: true });
    assert.equal(r.wrongItemsRecorded, 1);
    const items = await listPrivateWrongItems(user.id, paper.paperId);
    assert.equal(items[0].questionId, "q3");
    assert.equal(items[0].userAnswer, null);
  } finally { await cleanupUser(user.id); }
});

test("4 draft not recorded", async () => {
  const user = await createTestUser("t4");
  try {
    const content = makeReadyContent();
    const paper = await createReadyPaper(user.id, "l1", content);
    const r = await submitProgress(user.id, paper.paperId, content, { attemptId: randomUUID(), answers: {0:"B",1:"C",2:"B"}, currentIndex: 1, submitted: false });
    assert.equal(r.wrongItemsRecorded, 0);
    assert.equal((await listPrivateWrongItems(user.id, paper.paperId)).length, 0);
  } finally { await cleanupUser(user.id); }
});

test("5 same attempt idempotent", async () => {
  const user = await createTestUser("t5");
  try {
    const content = makeReadyContent();
    const paper = await createReadyPaper(user.id, "l1", content);
    const aid = randomUUID();
    const ans = {0:"B",1:"C",2:"B"};
    const r1 = await submitProgress(user.id, paper.paperId, content, { attemptId: aid, answers: ans, currentIndex: 2, submitted: true });
    assert.equal(r1.wrongItemsRecorded, 1);
    const r2 = await submitProgress(user.id, paper.paperId, content, { attemptId: aid, answers: ans, currentIndex: 2, submitted: true, baseRevision: r1.revision });
    assert.equal(r2.wrongItemsRecorded, 0);
    const items = await listPrivateWrongItems(user.id, paper.paperId);
    assert.equal(items.length, 1);
    assert.equal(items[0].wrongCount, 1);
  } finally { await cleanupUser(user.id); }
});

test("6 new attempt increments count", async () => {
  const user = await createTestUser("t6");
  try {
    const content = makeReadyContent();
    const paper = await createReadyPaper(user.id, "l1", content);
    const r1 = await submitProgress(user.id, paper.paperId, content, { attemptId: randomUUID(), answers: {0:"B",1:"C",2:"B"}, currentIndex: 2, submitted: true });
    const r2 = await submitProgress(user.id, paper.paperId, content, { attemptId: randomUUID(), answers: {0:"D",1:"A",2:"B"}, currentIndex: 2, submitted: true, baseRevision: r1.revision, mode: "restart" });
    assert.equal(r2.wrongItemsRecorded, 2);
    const items = await listPrivateWrongItems(user.id, paper.paperId);
    assert.equal(items.length, 2);
    assert.equal(items.find(i=>i.questionId==="q1")!.wrongCount, 2);
    assert.equal(items.find(i=>i.questionId==="q2")!.wrongCount, 1);
  } finally { await cleanupUser(user.id); }
});

test("7 correct later does not delete", async () => {
  const user = await createTestUser("t7");
  try {
    const content = makeReadyContent();
    const paper = await createReadyPaper(user.id, "l1", content);
    const r1 = await submitProgress(user.id, paper.paperId, content, { attemptId: randomUUID(), answers: {0:"B",1:"C",2:"B"}, currentIndex: 2, submitted: true });
    const r2 = await submitProgress(user.id, paper.paperId, content, { attemptId: randomUUID(), answers: {0:"A",1:"C",2:"B"}, currentIndex: 2, submitted: true, baseRevision: r1.revision, mode: "restart" });
    assert.equal(r2.wrongItemsRecorded, 0);
    const items = await listPrivateWrongItems(user.id, paper.paperId);
    assert.equal(items.length, 1);
    assert.equal(items[0].wrongCount, 1);
  } finally { await cleanupUser(user.id); }
});

test("8 content change marks content_changed", async () => {
  const user = await createTestUser("t8");
  try {
    const content = makeReadyContent();
    const paper = await createReadyPaper(user.id, "l1", content);
    await submitProgress(user.id, paper.paperId, content, { attemptId: randomUUID(), answers: {0:"B",1:"C",2:"B"}, currentIndex: 2, submitted: true });
    let items = await listPrivateWrongItems(user.id, paper.paperId);
    assert.equal(items[0].status, "active");
    assert.ok(items[0].question);
    const modified = makeReadyContent({ sections: [{ sectionId:"reading-1",type:"reading",order:0, groups:[{ groupId:"careful-1",type:"careful_reading",order:0, passage:"MODIFIED passage about quantum.", questions:[ {questionId:"q1",order:0,prompt:"Main?",type:"choice",options:[{id:"A",text:"AI"},{id:"B",text:"B"},{id:"C",text:"C"},{id:"D",text:"D"}],answerId:"A"}, {questionId:"q2",order:1,prompt:"Count?",type:"choice",options:[{id:"A",text:"2"},{id:"B",text:"3"},{id:"C",text:"4"},{id:"D",text:"5"}],answerId:"C"}, {questionId:"q3",order:2,prompt:"Field?",type:"choice",options:[{id:"A",text:"P"},{id:"B",text:"AI"},{id:"C",text:"C"},{id:"D",text:"B"}],answerId:"B"} ] }] }] });
    await updatePrivatePaper(user.id, paper.paperId, { content: modified });
    items = await listPrivateWrongItems(user.id, paper.paperId);
    assert.equal(items[0].status, "content_changed");
    assert.equal(items[0].question, undefined);
  } finally { await cleanupUser(user.id); }
});

test("9 delete paper cascades", async () => {
  const user = await createTestUser("t9");
  try {
    const content = makeReadyContent();
    const paper = await createReadyPaper(user.id, "l1", content);
    await submitProgress(user.id, paper.paperId, content, { attemptId: randomUUID(), answers: {0:"B",1:"C",2:"B"}, currentIndex: 2, submitted: true });
    assert.equal((await listPrivateWrongItems(user.id, paper.paperId)).length, 1);
    await deletePrivatePaper(user.id, paper.paperId);
    assert.equal(await prisma.privateWrongItem.count({ where: { userId: user.id, paperId: paper.paperId } }), 0);
  } finally { await cleanupUser(user.id); }
});

test("10 cross-user isolation", async () => {
  const a = await createTestUser("ta"); const b = await createTestUser("tb");
  try {
    const ca = makeReadyContent(); const cb = makeReadyContent();
    const pa = await createReadyPaper(a.id, "la", ca); const pb = await createReadyPaper(b.id, "lb", cb);
    await submitProgress(a.id, pa.paperId, ca, { attemptId: randomUUID(), answers: {0:"B",1:"C",2:"B"}, currentIndex: 2, submitted: true });
    assert.equal((await listPrivateWrongItems(b.id, pb.paperId)).length, 0);
    assert.equal((await listPrivateWrongItems(a.id, pa.paperId)).length, 1);
  } finally { await cleanupUser(a.id); await cleanupUser(b.id); }
});

test("11 getPrivateWrongItem detail", async () => {
  const user = await createTestUser("t11");
  try {
    const content = makeReadyContent();
    const paper = await createReadyPaper(user.id, "l1", content);
    await submitProgress(user.id, paper.paperId, content, { attemptId: randomUUID(), answers: {0:"B",1:"C",2:"B"}, currentIndex: 2, submitted: true });
    const items = await listPrivateWrongItems(user.id, paper.paperId);
    const item = await getPrivateWrongItem(user.id, items[0].id);
    assert.ok(item);
    assert.equal(item.questionId, "q1");
    assert.ok(item.question);
    assert.equal(item.question!.options.length, 4);
  } finally { await cleanupUser(user.id); }
});

test("12 non-owner rejected", async () => {
  const a = await createTestUser("ta12"); const b = await createTestUser("tb12");
  try {
    const content = makeReadyContent();
    const paper = await createReadyPaper(a.id, "l1", content);
    await submitProgress(a.id, paper.paperId, content, { attemptId: randomUUID(), answers: {0:"B",1:"C",2:"B"}, currentIndex: 2, submitted: true });
    const items = await listPrivateWrongItems(a.id, paper.paperId);
    await assert.rejects(() => getPrivateWrongItem(b.id, items[0].id), (e: Error) => e instanceof PrivateWrongItemStoreError && e.code === "NOT_FOUND");
  } finally { await cleanupUser(a.id); await cleanupUser(b.id); }
});

test("13 empty array creates nothing", async () => {
  const user = await createTestUser("t13");
  try {
    const content = makeReadyContent();
    const paper = await createReadyPaper(user.id, "l1", content);
    await prisma.$transaction(async tx => { await recordWrongItems(tx, user.id, paper.paperId, "h1", "a1", [], {}); });
    assert.equal(await prisma.privateWrongItem.count({ where: { userId: user.id } }), 0);
  } finally { await cleanupUser(user.id); }
});

test("14 markWrongItemsContentChanged", async () => {
  const user = await createTestUser("t14");
  try {
    const content = makeReadyContent();
    const paper = await createReadyPaper(user.id, "l1", content);
    await submitProgress(user.id, paper.paperId, content, { attemptId: randomUUID(), answers: {0:"B",1:"A",2:"B"}, currentIndex: 2, submitted: true });
    await prisma.$transaction(async tx => { await markWrongItemsContentChanged(tx, user.id, paper.paperId); });
    const items = await listPrivateWrongItems(user.id, paper.paperId);
    assert.equal(items.length, 2);
    assert.ok(items.every(i => i.status === "content_changed"));
  } finally { await cleanupUser(user.id); }
});

test("15 deleteWrongItemsForPaper", async () => {
  const user = await createTestUser("t15");
  try {
    const content = makeReadyContent();
    const paper = await createReadyPaper(user.id, "l1", content);
    await submitProgress(user.id, paper.paperId, content, { attemptId: randomUUID(), answers: {0:"B",1:"A",2:"B"}, currentIndex: 2, submitted: true });
    await prisma.$transaction(async tx => { await deleteWrongItemsForPaper(tx, user.id, paper.paperId); });
    assert.equal(await prisma.privateWrongItem.count({ where: { userId: user.id, paperId: paper.paperId } }), 0);
  } finally { await cleanupUser(user.id); }
});

test("submitted answers cannot change or become a draft; navigation remains allowed", async () => {
  const user = await createTestUser("immutable");
  try {
    const content = makeReadyContent(), paper = await createReadyPaper(user.id, "p", content);
    const input = { attemptId: randomUUID(), answers: { 0: "B", 1: "C", 2: "B" }, currentIndex: 2, submitted: true };
    const first = await submitProgress(user.id, paper.paperId, content, input);
    for (const patch of [{ answers: { 0: "A", 1: "A", 2: "B" } }, { submitted: false }]) {
      await assert.rejects(submitProgress(user.id, paper.paperId, content, { ...input, ...patch, baseRevision: first.revision }), (error: PrivatePaperProgressStoreError) => error.code === "CONFLICT" && error.extra?.conflictType === "submission_conflict");
    }
    const nav = await submitProgress(user.id, paper.paperId, content, { ...input, currentIndex: 0, baseRevision: first.revision });
    assert.equal(nav.wrongItemsRecorded, 0); assert.equal(nav.wrongItemsCount, 1);
    assert.deepEqual((await getPrivatePaperProgress(user.id, paper.paperId))!.answers, input.answers);
    assert.equal((await listPrivateWrongItems(user.id, paper.paperId))[0].wrongCount, 1);
  } finally { await cleanupUser(user.id); }
});

test("lost submission acknowledgement replays count and timestamps without duplication", async () => {
  const user = await createTestUser("receipt");
  try {
    const content = makeReadyContent(), paper = await createReadyPaper(user.id, "p", content);
    const input = { progressVersion: 1, mutationId: randomUUID(), attemptId: randomUUID(), contentHash: computePrivateContentHash(content), baseRevision: 0, currentIndex: 2, submitted: true, answers: { 0: "B", 1: "A", 2: "B" } };
    const result = await writeProgress(user.id, paper.paperId, input);
    const before = await listPrivateWrongItems(user.id, paper.paperId);
    assert.deepEqual(await writeProgress(user.id, paper.paperId, input), result);
    assert.equal(result.wrongItemsCount, 2);
    assert.deepEqual(await listPrivateWrongItems(user.id, paper.paperId), before);
    assert.equal((await getPrivatePaperProgress(user.id, paper.paperId))!.wrongItemsCount, 2);
  } finally { await cleanupUser(user.id); }
});

test("content versions preserve separate records, counts, and exact old-version links", async () => {
  const user = await createTestUser("versions");
  try {
    const content = makeReadyContent(), paper = await createReadyPaper(user.id, "p", content);
    const first = await submitProgress(user.id, paper.paperId, content, { attemptId: randomUUID(), answers: { 0: "B", 1: "C", 2: "B" }, currentIndex: 2, submitted: true });
    const old = (await listPrivateWrongItems(user.id, paper.paperId))[0];
    const modified = structuredClone(content);
    const sections = modified.sections as Array<{ groups: Array<{ passage: string }> }>;
    sections[0].groups[0].passage = "A genuinely different content version.";
    await updatePrivatePaper(user.id, paper.paperId, { content: modified });
    const next = await submitProgress(user.id, paper.paperId, modified, { mode: "restart", attemptId: randomUUID(), baseRevision: first.revision, answers: { 0: "D", 1: "C", 2: "B" }, currentIndex: 2, submitted: true });
    assert.equal(next.wrongItemsRecorded, 1);
    const items = await listPrivateWrongItems(user.id, paper.paperId);
    assert.equal(items.length, 2); assert.ok(items.every(item => item.wrongCount === 1));
    const invalid = items.find(item => item.id === old.id)!;
    assert.equal(invalid.status, "content_changed"); assert.equal(invalid.question, undefined);
    assert.equal((await getPrivateWrongItemByQuestionId(user.id, paper.paperId, "q1", old.contentHash)).id, old.id);
    assert.equal((await getPrivateWrongItemByQuestionId(user.id, paper.paperId, "q1")).status, "active");
    const response = parsePrivateWrongItems({ ownerId: user.id, items, total: 1, invalidatedTotal: 1 }, user.id, paper.paperId);
    assert.equal(response.total, 1); assert.equal(response.invalidatedTotal, 1);
  } finally { await cleanupUser(user.id); }
});

test("every read path invalidates mismatched content even if stored status is active", async () => {
  const user = await createTestUser("hashguard");
  try {
    const content = makeReadyContent(), paper = await createReadyPaper(user.id, "p", content);
    await submitProgress(user.id, paper.paperId, content, { attemptId: randomUUID(), answers: { 0: "B", 1: "C", 2: "B" }, currentIndex: 2, submitted: true });
    const old = (await listPrivateWrongItems(user.id, paper.paperId))[0];
    await prisma.privateWrongItem.update({ where: { id: old.id }, data: { contentHash: "v3:mismatch" } });
    for (const item of [(await listPrivateWrongItems(user.id, paper.paperId))[0], await getPrivateWrongItem(user.id, old.id), await getPrivateWrongItemByQuestionId(user.id, paper.paperId, old.questionId), (await listAllPrivateWrongItems(user.id))[0]]) {
      assert.equal(item.status, "content_changed"); assert.equal(item.question, undefined);
    }
  } finally { await cleanupUser(user.id); }
});

test("repeated wrong rounds report updated items; a correct round has a zero receipt", async () => {
  const user = await createTestUser("counts");
  try {
    const content = makeReadyContent(), paper = await createReadyPaper(user.id, "p", content);
    const input = { attemptId: randomUUID(), answers: { 0: "B", 1: "C", 2: "B" }, currentIndex: 2, submitted: true };
    const first = await submitProgress(user.id, paper.paperId, content, input);
    const second = await submitProgress(user.id, paper.paperId, content, { ...input, mode: "restart", attemptId: randomUUID(), baseRevision: first.revision });
    assert.equal(second.wrongItemsRecorded, 1); assert.equal(second.wrongItemsCount, 1);
    const correct = await submitProgress(user.id, paper.paperId, content, { ...input, answers: { 0: "A", 1: "C", 2: "B" }, mode: "restart", attemptId: randomUUID(), baseRevision: second.revision });
    assert.equal(correct.wrongItemsCount, 0); assert.equal((await getPrivatePaperProgress(user.id, paper.paperId))!.wrongItemsCount, 0);
    assert.equal((await listPrivateWrongItems(user.id, paper.paperId))[0].wrongCount, 2);
  } finally { await cleanupUser(user.id); }
});

test("an older submitted attempt ID cannot be reused after another round", async () => {
  const user = await createTestUser("roundreuse");
  try {
    const content = makeReadyContent(), paper = await createReadyPaper(user.id, "p", content);
    const input = { attemptId: randomUUID(), answers: { 0: "B", 1: "C", 2: "B" }, currentIndex: 2, submitted: true };
    const first = await submitProgress(user.id, paper.paperId, content, input);
    const second = await submitProgress(user.id, paper.paperId, content, { ...input, mode: "restart", attemptId: randomUUID(), baseRevision: first.revision });
    await assert.rejects(submitProgress(user.id, paper.paperId, content, { ...input, mode: "restart", baseRevision: second.revision }), (error: PrivatePaperProgressStoreError) => error.code === "VALIDATION_ERROR");
    assert.equal((await listPrivateWrongItems(user.id, paper.paperId))[0].wrongCount, 2);
  } finally { await cleanupUser(user.id); }
});

test("parallel submission with the same revision records only the accepted result", async () => {
  const user = await createTestUser("submitrace");
  try {
    const content = makeReadyContent(), paper = await createReadyPaper(user.id, "p", content);
    const input = { attemptId: randomUUID(), answers: { 0: "B", 1: "C", 2: "B" }, currentIndex: 2, submitted: true };
    const outcomes = await Promise.allSettled([0, 1].map(() => submitProgress(user.id, paper.paperId, content, input)));
    assert.equal(outcomes.filter(outcome => outcome.status === "fulfilled").length, 1);
    assert.equal((await listPrivateWrongItems(user.id, paper.paperId))[0].wrongCount, 1);
  } finally { await cleanupUser(user.id); }
});

test("failed wrong-item write rolls back progress and receipt; retry collects once", async () => {
  const user = await createTestUser("rollback");
  const original = prisma.$transaction;
  try {
    const content = makeReadyContent(), paper = await createReadyPaper(user.id, "p", content);
    const input = { progressVersion: 1, mutationId: randomUUID(), contentHash: computePrivateContentHash(content), baseRevision: 0, attemptId: randomUUID(), answers: { 0: "B", 1: "C", 2: "B" }, currentIndex: 2, submitted: true };
    Object.assign(prisma, { $transaction: (operation: (tx: import("@prisma/client").Prisma.TransactionClient) => Promise<unknown>) => original.call(prisma, tx => operation(new Proxy(tx, { get(target, prop, receiver) { return prop === "privateWrongItem" ? new Proxy(target.privateWrongItem, { get(delegate, name) { return name === "create" ? async () => { throw Error("isolated simulated write failure"); } : Reflect.get(delegate, name); } }) : Reflect.get(target, prop, receiver); } }))) });
    await assert.rejects(writeProgress(user.id, paper.paperId, input), (error: PrivatePaperProgressStoreError) => error.code === "INTERNAL_ERROR");
    Object.assign(prisma, { $transaction: original });
    assert.equal(await getPrivatePaperProgress(user.id, paper.paperId), null);
    assert.equal(await prisma.syncMutation.count({ where: { userId: user.id } }), 0);
    assert.equal((await writeProgress(user.id, paper.paperId, input)).wrongItemsCount, 1);
  } finally { Object.assign(prisma, { $transaction: original }); await cleanupUser(user.id); }
});

test("deleted paper denies stale submission and exact detail read", async () => {
  const user = await createTestUser("staledelete");
  try {
    const content = makeReadyContent(), paper = await createReadyPaper(user.id, "p", content);
    const input = { attemptId: randomUUID(), answers: { 0: "B", 1: "C", 2: "B" }, currentIndex: 2, submitted: true };
    await submitProgress(user.id, paper.paperId, content, input);
    const old = (await listPrivateWrongItems(user.id, paper.paperId))[0];
    await deletePrivatePaper(user.id, paper.paperId);
    await assert.rejects(submitProgress(user.id, paper.paperId, content, input), (error: PrivatePaperProgressStoreError) => error.code === "NOT_FOUND");
    await assert.rejects(getPrivateWrongItem(user.id, old.id), (error: PrivateWrongItemStoreError) => error.code === "NOT_FOUND");
    assert.equal(await prisma.privateWrongItem.count({ where: { userId: user.id } }), 0);
  } finally { await cleanupUser(user.id); }
});

test("wrong-item response rejects another owner, malformed success, and missing active question", () => {
  assert.throws(() => parsePrivateWrongItems({ ownerId: "other", items: [], total: 0, invalidatedTotal: 0 }, "owner", "paper"));
  assert.throws(() => parsePrivateWrongItems({}, "owner", "paper"));
  assert.throws(() => parsePrivateWrongItems({ ownerId: "owner", items: [{ status: "active" }], total: 1, invalidatedTotal: 0 }, "owner", "paper"));
});
