/** Tab-local PRIVATE progress, with strict validation and explicit failure states. */
import { PRIVATE_STUDY_PROGRESS_VERSION, type PrivateFlatQuestion } from "./readiness";
export type ProgressLoadStatus = "loaded" | "no_archive" | "corrupted" | "content_changed" | "owner_mismatch" | "storage_read_failed" | "storage_write_failed";
export interface StudyProgressState { answers: Record<number, string>; currentIndex: number; submitted: boolean; attemptId?: string; revision?: number; dirty?: boolean; mode?: "save" | "restart"; }
export interface ProgressLoadResult extends StudyProgressState { status: ProgressLoadStatus; message?: string; }
export const INITIAL_PROGRESS: StudyProgressState = { answers: {}, currentIndex: 0, submitted: false };
const storageKey = (userId: string, paperId: string) => `private-study:${userId}:${paperId}`;
const empty = (status: ProgressLoadStatus): ProgressLoadResult => ({ answers: {}, currentIndex: 0, submitted: false, status, message: getProgressStatusMessage(status) ?? undefined });
const record = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === "object" && !Array.isArray(v);
export function loadStudyProgress(userId: string, paperId: string, contentHash: string, questions: PrivateFlatQuestion[]): ProgressLoadResult {
  const key = storageKey(userId, paperId);
  let raw: string | null;
  try { raw = window.sessionStorage.getItem(key); } catch { return empty("storage_read_failed"); }
  if (raw === null) return empty("no_archive");
  const reject = (status: ProgressLoadStatus) => { try { window.sessionStorage.removeItem(key); } catch { /* In-memory state is still reset. */ } return empty(status); };
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { return reject("corrupted"); }
  if (!record(parsed) || parsed.version !== PRIVATE_STUDY_PROGRESS_VERSION) return reject("corrupted");
  if (parsed.userId !== userId) return reject("owner_mismatch");
  if (parsed.paperId !== paperId) return reject("corrupted");
  if (parsed.contentHash !== contentHash) return reject("content_changed");
  if (typeof parsed.submitted !== "boolean" || !record(parsed.answers) || !Number.isSafeInteger(parsed.currentIndex)) return reject("corrupted");
  if (parsed.revision !== undefined && (!Number.isSafeInteger(parsed.revision) || Number(parsed.revision) < 0)) return reject("corrupted");
  if (parsed.dirty !== undefined && typeof parsed.dirty !== "boolean") return reject("corrupted");
  const answers: Record<number, string> = {};
  const byIndex = new Map(questions.map(q => [q.index, q]));
  for (const [key, value] of Object.entries(parsed.answers)) {
    if (!/^(0|[1-9][0-9]*)$/.test(key) || !Number.isSafeInteger(Number(key))) return reject("corrupted");
    const question = byIndex.get(Number(key));
    if (!question) continue; // Ignore extra indices, never count them as answered.
    if (typeof value !== "string" || !question.options.some(o => o.id === value)) return reject("corrupted");
    answers[Number(key)] = value;
  }
  return { status: "loaded", answers, currentIndex: Math.min(Math.max(0, Number(parsed.currentIndex)), Math.max(0, questions.length - 1)), submitted: parsed.submitted, attemptId: typeof parsed.attemptId === "string" && parsed.attemptId ? parsed.attemptId : undefined, revision: typeof parsed.revision === "number" ? parsed.revision : 0, dirty: parsed.dirty === true, mode: parsed.mode === "restart" ? "restart" : "save" };
}
export function saveStudyProgress(userId: string, paperId: string, contentHash: string, state: StudyProgressState): boolean {
  try {
    window.sessionStorage.setItem(storageKey(userId, paperId), JSON.stringify({ version: PRIVATE_STUDY_PROGRESS_VERSION, userId, paperId, contentHash, answers: state.answers, currentIndex: state.currentIndex, submitted: state.submitted, attemptId: state.attemptId, revision: state.revision, dirty: state.dirty, mode: state.mode, savedAt: new Date().toISOString() }));
    return true;
  } catch { return false; }
}
export function clearStudyProgress(userId: string, paperId: string): boolean {
  try { window.sessionStorage.removeItem(storageKey(userId, paperId)); return true; } catch { return false; }
}
export function getProgressStatusMessage(status: ProgressLoadStatus): string | null {
  switch (status) {
    case "corrupted": return "本地进度损坏或格式已更新，旧进度已失效。请重新开始作答。";
    case "content_changed": return "试卷内容已更新，旧作答进度已失效。请重新开始作答。";
    case "owner_mismatch": return "检测到其他账号的本地进度，旧进度已失效。请重新开始作答。";
    case "storage_read_failed": return "读取本地存储失败，进度仅在本次会话内有效，刷新后可能无法恢复。";
    case "storage_write_failed": return "保存本地进度失败，当前答案保留在内存中，刷新后可能无法恢复。";
    default: return null;
  }
}
