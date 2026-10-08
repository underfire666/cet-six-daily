/** Owner-scoped PRIVATE review progress. A locked transaction owns each operation. */
import { Prisma, type PrivateReviewProgress } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import { checkPrivatePaperReadiness, type PrivateFlatQuestion } from "@/lib/private-papers/readiness";
import { parsePrivateReviewGrade, sameReviewQuestion } from "@/lib/private-papers/review";
import { selectReviewItemsInTransaction, gradeReviewItemsInTransaction, PrivateWrongItemStoreError, type PrivateReviewQuestion, type PrivateReviewGradeResult } from "@/content/private-wrong-item-store";

export type PrivateReviewProgressErrorCode = "NOT_FOUND" | "VALIDATION_ERROR" | "CONFLICT" | "NOT_READY" | "CONTENT_CHANGED" | "BATCH_MISMATCH" | "INTERNAL_ERROR";
export class PrivateReviewProgressStoreError extends Error {
  constructor(public code: PrivateReviewProgressErrorCode, message: string, public extra?: Record<string, unknown>) { super(message); this.name = "PrivateReviewProgressStoreError"; }
}
export type PrivateReviewQuestionView = PrivateReviewQuestion;
export interface PrivateReviewProgressView {
  paperId: string; reviewBatchId: string; contentHash: string; questions: PrivateReviewQuestionView[];
  answers: Record<string, string | null>; currentIndex: number; submitted: boolean;
  result?: PrivateReviewGradeResult; revision: number; updatedAt: string;
}
export interface PrivateReviewProgressSnapshot {
  progress: PrivateReviewProgressView | null; revision: number; invalidated: boolean; invalidReason?: string;
}
const key = (userId: string, paperId: string) => ({ userId_paperId: { userId, paperId } });
const record = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const validRevision = (v: unknown): v is number => Number.isSafeInteger(v) && Number(v) >= 0 && Number(v) < 2147483647;
function invalid(message: string): never { throw new PrivateReviewProgressStoreError("VALIDATION_ERROR", message); }
function identity(userId: string, paperId: string) {
  if (!userId?.trim() || !/^private:[^:@\s]+:[^:\x00-\x1f\x7f]+$/u.test(paperId) || paperId.length > 400) throw new PrivateReviewProgressStoreError("NOT_FOUND", "paper not found");
}
async function database<T>(operation: () => Promise<T>): Promise<T> {
  try { return await operation(); } catch (error) {
    if (error instanceof PrivateReviewProgressStoreError) throw error;
    if (error instanceof PrivateWrongItemStoreError) {
      const map: Record<string, PrivateReviewProgressErrorCode> = { NOT_FOUND: "NOT_FOUND", VALIDATION_ERROR: "VALIDATION_ERROR", CONFLICT: "CONFLICT", INTERNAL_ERROR: "INTERNAL_ERROR" };
      throw new PrivateReviewProgressStoreError(map[error.code] ?? "INTERNAL_ERROR", error.message);
    }
    throw new PrivateReviewProgressStoreError("INTERNAL_ERROR", "private review progress storage unavailable");
  }
}
async function lockPaper(tx: Prisma.TransactionClient, userId: string, paperId: string) {
  const papers = await tx.$queryRaw<Array<{ content: Prisma.JsonValue }>>(Prisma.sql`SELECT "content" FROM "PrivatePaper" WHERE "userId" = ${userId} AND "paperId" = ${paperId} FOR UPDATE`);
  if (!papers[0] || !record(papers[0].content)) throw new PrivateReviewProgressStoreError("NOT_FOUND", "paper not found");
  const ready = checkPrivatePaperReadiness(papers[0].content);
  if (!ready.ready) throw new PrivateReviewProgressStoreError("NOT_READY", "paper is not ready", { reason: ready.reason });
  return ready;
}
function questionIds(raw: unknown): string[] {
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > 5 || !raw.every(id => typeof id === "string" && id.trim()) || new Set(raw).size !== raw.length) invalid("invalid batch questions");
  return raw as string[];
}
function answersFor(raw: unknown, questions: PrivateFlatQuestion[], complete = false): Record<string, string | null> {
  if (!record(raw)) invalid("answers object required");
  const ids = new Set(questions.map(q => q.questionId));
  if (Object.keys(raw).some(id => !ids.has(id)) || (complete && Object.keys(raw).length !== ids.size)) invalid("answers do not match batch");
  return Object.fromEntries(questions.map(q => {
    const value = Object.hasOwn(raw, q.questionId) ? raw[q.questionId] : null;
    if (value !== null && (typeof value !== "string" || !q.options.some(o => o.id === value))) invalid("invalid answer option");
    return [q.questionId, value as string | null];
  }));
}
function flatQuestions(ids: string[], questions: PrivateFlatQuestion[]) {
  return ids.map(id => {
    const q = questions.find(q => q.questionId === id);
    if (!q) throw new PrivateReviewProgressStoreError("CONTENT_CHANGED", "batch questions no longer valid");
    return q;
  });
}
function questionView(q: PrivateFlatQuestion): PrivateReviewQuestionView {
  return { questionId: q.questionId, prompt: q.prompt, options: q.options.map(o => ({ id: o.id, text: o.text })), ...(q.passage ? { passage: q.passage } : {}) };
}
function buildView(row: PrivateReviewProgress, questions: PrivateFlatQuestion[]): PrivateReviewProgressView {
  const qs = flatQuestions(questionIds(row.questionIds), questions);
  const answers = answersFor(row.answers, qs, true);
  if (!validRevision(row.revision) || row.revision < 1 || !Number.isSafeInteger(row.currentIndex) || row.currentIndex < 0 || row.currentIndex >= qs.length) invalid("invalid stored progress");
  const view: PrivateReviewProgressView = { paperId: row.paperId, reviewBatchId: row.reviewBatchId, contentHash: row.contentHash, questions: qs.map(questionView), answers, currentIndex: row.currentIndex, submitted: row.submitted, revision: row.revision, updatedAt: row.updatedAt.toISOString() };
  if (row.submitted) {
    if (!record(row.result)) invalid("invalid stored result");
    try {
      // Earlier rows omitted the hash inside result; bind it to the verified row hash.
      const result = parsePrivateReviewGrade({ ...row.result, contentHash: row.contentHash, ownerId: row.userId, paperId: row.paperId, reviewBatchId: row.reviewBatchId }, row.userId, row.paperId, row.contentHash, qs.map(q => q.questionId), row.reviewBatchId);
      if (!result.results.every((r,i) => r.userAnswer === answers[r.questionId] && sameReviewQuestion(r, questionView(qs[i])))) invalid("stored result answers mismatch");
      view.result = result;
    } catch { invalid("invalid stored result"); }
  }
  return view;
}
async function activeBatch(tx: Prisma.TransactionClient, userId: string, paperId: string, hash: string, ids: string[]) {
  const count = await tx.privateWrongItem.count({ where: { userId, paperId, contentHash: hash, questionId: { in: ids }, status: "active", removedAt: null } });
  if (count !== ids.length) throw new PrivateReviewProgressStoreError("CONTENT_CHANGED", "batch questions no longer active");
}
function requestInput(input: unknown) {
  if (!record(input)) invalid("request object required");
  if (typeof input.reviewBatchId !== "string" || !/^rb_[a-zA-Z0-9_-]{1,200}$/.test(input.reviewBatchId)) invalid("reviewBatchId required");
  if (typeof input.contentHash !== "string" || !input.contentHash.trim() || input.contentHash.length > 200) invalid("contentHash required");
  if (!validRevision(input.baseRevision)) invalid("baseRevision required");
  return { answers: input.answers, currentIndex: input.currentIndex, reviewBatchId: input.reviewBatchId, contentHash: input.contentHash, baseRevision: input.baseRevision };
}
function checkBatch(row: PrivateReviewProgress | null, input: ReturnType<typeof requestInput>, hash: string): asserts row is PrivateReviewProgress {
  if (!row) throw new PrivateReviewProgressStoreError("NOT_FOUND", "no review batch in progress");
  if (row.reviewBatchId !== input.reviewBatchId) throw new PrivateReviewProgressStoreError("BATCH_MISMATCH", "batch id mismatch");
  if (row.contentHash !== input.contentHash || row.contentHash !== hash) throw new PrivateReviewProgressStoreError("CONTENT_CHANGED", "content version changed");
}
function cas(row: PrivateReviewProgress, revision: number) {
  if (row.revision !== revision) throw new PrivateReviewProgressStoreError("CONFLICT", "revision conflict", { currentRevision: row.revision });
}
export async function readPrivateReviewProgressSnapshot(userId: string, paperId: string): Promise<PrivateReviewProgressSnapshot> {
  identity(userId, paperId);
  return database(() => prisma.$transaction(async tx => {
    const ready = await lockPaper(tx, userId, paperId);
    const row = await tx.privateReviewProgress.findUnique({ where: key(userId, paperId) });
    if (!row) return { progress: null, revision: 0, invalidated: false };
    if (row.contentHash !== ready.contentHash) return { progress: null, revision: row.revision, invalidated: true, invalidReason: "content version changed" };
    try {
      const ids = questionIds(row.questionIds);
      await activeBatch(tx, userId, paperId, row.contentHash, ids);
      return { progress: buildView(row, ready.questions), revision: row.revision, invalidated: false };
    } catch (e) {
      if (e instanceof PrivateReviewProgressStoreError && ["CONTENT_CHANGED", "VALIDATION_ERROR"].includes(e.code)) return { progress: null, revision: row.revision, invalidated: true, invalidReason: e.message };
      throw e;
    }
  }));
}
/** Explicit conflict recovery may open a new batch with the still-active local questions. */
export async function startPrivateReviewBatch(userId: string, paperId: string, limit: number, resume?: unknown): Promise<PrivateReviewProgressView> {
  identity(userId, paperId);
  if (!Number.isInteger(limit) || limit < 1 || limit > 5) invalid("limit must be 1-5");
  if (resume !== undefined && (!record(resume) || !validRevision(resume.baseRevision) || typeof resume.contentHash !== "string")) invalid("invalid resume request");
  const ids = record(resume) ? questionIds(resume.questionIds) : null;
  if (ids && ids.length > limit) invalid("invalid resume question count");
  return database(() => prisma.$transaction(async tx => {
    const ready = await lockPaper(tx, userId, paperId);
    const existing = await tx.privateReviewProgress.findUnique({ where: key(userId, paperId) });
    let selected: string[];
    if (ids && record(resume)) {
      if ((existing?.revision ?? 0) !== resume.baseRevision) throw new PrivateReviewProgressStoreError("CONFLICT", "revision conflict");
      if (resume.contentHash !== ready.contentHash) throw new PrivateReviewProgressStoreError("CONTENT_CHANGED", "content version changed");
      flatQuestions(ids, ready.questions);
      await activeBatch(tx, userId, paperId, ready.contentHash, ids);
      selected = ids;
    } else {
      const batch = await selectReviewItemsInTransaction(tx, userId, paperId, limit);
      selected = batch.questions.map(q => q.questionId);
    }
    const data = { reviewBatchId: `rb_${randomUUID()}`, contentHash: ready.contentHash, questionIds: selected, answers: Object.fromEntries(selected.map(id => [id, null])), currentIndex: 0, submitted: false, result: Prisma.JsonNull };
    const row = existing
      ? await tx.privateReviewProgress.update({ where: key(userId, paperId), data: { ...data, revision: { increment: 1 } } })
      : await tx.privateReviewProgress.create({ data: { ...data, userId, paperId, revision: 1 } });
    return buildView(row, ready.questions);
  }));
}
export async function savePrivateReviewProgress(userId: string, paperId: string, input: unknown): Promise<{ revision: number; updatedAt: string }> {
  identity(userId, paperId);
  const request = requestInput(input);
  if (!Number.isSafeInteger(request.currentIndex) || Number(request.currentIndex) < 0) invalid("currentIndex required");
  return database(() => prisma.$transaction(async tx => {
    const ready = await lockPaper(tx, userId, paperId);
    const row = await tx.privateReviewProgress.findUnique({ where: key(userId, paperId) });
    checkBatch(row, request, ready.contentHash);
    cas(row, request.baseRevision);
    if (row.submitted) throw new PrivateReviewProgressStoreError("CONFLICT", "batch already submitted");
    const ids = questionIds(row.questionIds), qs = flatQuestions(ids, ready.questions);
    await activeBatch(tx, userId, paperId, ready.contentHash, ids);
    if (Number(request.currentIndex) >= ids.length) invalid("currentIndex out of range");
    const answers = answersFor(request.answers, qs);
    const updated = await tx.privateReviewProgress.update({ where: key(userId, paperId), data: { answers, currentIndex: Number(request.currentIndex), revision: { increment: 1 } } });
    return { revision: updated.revision, updatedAt: updated.updatedAt.toISOString() };
  }));
}
export async function submitPrivateReviewProgress(userId: string, paperId: string, input: unknown): Promise<PrivateReviewProgressView> {
  identity(userId, paperId);
  const request = requestInput(input);
  return database(() => prisma.$transaction(async tx => {
    const ready = await lockPaper(tx, userId, paperId);
    const row = await tx.privateReviewProgress.findUnique({ where: key(userId, paperId) });
    checkBatch(row, request, ready.contentHash);
    const ids = questionIds(row.questionIds), qs = flatQuestions(ids, ready.questions);
    await activeBatch(tx, userId, paperId, ready.contentHash, ids);
    const answers = answersFor(request.answers, qs);
    if (row.submitted) {
      const view = buildView(row, ready.questions);
      if (ids.every(id => view.answers[id] === answers[id])) return view;
      throw new PrivateReviewProgressStoreError("CONFLICT", "batch already submitted");
    }
    cas(row, request.baseRevision);
    const result = await gradeReviewItemsInTransaction(tx, userId, paperId, ready.contentHash, answers);
    const updated = await tx.privateReviewProgress.update({ where: key(userId, paperId), data: { answers, submitted: true, result: result as unknown as Prisma.InputJsonValue, revision: { increment: 1 } } });
    return buildView(updated, ready.questions);
  }));
}
