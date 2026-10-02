/** Owner-scoped wrong questions. Writes run inside the locked progress transaction. */
import { Prisma, type PrivateWrongItem } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { checkPrivatePaperReadiness, type PrivateFlatQuestion } from "@/lib/private-papers/readiness";

export type PrivateWrongItemStatus = "active" | "content_changed" | "paper_deleted";
export interface PrivateWrongItemView {
  id: string; paperId: string; contentHash: string; questionId: string; attemptId: string;
  userAnswer: string | null; correctAnswer: string; wrongCount: number; status: PrivateWrongItemStatus;
  firstSeenAt: string; lastSeenAt: string; paperTitle?: string;
  question?: { prompt: string; options: Array<{ id: string; text: string }>; shortExplanation?: string; detailedExplanation?: string; passage?: string };
}
export class PrivateWrongItemStoreError extends Error {
  constructor(public code: "NOT_FOUND" | "VALIDATION_ERROR" | "INTERNAL_ERROR", message: string) { super(message); this.name = "PrivateWrongItemStoreError"; }
}
function identity(userId: string, paperId?: string) {
  if (!userId?.trim()) throw new PrivateWrongItemStoreError("NOT_FOUND", "user not found");
  if (paperId !== undefined && (!/^private:[^:@\s]+:[^:\x00-\x1f\x7f]+$/u.test(paperId) || paperId.length > 400)) throw new PrivateWrongItemStoreError("NOT_FOUND", "paper not found");
}
async function database<T>(operation: () => Promise<T>): Promise<T> {
  try { return await operation(); } catch (error) {
    if (error instanceof PrivateWrongItemStoreError) throw error;
    throw new PrivateWrongItemStoreError("INTERNAL_ERROR", "private wrong item storage unavailable");
  }
}
export async function recordWrongItems(tx: Prisma.TransactionClient, userId: string, paperId: string, contentHash: string, attemptId: string, questions: PrivateFlatQuestion[], answers: Record<string, string>): Promise<{ recorded: number; updated: number }> {
  let recorded = 0, updated = 0;
  for (const q of questions) {
    const userAnswer = answers[q.index] ?? null;
    if (userAnswer === q.answerId) continue;
    const existing = await tx.privateWrongItem.findUnique({ where: { userId_paperId_contentHash_questionId: { userId, paperId, contentHash, questionId: q.questionId } } });
    if (existing) {
      if (existing.attemptId === attemptId) continue;
      await tx.privateWrongItem.update({ where: { id: existing.id }, data: { attemptId, userAnswer, correctAnswer: q.answerId, wrongCount: { increment: 1 }, status: "active", lastSeenAt: new Date() } });
      updated++;
    } else {
      await tx.privateWrongItem.create({ data: { userId, paperId, contentHash, questionId: q.questionId, attemptId, userAnswer, correctAnswer: q.answerId, wrongCount: 1, status: "active" } });
      recorded++;
    }
  }
  return { recorded, updated };
}
export async function markWrongItemsContentChanged(tx: Prisma.TransactionClient, userId: string, paperId: string): Promise<number> {
  return (await tx.privateWrongItem.updateMany({ where: { userId, paperId, status: "active" }, data: { status: "content_changed" } })).count;
}
export async function deleteWrongItemsForPaper(tx: Prisma.TransactionClient, userId: string, paperId: string): Promise<number> {
  return (await tx.privateWrongItem.deleteMany({ where: { userId, paperId } })).count;
}
type Paper = { title: string; content: Prisma.JsonValue };
function enrich(item: PrivateWrongItem, paper: Paper): PrivateWrongItemView {
  const ready = checkPrivatePaperReadiness(paper.content as Record<string, unknown>);
  const q = item.status === "active" && ready.ready && ready.contentHash === item.contentHash ? ready.questions.find(q => q.questionId === item.questionId) : undefined;
  return {
    id: item.id, paperId: item.paperId, contentHash: item.contentHash, questionId: item.questionId, attemptId: item.attemptId,
    userAnswer: item.userAnswer, correctAnswer: item.correctAnswer, wrongCount: item.wrongCount,
    status: q ? "active" : "content_changed", firstSeenAt: item.firstSeenAt.toISOString(), lastSeenAt: item.lastSeenAt.toISOString(), paperTitle: paper.title,
    ...(q ? { question: { prompt: q.prompt, options: q.options.map(o => ({ id: o.id, text: o.text })), shortExplanation: q.shortExplanation, detailedExplanation: q.detailedExplanation, passage: q.passage } } : {}),
  };
}
/** Shared read lock keeps content, validity and wrong records in one snapshot. */
async function paperForRead(tx: Prisma.TransactionClient, userId: string, paperId: string): Promise<Paper> {
  const papers = await tx.$queryRaw<Paper[]>(Prisma.sql`SELECT "title", "content" FROM "PrivatePaper" WHERE "userId" = ${userId} AND "paperId" = ${paperId} FOR SHARE`);
  if (!papers[0]) throw new PrivateWrongItemStoreError("NOT_FOUND", "paper not found");
  return papers[0];
}
export interface PrivateReviewQuestion {
  questionId: string;
  prompt: string;
  options: Array<{ id: string; text: string }>;
  passage?: string;
}
export interface PrivateReviewBatch {
  reviewBatchId: string;
  contentHash: string;
  questions: PrivateReviewQuestion[];
}
/** Select at most `limit` active wrong items whose content version is still valid.
 *  Deterministic order: lastSeenAt desc, then id asc. Returns questions without answers. */
export async function selectReviewItems(userId: string, paperId: string, limit = 5): Promise<PrivateReviewBatch> {
  identity(userId, paperId);
  if (!Number.isInteger(limit) || limit < 1 || limit > 20) throw new PrivateWrongItemStoreError("VALIDATION_ERROR", "invalid review limit");
  return database(() => prisma.$transaction(async tx => {
    const paper = await paperForRead(tx, userId, paperId);
    const ready = checkPrivatePaperReadiness(paper.content as Record<string, unknown>);
    if (!ready.ready) throw new PrivateWrongItemStoreError("VALIDATION_ERROR", "paper content is not ready for review");
    const items = await tx.privateWrongItem.findMany({
      where: { userId, paperId, contentHash: ready.contentHash, status: "active" },
      orderBy: [{ lastSeenAt: "desc" }, { questionId: "asc" }],
      take: limit,
    });
    const byQ = new Map(ready.questions.map(q => [q.questionId, q]));
    const questions: PrivateReviewQuestion[] = [];
    for (const item of items) {
      const q = byQ.get(item.questionId);
      if (!q) continue;
      questions.push({
        questionId: q.questionId,
        prompt: q.prompt,
        options: q.options.map(o => ({ id: o.id, text: o.text })),
        ...(q.passage ? { passage: q.passage } : {}),
      });
    }
    if (questions.length === 0) throw new PrivateWrongItemStoreError("VALIDATION_ERROR", "no valid wrong items for review");
    return { reviewBatchId: `rb_${ready.contentHash.slice(0, 12)}_${Date.now().toString(36)}`, contentHash: ready.contentHash, questions };
  }));
}
/** Read-only grading: validates owner, paper, contentHash, question membership, then scores.
 *  Does NOT modify wrongCount, progress, XP, or any other state. */
export interface PrivateReviewGradeResult {
  contentHash: string;
  total: number;
  correct: number;
  unanswered: number;
  results: Array<{ questionId: string; userAnswer: string | null; correctAnswer: string; isCorrect: boolean; shortExplanation?: string; detailedExplanation?: string; prompt: string; options: Array<{ id: string; text: string }>; passage?: string }>;
}
export async function gradeReviewItems(
  userId: string,
  paperId: string,
  contentHash: string,
  answers: Record<string, string>,
): Promise<PrivateReviewGradeResult> {
  identity(userId, paperId);
  if (!contentHash?.trim() || contentHash.length > 200) throw new PrivateWrongItemStoreError("VALIDATION_ERROR", "invalid contentHash");
  if (typeof answers !== "object" || answers === null || Array.isArray(answers)) throw new PrivateWrongItemStoreError("VALIDATION_ERROR", "invalid answers");
  const questionIds = Object.keys(answers);
  if (questionIds.length === 0) throw new PrivateWrongItemStoreError("VALIDATION_ERROR", "no answers provided");
  if (questionIds.length > 5) throw new PrivateWrongItemStoreError("VALIDATION_ERROR", "too many questions in review batch");
  const uniqueIds = [...new Set(questionIds)];
  if (uniqueIds.length !== questionIds.length) throw new PrivateWrongItemStoreError("VALIDATION_ERROR", "duplicate questionIds in review batch");
  return database(() => prisma.$transaction(async tx => {
    const paper = await paperForRead(tx, userId, paperId);
    const ready = checkPrivatePaperReadiness(paper.content as Record<string, unknown>);
    if (!ready.ready || ready.contentHash !== contentHash) throw new PrivateWrongItemStoreError("VALIDATION_ERROR", "content version mismatch or paper no longer ready");
    const items = await tx.privateWrongItem.findMany({
      where: { userId, paperId, contentHash, status: "active", questionId: { in: uniqueIds } },
      select: { questionId: true },
    });
    const validIds = new Set(items.map(i => i.questionId));
    const byQ = new Map(ready.questions.map(q => [q.questionId, q]));
    const results: PrivateReviewGradeResult["results"] = [];
    let correct = 0, unanswered = 0;
    for (const qid of uniqueIds) {
      if (!validIds.has(qid)) throw new PrivateWrongItemStoreError("VALIDATION_ERROR", `question ${qid} is not a valid active wrong item`);
      const q = byQ.get(qid);
      if (!q) throw new PrivateWrongItemStoreError("VALIDATION_ERROR", `question ${qid} not found in current content`);
      const raw = answers[qid];
      const userAnswer = raw === "" || raw === null || raw === undefined ? null : String(raw);
      const isCorrect = userAnswer !== null && userAnswer === q.answerId;
      if (isCorrect) correct++;
      if (userAnswer === null) unanswered++;
      results.push({
        questionId: qid,
        userAnswer,
        correctAnswer: q.answerId,
        isCorrect,
        prompt: q.prompt,
        options: q.options.map(o => ({ id: o.id, text: o.text })),
        ...(q.passage ? { passage: q.passage } : {}),
        ...(q.shortExplanation ? { shortExplanation: q.shortExplanation } : {}),
        ...(q.detailedExplanation ? { detailedExplanation: q.detailedExplanation } : {}),
      });
    }
    return { contentHash, total: results.length, correct, unanswered, results };
  }));
}
export async function listPrivateWrongItems(userId: string, paperId: string): Promise<PrivateWrongItemView[]> {
  identity(userId, paperId);
  return database(() => prisma.$transaction(async tx => {
    const paper = await paperForRead(tx, userId, paperId);
    const items = await tx.privateWrongItem.findMany({ where: { userId, paperId, status: { in: ["active", "content_changed"] } }, orderBy: [{ lastSeenAt: "desc" }, { id: "asc" }] });
    return items.map(item => enrich(item, paper));
  }));
}
export async function getPrivateWrongItem(userId: string, wrongItemId: string): Promise<PrivateWrongItemView> {
  identity(userId);
  if (!wrongItemId?.trim() || wrongItemId.length > 200) throw new PrivateWrongItemStoreError("NOT_FOUND", "wrong item not found");
  return database(() => prisma.$transaction(async tx => {
    const item = await tx.privateWrongItem.findFirst({ where: { id: wrongItemId, userId } });
    if (!item) throw new PrivateWrongItemStoreError("NOT_FOUND", "wrong item not found");
    const paper = await paperForRead(tx, userId, item.paperId);
    const current = await tx.privateWrongItem.findFirst({ where: { id: wrongItemId, userId } });
    if (!current) throw new PrivateWrongItemStoreError("NOT_FOUND", "wrong item not found");
    return enrich(current, paper);
  }));
}
export async function getPrivateWrongItemByQuestionId(userId: string, paperId: string, questionId: string, contentHash?: string): Promise<PrivateWrongItemView> {
  identity(userId, paperId);
  if (!questionId?.trim() || questionId.length > 200) throw new PrivateWrongItemStoreError("NOT_FOUND", "wrong item not found");
  const items = await listPrivateWrongItems(userId, paperId);
  const matches = items.filter(item => item.questionId === questionId && (!contentHash || item.contentHash === contentHash));
  const item = matches.find(item => item.status === "active") ?? matches[0];
  if (!item) throw new PrivateWrongItemStoreError("NOT_FOUND", "wrong item not found");
  return item;
}
export async function listAllPrivateWrongItems(userId: string, paperId?: string): Promise<PrivateWrongItemView[]> {
  identity(userId, paperId);
  if (paperId) return listPrivateWrongItems(userId, paperId);
  return database(() => prisma.$transaction(async tx => {
    const papers = await tx.$queryRaw<Array<Paper & { paperId: string }>>(Prisma.sql`SELECT "paperId", "title", "content" FROM "PrivatePaper" WHERE "userId" = ${userId} ORDER BY "paperId" FOR SHARE`);
    const byId = new Map(papers.map(paper => [paper.paperId, paper]));
    const items = await tx.privateWrongItem.findMany({ where: { userId, paperId: { in: [...byId.keys()] }, status: { in: ["active", "content_changed"] } }, orderBy: [{ lastSeenAt: "desc" }, { id: "asc" }] });
    return items.map(item => enrich(item, byId.get(item.paperId)!));
  }));
}
