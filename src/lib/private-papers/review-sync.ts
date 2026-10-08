import { validatePrivateReviewSession, sameReviewQuestion, type PrivateReviewSession } from "./review";

const record = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === "object" && !Array.isArray(v);
const revision = (v: unknown): v is number => Number.isSafeInteger(v) && Number(v) >= 0 && Number(v) < 2147483647;
export interface ReviewSnapshot { progress: PrivateReviewSession | null; revision: number; invalidated: boolean }

/** Validate every server read before restoring or touching browser storage. */
export function parseReviewSnapshot(raw: unknown, ownerId: string, paperId: string): ReviewSnapshot {
  if (!record(raw) || raw.ownerId !== ownerId || raw.paperId !== paperId || !revision(raw.revision) || typeof raw.invalidated !== "boolean") throw new Error("复习进度响应异常，请重新检查。");
  if (raw.progress === null) {
    if (!raw.invalidated && raw.revision !== 0) throw new Error("复习进度版本异常。");
    return { progress: null, revision: raw.revision, invalidated: raw.invalidated };
  }
  const p = raw.progress;
  if (raw.invalidated || !record(p) || p.paperId !== paperId || p.revision !== raw.revision || !revision(p.revision) || p.revision < 1 || typeof p.updatedAt !== "string") throw new Error("复习批次响应异常。");
  const session = validatePrivateReviewSession({
    version: 1, ownerId, paperId, reviewBatchId: p.reviewBatchId, contentHash: p.contentHash,
    questions: p.questions, answers: p.answers, currentIndex: p.currentIndex, submitted: p.submitted,
    ...(p.submitted ? { result: p.result, submittedAt: p.updatedAt } : {}),
    updatedAt: p.updatedAt, syncRevision: p.revision, syncDirty: false,
  }, ownerId, paperId);
  if (!session) throw new Error("复习进度或结果数据异常。");
  return { progress: session, revision: raw.revision, invalidated: false };
}
export function parseReviewMutation(raw: unknown, ownerId: string, paperId: string): PrivateReviewSession {
  if (!record(raw)) throw new Error("复习响应异常。");
  const snapshot = parseReviewSnapshot({ ownerId: raw.ownerId, paperId: raw.paperId, progress: raw, revision: raw.revision, invalidated: false }, ownerId, paperId);
  return snapshot.progress!;
}
export function sameReviewWork(a: PrivateReviewSession, b: PrivateReviewSession): boolean {
  return a.reviewBatchId === b.reviewBatchId && a.contentHash === b.contentHash && a.submitted === b.submitted && a.currentIndex === b.currentIndex &&
    a.questions.length === b.questions.length && a.questions.every((q, i) => sameReviewQuestion(q, b.questions[i]) && a.answers[q.questionId] === b.answers[q.questionId]);
}
/** Legacy local-only drafts are conservatively preserved when they differ from cloud. */
export function reconcileReview(local: PrivateReviewSession | null, cloud: ReviewSnapshot): "cloud" | "local" | "conflict" | "invalid" {
  if (cloud.invalidated) return "invalid";
  if (!local) return "cloud";
  const dirty = local.syncDirty === true || local.syncRevision === undefined;
  if (!dirty) return "cloud";
  if (cloud.progress && sameReviewWork(local, cloud.progress)) return "cloud";
  if (cloud.progress && !cloud.progress.submitted && cloud.progress.reviewBatchId === local.reviewBatchId && cloud.progress.contentHash === local.contentHash && local.syncRevision === cloud.revision) return "local";
  return "conflict";
}
