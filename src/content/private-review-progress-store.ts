/** Owner-scoped PRIVATE review progress. Paper row locks serialize writes. */
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { checkPrivatePaperReadiness, type PrivateFlatQuestion } from "@/lib/private-papers/readiness";
import { selectReviewItems, gradeReviewItems, PrivateWrongItemStoreError } from "@/content/private-wrong-item-store";

export type PrivateReviewProgressErrorCode = "NOT_FOUND" | "VALIDATION_ERROR" | "CONFLICT" | "NOT_READY" | "CONTENT_CHANGED" | "BATCH_MISMATCH" | "INTERNAL_ERROR";
export class PrivateReviewProgressStoreError extends Error {
  constructor(public code: PrivateReviewProgressErrorCode, message: string, public extra?: Record<string, unknown>) { super(message); this.name = "PrivateReviewProgressStoreError"; }
}

export interface PrivateReviewQuestionView {
  questionId: string;
  prompt: string;
  options: Array<{ id: string; text: string }>;
  passage?: string;
}

export interface PrivateReviewProgressView {
  paperId: string;
  reviewBatchId: string;
  contentHash: string;
  questions: PrivateReviewQuestionView[];
  answers: Record<string, string | null>;
  currentIndex: number;
  submitted: boolean;
  result?: { results: Array<{ questionId: string; userAnswer: string | null; correctAnswer: string; correct: boolean }>; total: number; correct: number; unanswered: number };
  revision: number;
  updatedAt: string;
}

export interface PrivateReviewProgressSnapshot {
  progress: PrivateReviewProgressView | null;
  revision: number;
  invalidated: boolean;
  invalidReason?: string;
}

const key = (userId: string, paperId: string) => ({ userId_paperId: { userId, paperId } });
const record = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
function invalid(message: string): never { throw new PrivateReviewProgressStoreError("VALIDATION_ERROR", message); }
function identity(userId: string, paperId: string) {
  if (!userId?.trim() || !/^private:[^:@\s]+:[^:\x00-\x1f\x7f]+$/u.test(paperId) || paperId.length > 400) throw new PrivateReviewProgressStoreError("NOT_FOUND", "paper not found");
}
async function database<T>(operation: () => Promise<T>): Promise<T> {
  try { return await operation(); } catch (error) {
    if (error instanceof PrivateReviewProgressStoreError) throw error;
    if (error instanceof PrivateWrongItemStoreError) {
      const codeMap: Record<string, PrivateReviewProgressErrorCode> = { NOT_FOUND: "NOT_FOUND", VALIDATION_ERROR: "VALIDATION_ERROR", CONFLICT: "CONFLICT", INTERNAL_ERROR: "INTERNAL_ERROR" };
      throw new PrivateReviewProgressStoreError(codeMap[error.code] ?? "INTERNAL_ERROR", error.message);
    }
    throw new PrivateReviewProgressStoreError("INTERNAL_ERROR", "private review progress storage unavailable");
  }
}
async function lockPaper(tx: Prisma.TransactionClient, userId: string, paperId: string) {
  const papers = await tx.$queryRaw<Array<{ content: Prisma.JsonValue }>>(Prisma.sql`SELECT "content" FROM "PrivatePaper" WHERE "userId" = ${userId} AND "paperId" = ${paperId} FOR UPDATE`);
  if (!papers[0] || !record(papers[0].content)) throw new PrivateReviewProgressStoreError("NOT_FOUND", "paper not found");
  return checkPrivatePaperReadiness(papers[0].content);
}
function sanitizeAnswers(raw: unknown, questionIds: string[]): Record<string, string | null> {
  if (!record(raw)) return Object.fromEntries(questionIds.map(id => [id, null]));
  const clean: Record<string, string | null> = {};
  for (const qid of questionIds) {
    const v = raw[qid];
    clean[qid] = (v === null || typeof v === "string") ? v : null;
  }
  return clean;
}
function questionView(q: PrivateFlatQuestion): PrivateReviewQuestionView {
  return { questionId: q.questionId, prompt: q.prompt, options: q.options.map(o => ({ id: o.id, text: o.text })), passage: q.passage };
}
function buildView(row: { paperId: string; reviewBatchId: string; contentHash: string; questionIds: Prisma.JsonValue; answers: Prisma.JsonValue; currentIndex: number; submitted: boolean; result: Prisma.JsonValue | null; revision: number; updatedAt: Date }, questions: PrivateFlatQuestion[]): PrivateReviewProgressView {
  const ids = Array.isArray(row.questionIds) ? row.questionIds.filter((x): x is string => typeof x === "string") : [];
  const qMap = new Map(questions.map(q => [q.questionId, q]));
  const qs = ids.map(id => qMap.get(id)).filter((q): q is PrivateFlatQuestion => !!q).map(questionView);
  return {
    paperId: row.paperId, reviewBatchId: row.reviewBatchId, contentHash: row.contentHash,
    questions: qs, answers: sanitizeAnswers(row.answers, ids),
    currentIndex: Math.max(0, Math.min(row.currentIndex, Math.max(0, qs.length - 1))),
    submitted: row.submitted,
    result: row.result && record(row.result) && Array.isArray(row.result.results) ? row.result as PrivateReviewProgressView["result"] : undefined,
    revision: row.revision, updatedAt: row.updatedAt.toISOString(),
  };
}

/** Read-only hydration: never write sanitized old answers back over a newer update. */
export async function readPrivateReviewProgressSnapshot(userId: string, paperId: string): Promise<PrivateReviewProgressSnapshot> {
  identity(userId, paperId);
  return database(() => prisma.$transaction(async tx => {
    const ready = await lockPaper(tx, userId, paperId);
    if (!ready.ready) throw new PrivateReviewProgressStoreError("NOT_READY", "paper is not ready", { reason: ready.reason });
    const row = await tx.privateReviewProgress.findUnique({ where: key(userId, paperId) });
    if (!row) return { progress: null, revision: 0, invalidated: false };
    if (row.contentHash !== ready.contentHash) return { progress: null, revision: row.revision, invalidated: true, invalidReason: "content version changed" };
    const ids = Array.isArray(row.questionIds) ? row.questionIds.filter((x): x is string => typeof x === "string") : [];
    const qMap = new Map(ready.questions.map(q => [q.questionId, q]));
    const allValid = ids.every(id => {
      const q = qMap.get(id);
      return !!q;
    });
    if (!allValid) return { progress: null, revision: row.revision, invalidated: true, invalidReason: "batch questions no longer valid" };
    return { progress: buildView(row, ready.questions), revision: row.revision, invalidated: false };
  }));
}

/** Start a new review batch: server selects questions and persists the batch. */
export async function startPrivateReviewBatch(userId: string, paperId: string, limit: number): Promise<PrivateReviewProgressView> {
  identity(userId, paperId);
  if (!Number.isInteger(limit) || limit < 1 || limit > 5) invalid("limit must be 1-5");
  return database(async () => {
    // selectReviewItems runs in its own read transaction; call outside the write transaction to avoid nested transaction deadlock.
    const batch = await selectReviewItems(userId, paperId, limit);
    const questionIds = batch.questions.map(q => q.questionId);
    const reviewBatchId = batch.reviewBatchId;
    const answers = Object.fromEntries(questionIds.map(id => [id, null]));
    return prisma.$transaction(async tx => {
      const ready = await lockPaper(tx, userId, paperId);
      if (!ready.ready) throw new PrivateReviewProgressStoreError("NOT_READY", "paper is not ready", { reason: ready.reason });
      const existing = await tx.privateReviewProgress.findUnique({ where: key(userId, paperId) });
      const row = existing
        ? await tx.privateReviewProgress.update({ where: key(userId, paperId), data: { reviewBatchId, contentHash: ready.contentHash, questionIds, answers, currentIndex: 0, submitted: false, result: Prisma.JsonNull, revision: { increment: 1 } } })
        : await tx.privateReviewProgress.create({ data: { userId, paperId, reviewBatchId, contentHash: ready.contentHash, questionIds, answers, currentIndex: 0, submitted: false, revision: 1 } });
      return buildView(row, ready.questions);
    });
  });
}

/** Save in-progress answers/currentIndex. CAS revision check. Does not grade or submit. */
export async function savePrivateReviewProgress(userId: string, paperId: string, input: unknown): Promise<{ revision: number; updatedAt: string }> {
  identity(userId, paperId);
  if (!record(input)) invalid("request object required");
  const { reviewBatchId, contentHash, answers, currentIndex, baseRevision } = input;
  if (typeof reviewBatchId !== "string" || !/^rb_[a-zA-Z0-9_-]{1,200}$/.test(reviewBatchId)) invalid("reviewBatchId required");
  if (typeof contentHash !== "string" || !contentHash.trim()) invalid("contentHash required");
  if (typeof baseRevision !== "number" || !Number.isInteger(baseRevision) || baseRevision < 0) invalid("baseRevision required");
  const ci = typeof currentIndex === "number" && Number.isInteger(currentIndex) && currentIndex >= 0 ? currentIndex : 0;
  return database(() => prisma.$transaction(async tx => {
    const ready = await lockPaper(tx, userId, paperId);
    if (!ready.ready) throw new PrivateReviewProgressStoreError("NOT_READY", "paper is not ready", { reason: ready.reason });
    const row = await tx.privateReviewProgress.findUnique({ where: key(userId, paperId) });
    if (!row) throw new PrivateReviewProgressStoreError("NOT_FOUND", "no review batch in progress");
    if (row.revision !== baseRevision) throw new PrivateReviewProgressStoreError("CONFLICT", "revision conflict", { currentRevision: row.revision });
    if (row.reviewBatchId !== reviewBatchId) throw new PrivateReviewProgressStoreError("BATCH_MISMATCH", "batch id mismatch");
    if (row.contentHash !== contentHash || row.contentHash !== ready.contentHash) throw new PrivateReviewProgressStoreError("CONTENT_CHANGED", "content version changed");
    if (row.submitted) throw new PrivateReviewProgressStoreError("CONFLICT", "batch already submitted");
    const ids = Array.isArray(row.questionIds) ? row.questionIds.filter((x): x is string => typeof x === "string") : [];
    const cleanAnswers = sanitizeAnswers(answers, ids);
    const updated = await tx.privateReviewProgress.update({ where: key(userId, paperId), data: { answers: cleanAnswers, currentIndex: Math.min(ci, Math.max(0, ids.length - 1)), revision: { increment: 1 } } });
    return { revision: updated.revision, updatedAt: updated.updatedAt.toISOString() };
  }));
}

/** Submit and grade the review batch. Server grades, persists result. CAS revision check. */
export async function submitPrivateReviewProgress(userId: string, paperId: string, input: unknown): Promise<PrivateReviewProgressView> {
  identity(userId, paperId);
  if (!record(input)) invalid("request object required");
  const { reviewBatchId, contentHash, answers, baseRevision } = input;
  if (typeof reviewBatchId !== "string" || !/^rb_[a-zA-Z0-9_-]{1,200}$/.test(reviewBatchId)) invalid("reviewBatchId required");
  if (typeof contentHash !== "string" || !contentHash.trim()) invalid("contentHash required");
  if (typeof baseRevision !== "number" || !Number.isInteger(baseRevision) || baseRevision < 0) invalid("baseRevision required");

  return database(async () => {
    // Read current row outside write transaction to get questionIds for grading
    const preRow = await prisma.privateReviewProgress.findUnique({ where: key(userId, paperId) });
    if (!preRow) throw new PrivateReviewProgressStoreError("NOT_FOUND", "no review batch in progress");
    if (preRow.revision !== baseRevision) throw new PrivateReviewProgressStoreError("CONFLICT", "revision conflict", { currentRevision: preRow.revision });
    if (preRow.reviewBatchId !== reviewBatchId) throw new PrivateReviewProgressStoreError("BATCH_MISMATCH", "batch id mismatch");
    if (preRow.contentHash !== contentHash) throw new PrivateReviewProgressStoreError("CONTENT_CHANGED", "content version changed");
    if (preRow.submitted) throw new PrivateReviewProgressStoreError("CONFLICT", "batch already submitted");
    const ids = Array.isArray(preRow.questionIds) ? preRow.questionIds.filter((x): x is string => typeof x === "string") : [];
    const cleanAnswers = sanitizeAnswers(answers, ids);

    // gradeReviewItems runs in its own read transaction; call outside write transaction to avoid nested deadlock.
    const graded = await gradeReviewItems(userId, paperId, contentHash, cleanAnswers as Record<string, unknown>);
    const result = { results: graded.results, total: graded.total, correct: graded.correct, unanswered: graded.unanswered };

    return prisma.$transaction(async tx => {
      const ready = await lockPaper(tx, userId, paperId);
      if (!ready.ready) throw new PrivateReviewProgressStoreError("NOT_READY", "paper is not ready", { reason: ready.reason });
      // Re-check CAS inside transaction to prevent race
      const row = await tx.privateReviewProgress.findUnique({ where: key(userId, paperId) });
      if (!row || row.revision !== baseRevision) throw new PrivateReviewProgressStoreError("CONFLICT", "revision conflict", { currentRevision: row?.revision });
      if (row.contentHash !== ready.contentHash) throw new PrivateReviewProgressStoreError("CONTENT_CHANGED", "content version changed");
      if (row.submitted) throw new PrivateReviewProgressStoreError("CONFLICT", "batch already submitted");
      const updated = await tx.privateReviewProgress.update({ where: key(userId, paperId), data: { answers: cleanAnswers, submitted: true, result, revision: { increment: 1 } } });
      return buildView(updated, ready.questions);
    });
  });
}
