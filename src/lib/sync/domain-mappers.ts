import { wordById, translationTaskById, writingTaskById } from "@/content/learning";
import { todayInShanghai, validDate } from "@/lib/dates";
import { newVocabularyState } from "@/lib/vocabulary/mastery";
import { isValidReviewItem } from "@/lib/review/store";
import type { UserProfile, TargetScore } from "@/lib/profile/store";
import type { ReviewItem, ReviewMastery, ReviewStore } from "@/types/review";
import type { UserVocabularyState } from "@/types/vocabulary";
import type { TranslationHistoryEntry } from "@/types/translation";
import type { WritingHistoryEntry } from "@/types/writing";
import type { SubjectiveFeedback } from "@/types/subjective";

export type RemoteRecord = Record<string, unknown>;

export function record(value: unknown): RemoteRecord | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as RemoteRecord)
    : null;
}

export function iso(value: unknown, fallback: string): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
  return typeof value === "string" && Number.isFinite(Date.parse(value))
    ? new Date(value).toISOString()
    : fallback;
}

export function dateOnly(value: unknown): string | undefined {
  const date = value instanceof Date ? value.toISOString().slice(0, 10) : typeof value === "string" ? value.slice(0, 10) : "";
  return validDate(date) ? date : undefined;
}

export function mapRemoteProfile(existing: UserProfile, remote: RemoteRecord): UserProfile {
  const target = Number(remote.targetScore);
  const targetScore: TargetScore = [425, 500, 550, 600].includes(target)
    ? (target as TargetScore)
    : existing.targetScore;
  const reminders = record(remote.reminders);
  return {
    schemaVersion: 1,
    targetScore,
    reminders: {
      evening: typeof reminders?.evening === "boolean" ? reminders.evening : existing.reminders.evening,
      miss: typeof reminders?.miss === "boolean" ? reminders.miss : existing.reminders.miss,
      lastChance: typeof reminders?.lastChance === "boolean" ? reminders.lastChance : existing.reminders.lastChance,
    },
    createdAt: iso(remote.createdAt, existing.createdAt),
    updatedAt: iso(remote.updatedAt, existing.updatedAt),
  };
}

/** The V4 wordbook is a flag on UserVocabularyState, not a separate local array. */
export function mapRemoteWordbookState(
  existing: UserVocabularyState | undefined,
  remote: RemoteRecord,
): UserVocabularyState | null {
  const wordId = typeof remote.wordId === "string" ? remote.wordId : "";
  const word = wordById(wordId);
  if (!word) return null;
  const addedAt = iso(remote.addedAt, new Date().toISOString());
  const updatedAt = iso(remote.updatedAt, addedAt);
  const version = Number.isSafeInteger(remote.version) && Number(remote.version) >= 1 ? Number(remote.version) : 1;
  const currentVersion = existing?.wordbookVersion ?? 0;
  if (existing && (currentVersion > version || (currentVersion === version && (existing.wordbookUpdatedAt ?? "") > updatedAt))) return existing;
  const removedAt = remote.removedAt ? iso(remote.removedAt, "") : "";
  const base = existing ?? newVocabularyState(word, addedAt);
  return {
    ...base,
    addedToWordbook: !removedAt,
    source: remote.source === "vocabulary" || remote.source === "reading" || remote.source === "listening" ? remote.source : base.source,
    wordbookAddedAt: addedAt,
    ...(removedAt ? { wordbookRemovedAt: removedAt } : { wordbookRemovedAt: undefined }),
    wordbookUpdatedAt: updatedAt,
    wordbookVersion: version,
  };
}

export function toRemoteMastery(mastery: ReviewMastery): "new" | "learning" | "familiar" | "mastered" {
  return mastery === "weak" ? "learning" : mastery === "reviewing" ? "familiar" : mastery;
}

function toLocalMastery(value: unknown): ReviewMastery {
  if (value === "mastered") return "mastered";
  if (value === "familiar" || value === "reviewing") return "reviewing";
  if (value === "learning" || value === "weak") return "weak";
  return "new";
}

/** Preserve full V9 metadata when present; construct a valid V9 item for legacy rows. */
export function mapRemoteReviewItem(remote: RemoteRecord, existing?: ReviewItem): ReviewItem | null {
  const id = typeof remote.reviewItemId === "string" ? remote.reviewItemId : "";
  const sourceModule = remote.sourceModule;
  if (!id || (sourceModule !== "reading" && sourceModule !== "listening" && sourceModule !== "vocabulary")) return null;
  const activityId = typeof remote.activityId === "string" ? remote.activityId : "";
  const questionId = typeof remote.questionId === "string" ? remote.questionId : "";
  if (!activityId || !questionId) return null;
  const now = new Date().toISOString();
  const createdAt = iso(remote.createdAt, existing?.createdAt ?? now);
  const updatedAt = iso(remote.updatedAt, existing?.updatedAt ?? createdAt);
  const version = Number.isSafeInteger(remote.version) && Number(remote.version) >= 1 ? Number(remote.version) : 1;
  if (existing && ((existing.version ?? 0) > version || ((existing.version ?? 0) === version && existing.updatedAt > updatedAt))) return existing;
  const snapshot = record(remote.payload);
  const payload = snapshot && isValidReviewItem(snapshot) && snapshot.id === id ? snapshot : null;
  const mastery = toLocalMastery(remote.mastery ?? (remote.status === "mastered" ? "mastered" : undefined));
  const due = dateOnly(remote.dueDate) ?? payload?.nextReviewAt ?? existing?.nextReviewAt ?? todayInShanghai();
  const base: ReviewItem = payload ?? existing ?? {
    id,
    contentType: id.startsWith("word:") ? "word" : "question",
    sourceModule,
    sourceActivityId: activityId,
    questionId,
    createdAt,
    updatedAt,
    nextReviewAt: due,
    masteryStatus: mastery,
    reviewCount: 0,
    correctStreak: 0,
    wrongCount: 0,
    priority: 1,
    favorite: false,
    removed: false,
    history: [],
    schemaVersion: 1,
  };
  // A stale or incomplete pull cannot demote an already mastered item.
  const preservedMastery = existing?.masteryStatus === "mastered" || base.masteryStatus === "mastered" ? "mastered" : mastery;
  const history = [...(existing?.history ?? []), ...base.history].filter((entry, index, all) =>
    all.findIndex((candidate) => candidate.reviewedAt === entry.reviewedAt && candidate.result === entry.result && candidate.source === entry.source) === index,
  ).sort((a, b) => a.reviewedAt.localeCompare(b.reviewedAt));
  const result: ReviewItem = {
    ...base,
    id,
    sourceModule,
    sourceActivityId: activityId,
    questionId,
    createdAt: base.createdAt,
    updatedAt,
    nextReviewAt: due,
    masteryStatus: preservedMastery,
    history,
    reviewCount: Math.max(existing?.reviewCount ?? 0, base.reviewCount),
    wrongCount: Math.max(existing?.wrongCount ?? 0, base.wrongCount),
    favorite: Boolean(existing?.favorite || base.favorite),
    lastWrongOptionId: base.lastWrongOptionId ?? existing?.lastWrongOptionId,
    priority: typeof remote.priority === "number" && remote.priority >= 0 ? remote.priority : base.priority,
    removed: Boolean(remote.removedAt) || remote.status === "removed" || base.removed,
    version: Math.max(existing?.version ?? 0, version),
    schemaVersion: 1,
  };
  return isValidReviewItem(result) ? result : null;
}

export function mergeRemoteReviewItems(store: ReviewStore, rows: RemoteRecord[]): ReviewStore {
  const items = { ...store.items };
  for (const row of rows) {
    const id = typeof row.reviewItemId === "string" ? row.reviewItemId : "";
    const mapped = mapRemoteReviewItem(row, items[id]);
    if (mapped) items[id] = mapped;
  }
  return { ...store, schemaVersion: 1, items };
}

function remoteFeedback(value: unknown): SubjectiveFeedback | null {
  const feedback = record(value);
  if (!feedback || feedback.provider !== "mock" || typeof feedback.score !== "number" || !Number.isFinite(feedback.score) || typeof feedback.maxScore !== "number" || typeof feedback.summary !== "string" || !Array.isArray(feedback.issues) || !Array.isArray(feedback.details) || !iso(feedback.createdAt, "")) return null;
  return feedback as unknown as SubjectiveFeedback;
}

export function mapRemoteTranslationHistory(remote: RemoteRecord): TranslationHistoryEntry | null {
  const taskId = typeof remote.promptId === "string" ? remote.promptId : "";
  const answer = typeof remote.answer === "string" ? remote.answer : null;
  const feedback = remoteFeedback(remote.feedback);
  if (!translationTaskById(taskId) || answer === null || !feedback) return null;
  return {
    taskId,
    sessionId: typeof remote.itemId === "string" ? remote.itemId : undefined,
    submittedText: answer,
    feedback,
    score: feedback.score,
    createdAt: iso(remote.createdAt, feedback.createdAt),
  };
}

export function mapRemoteWritingHistory(remote: RemoteRecord): WritingHistoryEntry | null {
  const taskId = typeof remote.promptId === "string" ? remote.promptId : "";
  const answer = typeof remote.answer === "string" ? remote.answer : null;
  const feedback = remoteFeedback(remote.feedback);
  if (!writingTaskById(taskId) || answer === null || !feedback) return null;
  return {
    taskId,
    sessionId: typeof remote.itemId === "string" ? remote.itemId : undefined,
    submittedText: answer,
    feedback,
    score: feedback.score,
    wordCount: answer.trim() ? answer.trim().split(/\s+/).length : 0,
    createdAt: iso(remote.createdAt, feedback.createdAt),
  };
}
