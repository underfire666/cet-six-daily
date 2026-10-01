/**
 * V14 Phase 1E.1: PrivatePaper Progress 服务端存储 + API 集成测试。
 *
 * 使用真实 Prisma（隔离随机用户，测试后级联清理）。禁止 mock 数据库。
 */
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "../src/lib/db/prisma";
import { createPrivatePaper } from "../src/content/private-paper-store";
import {
  getPrivatePaperProgress,
  putPrivatePaperProgress,
  PrivatePaperProgressStoreError,
} from "../src/content/private-paper-progress-store";
import { checkPrivatePaperReadiness } from "../src/lib/private-papers/readiness";
import { privateRequest } from "../src/lib/private-papers/http";

async function createTestUser(prefix: string) {
  const id = randomUUID();
  return prisma.user.create({
    data: { email: `${prefix}-${id}@example.invalid`, passwordHash: "test-only" },
  });
}

function makeRightsAck() {
  return { acknowledged: true, acknowledgedAt: new Date().toISOString(), statementVersion: "1.0" };
}

function makeReadyContent(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: 1,
    isPartial: false,
    sections: [
      {
        sectionId: "reading-1",
        type: "reading",
        order: 0,
        groups: [
          {
            groupId: "careful-1",
            type: "careful_reading",
            order: 0,
            passage: "This is a test passage about artificial intelligence.",
            questions: [
              {
                questionId: "q1", order: 0, prompt: "What is the main topic?", type: "choice",
                options: [
                  { id: "A", text: "AI" },
                  { id: "B", text: "Biology" },
                  { id: "C", text: "Chemistry" },
                  { id: "D", text: "Physics" },
                ],
                answerId: "A",
              },
              {
                questionId: "q2", order: 1, prompt: "How many options?", type: "choice",
                options: [
                  { id: "A", text: "2" },
                  { id: "B", text: "3" },
                  { id: "C", text: "4" },
                  { id: "D", text: "5" },
                ],
                answerId: "C",
              },
            ],
          },
        ],
      },
    ],
    ...overrides,
  };
}

async function createReadyPaper(userId: string, localId: string, overrides: Record<string, unknown> = {}) {
  const content = makeReadyContent(overrides);
  const created = await createPrivatePaper(userId, {
    localPaperId: localId,
    title: `Progress Test ${localId}`,
    content,
    rightsAcknowledgement: makeRightsAck(),
  });
  const readiness = checkPrivatePaperReadiness(content);
  return { paperId: created.paperId, contentHash: readiness.contentHash, questionCount: readiness.questions.length };
}

async function expectProgressError(fn: () => Promise<unknown>, code: string, conflictType?: string) {
  let err: PrivatePaperProgressStoreError | undefined;
  try { await fn(); } catch (e) { err = e as PrivatePaperProgressStoreError; }
  assert.ok(err, "should throw");
  assert.equal(err!.code, code, `expected code ${code}`);
  if (conflictType) assert.equal(err!.extra?.conflictType, conflictType);
  return err!;
}

// 1. GET
test("1a. GET：空 userId → NOT_FOUND", async () => {
  await expectProgressError(() => getPrivatePaperProgress("", "private:x:y"), "NOT_FOUND");
});

test("1b. GET：跨 owner → NOT_FOUND", async () => {
  const userA = await createTestUser("prog-ownerA");
  const userB = await createTestUser("prog-ownerB");
  try {
    const { paperId } = await createReadyPaper(userA.id, "a-paper");
    await expectProgressError(() => getPrivatePaperProgress(userB.id, paperId), "NOT_FOUND");
  } finally {
    await prisma.user.delete({ where: { id: userA.id } });
    await prisma.user.delete({ where: { id: userB.id } });
  }
});

test("1c. GET：无进度 → null", async () => {
  const user = await createTestUser("prog-null");
  try {
    const { paperId } = await createReadyPaper(user.id, "no-progress");
    assert.equal(await getPrivatePaperProgress(user.id, paperId), null);
  } finally { await prisma.user.delete({ where: { id: user.id } }); }
});

test("1d. GET：有进度返回且不含 score", async () => {
  const user = await createTestUser("prog-read");
  try {
    const { paperId, contentHash } = await createReadyPaper(user.id, "read-paper");
    const attemptId = randomUUID();
    await putPrivatePaperProgress(user.id, paperId, { attemptId, contentHash, answers: { "0": "A" }, currentIndex: 1, submitted: false, baseRevision: 0 });
    const progress = await getPrivatePaperProgress(user.id, paperId);
    assert.ok(progress);
    assert.equal(progress!.attemptId, attemptId);
    assert.equal(progress!.revision, 1);
    assert.deepEqual(progress!.answers, { "0": "A" });
    assert.equal(progress!.currentIndex, 1);
    assert.equal(progress!.submitted, false);
    assert.ok(!("score" in progress!));
  } finally { await prisma.user.delete({ where: { id: user.id } }); }
});

test("1e. GET：contentHash 不匹配 → null", async () => {
  const user = await createTestUser("prog-hm");
  try {
    const { paperId, contentHash } = await createReadyPaper(user.id, "hm-paper");
    await putPrivatePaperProgress(user.id, paperId, { attemptId: randomUUID(), contentHash, answers: { "0": "A" }, currentIndex: 0, submitted: false, baseRevision: 0 });
    await prisma.privatePaperProgress.update({ where: { userId_paperId: { userId: user.id, paperId } }, data: { contentHash: "v3:stale" } });
    assert.equal(await getPrivatePaperProgress(user.id, paperId), null);
  } finally { await prisma.user.delete({ where: { id: user.id } }); }
});

test("1f. GET：非法答案被净化", async () => {
  const user = await createTestUser("prog-sani");
  try {
    const { paperId, contentHash } = await createReadyPaper(user.id, "sani-paper");
    const attemptId = randomUUID();
    await putPrivatePaperProgress(user.id, paperId, { attemptId, contentHash, answers: { "0": "A" }, currentIndex: 0, submitted: false, baseRevision: 0 });
    await prisma.privatePaperProgress.update({ where: { userId_paperId: { userId: user.id, paperId } }, data: { answers: { "0": "A", "1": "NOPE", "5": "A" } } });
    const progress = await getPrivatePaperProgress(user.id, paperId);
    assert.deepEqual(progress!.answers, { "0": "A" });
  } finally { await prisma.user.delete({ where: { id: user.id } }); }
});

// 2. PUT
test("2a. PUT：首次创建 baseRevision=0 → revision=1", async () => {
  const user = await createTestUser("prog-c");
  try {
    const { paperId, contentHash } = await createReadyPaper(user.id, "c-paper");
    const res = await putPrivatePaperProgress(user.id, paperId, { attemptId: randomUUID(), contentHash, answers: { "0": "A" }, currentIndex: 0, submitted: false, baseRevision: 0 });
    assert.equal(res.revision, 1);
  } finally { await prisma.user.delete({ where: { id: user.id } }); }
});

test("2b. PUT：revision 递增 1→2", async () => {
  const user = await createTestUser("prog-i");
  try {
    const { paperId, contentHash } = await createReadyPaper(user.id, "i-paper");
    const attemptId = randomUUID();
    const r1 = await putPrivatePaperProgress(user.id, paperId, { attemptId, contentHash, answers: { "0": "A" }, currentIndex: 0, submitted: false, baseRevision: 0 });
    const r2 = await putPrivatePaperProgress(user.id, paperId, { attemptId, contentHash, answers: { "0": "A", "1": "C" }, currentIndex: 1, submitted: false, baseRevision: r1.revision });
    assert.equal(r2.revision, 2);
  } finally { await prisma.user.delete({ where: { id: user.id } }); }
});

test("2c. PUT：revision 冲突 + 服务端进度", async () => {
  const user = await createTestUser("prog-rc");
  try {
    const { paperId, contentHash } = await createReadyPaper(user.id, "rc-paper");
    const attemptId = randomUUID();
    await putPrivatePaperProgress(user.id, paperId, { attemptId, contentHash, answers: { "0": "A" }, currentIndex: 0, submitted: false, baseRevision: 0 });
    await putPrivatePaperProgress(user.id, paperId, { attemptId, contentHash, answers: { "0": "A", "1": "C" }, currentIndex: 1, submitted: false, baseRevision: 1 });
    const err = await expectProgressError(
      () => putPrivatePaperProgress(user.id, paperId, { attemptId, contentHash, answers: { "0": "B" }, currentIndex: 0, submitted: false, baseRevision: 1 }),
      "CONFLICT", "revision_conflict");
    assert.equal(err.extra!.currentRevision, 2);
    assert.equal((err.extra!.serverProgress as { revision: number }).revision, 2);
  } finally { await prisma.user.delete({ where: { id: user.id } }); }
});

test("2d. PUT 幂等：重复 baseRevision → revision_conflict", async () => {
  const user = await createTestUser("prog-id");
  try {
    const { paperId, contentHash } = await createReadyPaper(user.id, "id-paper");
    const attemptId = randomUUID();
    await putPrivatePaperProgress(user.id, paperId, { attemptId, contentHash, answers: { "0": "A" }, currentIndex: 0, submitted: false, baseRevision: 0 });
    const ok = await putPrivatePaperProgress(user.id, paperId, { attemptId, contentHash, answers: { "1": "C" }, currentIndex: 1, submitted: false, baseRevision: 1 });
    assert.equal(ok.revision, 2);
    await expectProgressError(
      () => putPrivatePaperProgress(user.id, paperId, { attemptId, contentHash, answers: { "0": "B" }, currentIndex: 0, submitted: false, baseRevision: 1 }),
      "CONFLICT", "revision_conflict");
  } finally { await prisma.user.delete({ where: { id: user.id } }); }
});

test("2e. PUT：attemptId 不匹配 → attempt_mismatch", async () => {
  const user = await createTestUser("prog-at");
  try {
    const { paperId, contentHash } = await createReadyPaper(user.id, "at-paper");
    await putPrivatePaperProgress(user.id, paperId, { attemptId: randomUUID(), contentHash, answers: { "0": "A" }, currentIndex: 0, submitted: false, baseRevision: 0 });
    const err = await expectProgressError(
      () => putPrivatePaperProgress(user.id, paperId, { attemptId: randomUUID(), contentHash, answers: {}, currentIndex: 0, submitted: false, baseRevision: 1 }),
      "CONFLICT", "attempt_mismatch");
    assert.ok(typeof err.extra!.currentAttemptId === "string");
  } finally { await prisma.user.delete({ where: { id: user.id } }); }
});

test("2f. PUT：contentHash 错误 → CONTENT_CHANGED", async () => {
  const user = await createTestUser("prog-ch");
  try {
    const { paperId } = await createReadyPaper(user.id, "ch-paper");
    await expectProgressError(
      () => putPrivatePaperProgress(user.id, paperId, { attemptId: randomUUID(), contentHash: "v3:x", answers: {}, currentIndex: 0, submitted: false, baseRevision: 0 }),
      "CONTENT_CHANGED");
  } finally { await prisma.user.delete({ where: { id: user.id } }); }
});

test("2g. PUT：草稿 → NOT_READY", async () => {
  const user = await createTestUser("prog-dr");
  try {
    const created = await createPrivatePaper(user.id, { localPaperId: "dr-paper", title: "Draft", content: makeReadyContent({ isPartial: true }), rightsAcknowledgement: makeRightsAck() });
    await expectProgressError(
      () => putPrivatePaperProgress(user.id, created.paperId, { attemptId: randomUUID(), contentHash: "v3:x", answers: {}, currentIndex: 0, submitted: false, baseRevision: 0 }),
      "NOT_READY");
  } finally { await prisma.user.delete({ where: { id: user.id } }); }
});

test("2h. PUT：非法 optionId → VALIDATION_ERROR", async () => {
  const user = await createTestUser("prog-ba");
  try {
    const { paperId, contentHash } = await createReadyPaper(user.id, "ba-paper");
    await expectProgressError(
      () => putPrivatePaperProgress(user.id, paperId, { attemptId: randomUUID(), contentHash, answers: { "0": "ZZ" }, currentIndex: 0, submitted: false, baseRevision: 0 }),
      "VALIDATION_ERROR");
  } finally { await prisma.user.delete({ where: { id: user.id } }); }
});

test("2i. PUT：非法 answer key → VALIDATION_ERROR", async () => {
  const user = await createTestUser("prog-bk");
  try {
    const { paperId, contentHash } = await createReadyPaper(user.id, "bk-paper");
    await expectProgressError(
      () => putPrivatePaperProgress(user.id, paperId, { attemptId: randomUUID(), contentHash, answers: { "abc": "A" }, currentIndex: 0, submitted: false, baseRevision: 0 }),
      "VALIDATION_ERROR");
  } finally { await prisma.user.delete({ where: { id: user.id } }); }
});

test("2j. PUT：currentIndex 越界钳位", async () => {
  const user = await createTestUser("prog-cl");
  try {
    const { paperId, contentHash, questionCount } = await createReadyPaper(user.id, "cl-paper");
    await putPrivatePaperProgress(user.id, paperId, { attemptId: randomUUID(), contentHash, answers: { "0": "A" }, currentIndex: 999, submitted: false, baseRevision: 0 });
    const p = await getPrivatePaperProgress(user.id, paperId);
    assert.equal(p!.currentIndex, questionCount - 1);
  } finally { await prisma.user.delete({ where: { id: user.id } }); }
});

test("2k. PUT：submitted 非 boolean → VALIDATION_ERROR", async () => {
  const user = await createTestUser("prog-su");
  try {
    const { paperId, contentHash } = await createReadyPaper(user.id, "su-paper");
    await expectProgressError(
      () => putPrivatePaperProgress(user.id, paperId, { attemptId: randomUUID(), contentHash, answers: {}, currentIndex: 0, submitted: "yes", baseRevision: 0 }),
      "VALIDATION_ERROR");
  } finally { await prisma.user.delete({ where: { id: user.id } }); }
});

test("2l. PUT：跨 owner → NOT_FOUND", async () => {
  const userA = await createTestUser("prog-woa");
  const userB = await createTestUser("prog-wob");
  try {
    const { paperId, contentHash } = await createReadyPaper(userA.id, "wo-paper");
    await expectProgressError(
      () => putPrivatePaperProgress(userB.id, paperId, { attemptId: randomUUID(), contentHash, answers: {}, currentIndex: 0, submitted: false, baseRevision: 0 }),
      "NOT_FOUND");
  } finally {
    await prisma.user.delete({ where: { id: userA.id } });
    await prisma.user.delete({ where: { id: userB.id } });
  }
});

// 3. 未登录 401
test("3a. privateRequest：session 为空 → 401", async () => {
  const res = await privateRequest(async () => null, async () => Response.json({ ok: true }));
  assert.equal(res.status, 401);
});

test.after(async () => {
  await prisma.$disconnect();
});