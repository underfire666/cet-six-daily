/** Owner-scoped PRIVATE progress. Paper row locks serialize writes and deletion. */
import { Prisma } from "@prisma/client";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import { checkPrivatePaperReadiness, type PrivateFlatQuestion } from "@/lib/private-papers/readiness";
import { recordWrongItems } from "@/content/private-wrong-item-store";

export type PrivatePaperProgressErrorCode = "NOT_FOUND" | "VALIDATION_ERROR" | "CONFLICT" | "NOT_READY" | "CONTENT_CHANGED" | "INTERNAL_ERROR";
export interface PrivatePaperProgressConflictInfo {
  conflictType?: "revision_conflict" | "attempt_mismatch" | "submission_conflict";
  currentRevision?: number;
  currentAttemptId?: string;
  serverProgress?: unknown;
  reason?: string;
  details?: string[];
}
export class PrivatePaperProgressStoreError extends Error {
  constructor(public code: PrivatePaperProgressErrorCode, message: string, public extra?: PrivatePaperProgressConflictInfo) { super(message); this.name = "PrivatePaperProgressStoreError"; }
}
export interface PrivatePaperProgressView {
  progressVersion: number; paperId: string; attemptId: string; contentHash: string;
  answers: Record<string, string>; currentIndex: number; submitted: boolean; revision: number; updatedAt: string; wrongItemsCount?: number;
}
export interface PutPrivatePaperProgressResult { revision: number; updatedAt: string; wrongItemsRecorded: number; wrongItemsCount: number; }
export interface PrivateProgressSnapshot { progress: PrivatePaperProgressView | null; revision: number; invalidated: boolean; }
const key = (userId: string, paperId: string) => ({ userId_paperId: { userId, paperId } });
const record = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
function invalid(message: string): never { throw new PrivatePaperProgressStoreError("VALIDATION_ERROR", message); }
function identity(userId: string, paperId: string) {
  if (!userId?.trim() || !/^private:[^:@\s]+:[^:\x00-\x1f\x7f]+$/u.test(paperId) || paperId.length > 400) throw new PrivatePaperProgressStoreError("NOT_FOUND", "paper not found");
}
async function database<T>(operation: () => Promise<T>): Promise<T> {
  try { return await operation(); } catch (error) {
    if (error instanceof PrivatePaperProgressStoreError) throw error;
    throw new PrivatePaperProgressStoreError("INTERNAL_ERROR", "private paper progress storage unavailable");
  }
}
async function lockPaper(tx: Prisma.TransactionClient, userId: string, paperId: string) {
  const papers = await tx.$queryRaw<Array<{ content: Prisma.JsonValue }>>(Prisma.sql`SELECT "content" FROM "PrivatePaper" WHERE "userId" = ${userId} AND "paperId" = ${paperId} FOR UPDATE`);
  if (!papers[0] || !record(papers[0].content)) throw new PrivatePaperProgressStoreError("NOT_FOUND", "paper not found");
  return checkPrivatePaperReadiness(papers[0].content);
}
function answersFor(raw: unknown, questions: PrivateFlatQuestion[], strict: boolean): Record<string, string> {
  if (!record(raw)) { if (strict) invalid("answers must be an object"); return {}; }
  const clean: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (!/^(0|[1-9][0-9]*)$/.test(k) || !Number.isSafeInteger(Number(k))) { if (strict) invalid("invalid answer index"); continue; }
    const q = questions[Number(k)];
    if (!q) continue;
    if (typeof v !== "string" || !q.options.some(o => o.id === v)) { if (strict) invalid("invalid optionId"); continue; }
    clean[k] = v;
  }
  return clean;
}
function view(row: { paperId: string; progressVersion: number; attemptId: string; contentHash: string; answers: Prisma.JsonValue; currentIndex: number; submitted: boolean; revision: number; updatedAt: Date }, questions: PrivateFlatQuestion[]): PrivatePaperProgressView {
  return { paperId: row.paperId, attemptId: row.attemptId, contentHash: row.contentHash, progressVersion: row.progressVersion, revision: row.revision, submitted: row.submitted, answers: answersFor(row.answers, questions, false), currentIndex: Math.max(0, Math.min(row.currentIndex, questions.length - 1)), updatedAt: row.updatedAt.toISOString() };
}
/** Read-only hydration: never write sanitized old answers back over a newer update. */
export async function readPrivateProgressSnapshot(userId: string, paperId: string): Promise<PrivateProgressSnapshot> {
  identity(userId, paperId);
  return database(() => prisma.$transaction(async tx => {
    const ready = await lockPaper(tx, userId, paperId);
    if (!ready.ready) throw new PrivatePaperProgressStoreError("NOT_READY", "paper is not ready", { reason: ready.reason });
    const row = await tx.privatePaperProgress.findUnique({ where: key(userId, paperId) });
    if (!row) return { progress: null, revision: 0, invalidated: false };
    const invalidated = row.contentHash !== ready.contentHash || row.progressVersion !== 1;
    const wrongItemsCount = row.submitted && !invalidated ? await tx.privateWrongItem.count({ where: { userId, paperId, contentHash: row.contentHash, attemptId: row.attemptId } }) : 0;
    return { progress: invalidated ? null : { ...view(row, ready.questions), wrongItemsCount }, revision: row.revision, invalidated };
  }));
}
export async function getPrivatePaperProgress(userId: string, paperId: string) { return (await readPrivateProgressSnapshot(userId, paperId)).progress; }

export async function putPrivatePaperProgress(userId: string, paperId: string, input: unknown): Promise<PutPrivatePaperProgressResult> {
  identity(userId, paperId);
  if (!record(input)) invalid("request object required");
  const { attemptId, mutationId, contentHash, currentIndex, submitted, baseRevision } = input;
  const mode = input.mode ?? "save";
  if (input.progressVersion !== 1) invalid("progressVersion=1 required");
  if (typeof attemptId !== "string" || !attemptId.trim() || attemptId.length > 200) invalid("attemptId required");
  if (typeof mutationId !== "string" || !mutationId.trim() || mutationId.length > 200) invalid("mutationId required");
  if (typeof contentHash !== "string" || !contentHash) invalid("contentHash required");
  if (!Number.isSafeInteger(currentIndex)) invalid("currentIndex must be a safe integer");
  if (typeof submitted !== "boolean") invalid("submitted must be boolean");
  if (!Number.isSafeInteger(baseRevision) || Number(baseRevision) < 0) invalid("baseRevision required");
  if (mode !== "save" && mode !== "restart") invalid("invalid mode");
  return database(() => prisma.$transaction(async tx => {
    const readiness = await lockPaper(tx, userId, paperId);
    if (!readiness.ready) throw new PrivatePaperProgressStoreError("NOT_READY", "paper is not ready", { reason: readiness.reason });
    if (contentHash !== readiness.contentHash) throw new PrivatePaperProgressStoreError("CONTENT_CHANGED", "content changed");
    const answers = answersFor(input.answers, readiness.questions, true);
    const index = Math.max(0, Math.min(Number(currentIndex), readiness.questions.length - 1));
    const canonical = JSON.stringify({ paperId, mode, attemptId, contentHash, answers, currentIndex: index, submitted, baseRevision, progressVersion: 1 });
    const receipt = await tx.syncMutation.findUnique({ where: { userId_mutationId: { userId, mutationId: String(mutationId) } } });
    if (receipt) {
      if (receipt.entityType !== "privateProgress" || receipt.entityId !== paperId || !record(receipt.payload) || receipt.payload.request !== canonical || !record(receipt.payload.result)) invalid("mutationId reused with different request");
      return { revision: Number(receipt.payload.result.revision), updatedAt: String(receipt.payload.result.updatedAt), wrongItemsRecorded: Number(receipt.payload.result.wrongItemsRecorded ?? 0), wrongItemsCount: Number(receipt.payload.result.wrongItemsCount ?? 0) };
    }
    const existing = await tx.privatePaperProgress.findUnique({ where: key(userId, paperId) });
    const acceptedWrongCount = existing?.submitted ? await tx.privateWrongItem.count({ where: { userId, paperId, contentHash: existing.contentHash, attemptId: existing.attemptId } }) : 0;
    const conflict = (kind: "revision_conflict" | "attempt_mismatch" | "submission_conflict"): never => {
      throw new PrivatePaperProgressStoreError("CONFLICT", "progress conflict", { conflictType: kind, currentRevision: existing?.revision ?? 0, currentAttemptId: existing?.attemptId, serverProgress: existing && existing.contentHash === contentHash ? { ...view(existing, readiness.questions), wrongItemsCount: acceptedWrongCount } : null });
    };
    if ((existing?.revision ?? 0) !== baseRevision) conflict("revision_conflict");
    if (existing && mode === "save" && (existing.attemptId !== attemptId || existing.contentHash !== contentHash || existing.progressVersion !== 1)) conflict("attempt_mismatch");
    if (existing && mode === "restart" && existing.attemptId === attemptId) invalid("restart requires a new attemptId");
    // A submitted round is immutable. Navigation and identical snapshots may still sync.
    if (existing?.submitted && existing.attemptId === attemptId) {
      const accepted = answersFor(existing.answers, readiness.questions, false);
      const sameAnswers = Object.keys(accepted).length === Object.keys(answers).length && Object.entries(accepted).every(([k, v]) => answers[k] === v);
      if (!submitted || !sameAnswers) conflict("submission_conflict");
    }
    const submissionId = "private-wrong-submission:" + createHash("sha256").update(JSON.stringify([paperId, attemptId])).digest("hex");
    const priorSubmission = await tx.syncMutation.findUnique({ where: { userId_mutationId: { userId, mutationId: submissionId } } });
    if (priorSubmission && existing?.attemptId !== attemptId) invalid("submitted attemptId cannot be reused");
    const data = { attemptId: String(attemptId), contentHash: String(contentHash), answers: answers as Prisma.InputJsonObject, currentIndex: index, submitted: Boolean(submitted), progressVersion: 1, revision: Number(baseRevision) + 1 };
    const saved = existing
      ? await tx.privatePaperProgress.update({ where: key(userId, paperId), data })
      : await tx.privatePaperProgress.create({ data: { userId, paperId, ...data } });
    // Record wrong items inside the SAME transaction — only on first submission for this attempt.
    // Same attemptId re-submit / mutationId retry does not re-record or increment.
    let wrongItemsRecorded = 0;
    const isFirstSubmissionForAttempt = Boolean(submitted) && (!existing?.submitted || existing.attemptId !== attemptId);
    if (isFirstSubmissionForAttempt) {
      if (priorSubmission) invalid("submitted attemptId cannot be reopened");
      const wr = await recordWrongItems(tx, userId, paperId, String(contentHash), String(attemptId), readiness.questions, answers);
      wrongItemsRecorded = wr.recorded + wr.updated;
      await tx.syncMutation.create({ data: { userId, mutationId: submissionId, entityType: "privateWrongSubmission", entityId: paperId, operation: "upsert", payload: { attemptId, contentHash }, status: "applied" } });
    }
    const wrongItemsCount = submitted ? await tx.privateWrongItem.count({ where: { userId, paperId, contentHash: String(contentHash), attemptId: String(attemptId) } }) : 0;
    const result = { revision: saved.revision, updatedAt: saved.updatedAt.toISOString(), wrongItemsRecorded, wrongItemsCount };
    await tx.syncMutation.create({ data: { userId, mutationId: String(mutationId), entityType: "privateProgress", entityId: paperId, operation: "upsert", payload: { request: canonical, result }, status: "applied" } });
    return result;
  }));
}
