/** V14 Phase 1D.3 — Private Wrongbook Manual Review: types, parsing, local storage. */
import type { PrivateReviewQuestion, PrivateReviewGradeResult } from "@/content/private-wrong-item-store";
export type { PrivateReviewQuestion, PrivateReviewGradeResult } from "@/content/private-wrong-item-store";

export const PRIVATE_REVIEW_STORAGE_VERSION = 1;
export const PRIVATE_REVIEW_MAX_QUESTIONS = 5;

export interface PrivateReviewStartResponse {
  ownerId: string;
  reviewBatchId: string;
  contentHash: string;
  questions: PrivateReviewQuestion[];
}

export interface PrivateReviewGradeResponse extends PrivateReviewGradeResult {
  ownerId: string;
  paperId?: string;
  reviewBatchId?: string;
}

export interface PrivateReviewSession {
  version: number;
  ownerId: string;
  paperId: string;
  reviewBatchId: string;
  contentHash: string;
  questions: PrivateReviewQuestion[];
  /** questionId -> selected option id (or null for unanswered) */
  answers: Record<string, string | null>;
  currentIndex: number;
  submitted: boolean;
  submittedAt?: string;
  result?: PrivateReviewGradeResult;
  updatedAt?: string;
}

const record = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === "object" && !Array.isArray(v);
const nonempty = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;
const timestamp = (v: unknown): v is string => typeof v === "string" && Number.isFinite(Date.parse(v));

function validateQuestion(q: unknown): q is PrivateReviewQuestion {
  if (!record(q)) return false;
  if (!nonempty(q.questionId) || !nonempty(q.prompt)) return false;
  if (!Array.isArray(q.options) || q.options.length < 2) return false;
  if (!q.options.every(o => record(o) && nonempty(o.id) && typeof o.text === "string")) return false;
  if (new Set(q.options.map(o => o.id)).size !== q.options.length) return false;
  if (q.passage !== undefined && typeof q.passage !== "string") return false;
  return true;
}

/** Fail closed on wrong-owner or malformed start response. */
export function parsePrivateReviewStart(raw: unknown, ownerId: string): PrivateReviewStartResponse {
  if (!record(raw) || raw.ownerId !== ownerId || !nonempty(raw.reviewBatchId) || !nonempty(raw.contentHash) || !Array.isArray(raw.questions)) {
    throw new Error("复习批次数据异常，请重试");
  }
  if (raw.questions.length === 0 || raw.questions.length > PRIVATE_REVIEW_MAX_QUESTIONS) {
    throw new Error("复习批次题目数量异常");
  }
  const seen = new Set<string>();
  for (const q of raw.questions) {
    if (!validateQuestion(q)) throw new Error("复习题目数据异常，请重试");
    if (seen.has(q.questionId)) throw new Error("复习批次存在重复题目");
    seen.add(q.questionId);
  }
  return { ownerId, reviewBatchId: raw.reviewBatchId, contentHash: raw.contentHash, questions: raw.questions as PrivateReviewQuestion[] };
}

/** Fail closed on wrong-owner or malformed grade response. */
export function parsePrivateReviewGrade(raw: unknown, ownerId: string, paperId: string, expectedContentHash: string, expectedQuestionIds: string[], expectedBatchId?: string): PrivateReviewGradeResponse {
  if (!record(raw) || raw.ownerId !== ownerId || typeof raw.contentHash !== "string" || raw.contentHash !== expectedContentHash) {
    throw new Error("复习判分数据异常，请重试");
  }
  if ((raw.paperId !== undefined && raw.paperId !== paperId) || (expectedBatchId !== undefined && (raw.paperId !== paperId || raw.reviewBatchId !== expectedBatchId))) throw new Error("复习判分批次不匹配");
  if (!Number.isSafeInteger(raw.total) || !Number.isSafeInteger(raw.correct) || !Number.isSafeInteger(raw.unanswered)) {
    throw new Error("复习判分数据异常，请重试");
  }
  const total = raw.total as number;
  const correct = raw.correct as number;
  const unanswered = raw.unanswered as number;
  if (total < 1 || total > PRIVATE_REVIEW_MAX_QUESTIONS || correct < 0 || unanswered < 0 || correct + unanswered > total) throw new Error("复习判分统计异常");
  if (!Array.isArray(raw.results) || raw.results.length !== raw.total || raw.results.length !== expectedQuestionIds.length) {
    throw new Error("复习判分结果数量不匹配");
  }
  const seen = new Set<string>();
  for (const [index, r] of raw.results.entries()) {
    if (!record(r) || typeof r.questionId !== "string" || typeof r.correctAnswer !== "string" || typeof r.isCorrect !== "boolean") throw new Error("复习判分数据异常，请重试");
    if (r.userAnswer !== null && typeof r.userAnswer !== "string") throw new Error("复习判分数据异常，请重试");
    if (!expectedQuestionIds.includes(r.questionId)) throw new Error("复习判分包含非本批次题目");
    if (seen.has(r.questionId)) throw new Error("复习判分存在重复题目");
    if (r.questionId !== expectedQuestionIds[index]) throw new Error("复习判分题目顺序不匹配");
    seen.add(r.questionId);
    if (!validateQuestion(r)) throw new Error("复习判分题目数据异常");
    if (!r.options.some(o => o.id === r.correctAnswer) || (r.userAnswer !== null && !r.options.some(o => o.id === r.userAnswer)) || r.isCorrect !== (r.userAnswer !== null && r.userAnswer === r.correctAnswer)) throw new Error("复习判分答案异常");
    if (r.shortExplanation !== undefined && typeof r.shortExplanation !== "string") throw new Error("复习判分解析异常");
    if (r.detailedExplanation !== undefined && typeof r.detailedExplanation !== "string") throw new Error("复习判分解析异常");
  }
  if (raw.results.filter(r => r.isCorrect).length !== correct || raw.results.filter(r => r.userAnswer === null).length !== unanswered) throw new Error("复习判分统计异常");
  return raw as unknown as PrivateReviewGradeResponse;
}

function storageKey(ownerId: string, paperId: string, contentHash: string): string {
  return `private-review:${ownerId}:${paperId}:${contentHash}`;
}

/** Validate a loaded session. Returns null if corrupt/mismatched. */
export function validatePrivateReviewSession(raw: unknown, ownerId: string, paperId: string): PrivateReviewSession | null {
  if (!record(raw)) return null;
  if (raw.version !== PRIVATE_REVIEW_STORAGE_VERSION) return null;
  if (raw.ownerId !== ownerId || raw.paperId !== paperId) return null;
  if (!nonempty(raw.reviewBatchId) || !nonempty(raw.contentHash)) return null;
  if (raw.updatedAt !== undefined && !timestamp(raw.updatedAt)) return null;
  if (!Array.isArray(raw.questions) || raw.questions.length === 0 || raw.questions.length > PRIVATE_REVIEW_MAX_QUESTIONS) return null;
  const seen = new Set<string>();
  for (const q of raw.questions) {
    if (!validateQuestion(q)) return null;
    if (seen.has(q.questionId)) return null;
    seen.add(q.questionId);
  }
  if (!record(raw.answers)) return null;
  if (Object.keys(raw.answers).length !== seen.size) return null;
  for (const [qid, ans] of Object.entries(raw.answers)) {
    if (!seen.has(qid)) return null;
    if (ans !== null && typeof ans !== "string") return null;
    if (ans !== null && !(raw.questions as PrivateReviewQuestion[]).find(q => q.questionId === qid)?.options.some(o => o.id === ans)) return null;
  }
  if (!Number.isSafeInteger(raw.currentIndex) || (raw.currentIndex as number) < 0 || (raw.currentIndex as number) >= raw.questions.length) return null;
  if (typeof raw.submitted !== "boolean") return null;
  if (raw.submitted) {
    if (!timestamp(raw.submittedAt)) return null;
    if (!record(raw.result)) return null;
    try {
      const grade = parsePrivateReviewGrade({ ...raw.result, ownerId }, ownerId, paperId, raw.contentHash, [...seen]);
      for (const r of grade.results) {
        const q = raw.questions.find(q => q.questionId === r.questionId);
        if (!q || r.userAnswer !== raw.answers[r.questionId] || !sameReviewQuestion(q, r)) return null;
      }
    } catch { return null; }
  } else if (raw.result !== undefined || raw.submittedAt !== undefined) {
    return null;
  }
  return raw as unknown as PrivateReviewSession;
}

export function sameReviewQuestion(a: PrivateReviewQuestion, b: PrivateReviewQuestion): boolean {
  return a.questionId === b.questionId && a.prompt === b.prompt && (a.passage ?? "") === (b.passage ?? "") && JSON.stringify(a.options) === JSON.stringify(b.options);
}

function pointerKey(ownerId: string, paperId: string) { return `private-review-latest:${ownerId}:${paperId}`; }

/** A pointer selects the latest batch, not the most recently submitted old version. */
export function restorePrivateReviewSession(ownerId: string, paperId: string): { session: PrivateReviewSession | null; warning: string | null } {
  try {
    const pointer = window.localStorage.getItem(pointerKey(ownerId, paperId));
    if (pointer) {
      const p: unknown = JSON.parse(pointer);
      if (!record(p) || !nonempty(p.contentHash) || !nonempty(p.reviewBatchId)) throw new Error();
      const session = loadPrivateReviewSession(ownerId, paperId, p.contentHash);
      if (!session || session.reviewBatchId !== p.reviewBatchId) throw new Error();
      return { session, warning: null };
    }
    let found: PrivateReviewSession | null = null, corrupt = false;
    const prefix = `private-review:${ownerId}:${paperId}:`;
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (!key?.startsWith(prefix)) continue;
      try {
        const candidate = validatePrivateReviewSession(JSON.parse(window.localStorage.getItem(key) || "null"), ownerId, paperId);
        if (!candidate || key !== storageKey(ownerId, paperId, candidate.contentHash)) { corrupt = true; continue; }
        if (!found || (candidate.updatedAt ?? candidate.submittedAt ?? "") > (found.updatedAt ?? found.submittedAt ?? "")) found = candidate;
      } catch { corrupt = true; }
    }
    return { session: found, warning: corrupt ? "本地复习存档已损坏，已跳过异常数据，请重新开始复习。" : null };
  } catch {
    return { session: null, warning: "无法恢复本地复习存档，请检查浏览器存储设置或重新开始复习。" };
  }
}

/** Save review session to localStorage. Throws on storage failure. */
export function savePrivateReviewSession(session: PrivateReviewSession): void {
  if (typeof window === "undefined") return;
  const key = storageKey(session.ownerId, session.paperId, session.contentHash);
  try {
    window.localStorage.setItem(key, JSON.stringify(session));
    window.localStorage.setItem(pointerKey(session.ownerId, session.paperId), JSON.stringify({ contentHash: session.contentHash, reviewBatchId: session.reviewBatchId }));
  } catch {
    throw new Error("本地存档失败，请检查浏览器存储空间");
  }
}

/** Load review session from localStorage. Returns null if not found or corrupt. */
export function loadPrivateReviewSession(ownerId: string, paperId: string, contentHash: string): PrivateReviewSession | null {
  if (typeof window === "undefined") return null;
  const key = storageKey(ownerId, paperId, contentHash);
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    return validatePrivateReviewSession(JSON.parse(raw), ownerId, paperId);
  } catch {
    return null;
  }
}

/** Clear review session from localStorage. */
export function clearPrivateReviewSession(ownerId: string, paperId: string, contentHash: string): void {
  if (typeof window === "undefined") return;
  const key = storageKey(ownerId, paperId, contentHash);
  try {
    window.localStorage.removeItem(key);
    const pointer = window.localStorage.getItem(pointerKey(ownerId, paperId));
    if (pointer && JSON.parse(pointer).contentHash === contentHash) window.localStorage.removeItem(pointerKey(ownerId, paperId));
  } catch { throw new Error("本地旧存档清理失败，请检查浏览器存储设置"); }
}

/** List all review session keys for an owner (for account-switch cleanup awareness). */
export function listPrivateReviewKeys(ownerId: string): string[] {
  if (typeof window === "undefined") return [];
  const prefix = `private-review:${ownerId}:`;
  const keys: string[] = [];
  for (let i = 0; i < window.localStorage.length; i++) {
    const k = window.localStorage.key(i);
    if (k && k.startsWith(prefix)) keys.push(k);
  }
  return keys;
}
