import { wordById, getHistoricalVocabulary } from "@/content/learning";
import { validDate } from "@/lib/dates";

import { validSession, type KeyStorage } from "@/lib/lesson/storage";
import { vocabularyQuestion } from "./questions";
import type {
  VocabularyStore,
  VocabularySession,
  UserVocabularyState,
  VocabularyQuestionType,
} from "@/types/vocabulary";
export const VOCABULARY_KEY = "cet-daily:v3:vocabulary";
export const emptyVocabularyStore = (): VocabularyStore => ({
  schemaVersion: 2,
  states: {},
  daily: {},
  sessions: {},
  xpLedger: {},
  batches: {},
});
const obj = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const timestamp = (v: unknown) =>
  typeof v === "string" && Number.isFinite(Date.parse(v));
const count = (v: unknown) =>
  typeof v === "number" && Number.isSafeInteger(v) && v >= 0;
const ids = (v: unknown): v is string[] =>
  Array.isArray(v) &&
  v.every((id) => typeof id === "string" && !!wordById(id)) &&
  new Set(v).size === v.length;
const questionTypes = ["en_to_zh", "zh_to_en", "sentence_blank"];
function validState(v: unknown): v is UserVocabularyState {
  return (
    obj(v) &&
    typeof v.wordId === "string" &&
    !!wordById(v.wordId) &&
    ["new", "learning", "weak", "reviewing", "mastered"].includes(
      String(v.masteryStatus),
    ) &&
    ["vocabulary", "reading", "listening"].includes(String(v.source)) &&
    ["selfReportedUnknown", "needsReview", "addedToWordbook"].every(
      (k) => typeof v[k] === "boolean",
    ) &&
    timestamp(v.firstSeenAt) &&
    ["lastReviewedAt", "nextReviewAt", "lastIndependentAt"].every(
      (k) => v[k] === undefined || timestamp(v[k]),
    ) &&
    ["wordbookAddedAt", "wordbookRemovedAt", "wordbookUpdatedAt"].every(
      (k) => v[k] === undefined || timestamp(v[k]),
    ) &&
    (v.wordbookVersion === undefined || count(v.wordbookVersion)) &&
    ["reviewCount", "correctCount", "wrongCount", "consecutiveCorrect"].every(
      (k) => count(v[k]),
    ) &&
    Array.isArray(v.independentTypes) &&
    v.independentTypes.every((t) => questionTypes.includes(String(t)))
  );
}
export function validVocabularySession(v: unknown): v is VocabularySession {
  if (
    !obj(v) ||
    v.schemaVersion !== 1 ||
    typeof v.id !== "string" ||
    typeof v.date !== "string" ||
    !validDate(v.date) ||
    ![
      "learn",
      "extra",
      "due_review",
      "wordbook_review",
      "single_review",
    ].includes(String(v.mode)) ||
    !ids(v.wordIds) ||
    !v.wordIds.length ||
    !count(v.cardIndex) ||
    Number(v.cardIndex) >= v.wordIds.length ||
    !obj(v.definition) ||
    v.definition.version !== 1 ||
    !obj(v.questionTypes) ||
    !obj(v.selfReports) ||
    !["card", "quiz", "complete"].includes(String(v.phase)) ||
    typeof v.applied !== "boolean"
  )
    return false;
  if (v.completedAt !== undefined && !timestamp(v.completedAt)) return false;
  if (
    v.mode === "extra" &&
    (typeof v.batchId !== "string" || (v.applied && !timestamp(v.completedAt)))
  )
    return false;
  if (
    !v.wordIds.every((id) =>
      questionTypes.includes(
        String((v.questionTypes as Record<string, unknown>)[id]),
      ),
    )
  )
    return false;
  const questions = v.wordIds.map((id) =>
    vocabularyQuestion(
      wordById(id)!,
      getHistoricalVocabulary(),
      (v.questionTypes as Record<string, VocabularyQuestionType>)[id],
    ),
  );
  if (JSON.stringify(v.definition.questions) !== JSON.stringify(questions))
    return false;
  const definition = {
    id: `vocabulary:${v.wordIds.join(",")}`,
    version: 1,
    title: "词汇专项",
    minutes: Math.max(3, v.wordIds.length * 2),
    questions,
  };
  if (
    v.definition.id !== definition.id ||
    !validSession(v.lesson, definition, false)
  )
    return false;
  if (v.lesson.id !== v.id || v.lesson.date !== v.date) return false;
  if (v.phase === "complete")
    return v.lesson.phase === "complete" && v.applied && count(v.rewardXp);
  if (v.applied || v.lesson.phase === "complete") return false;
  if (
    v.phase === "card" &&
    (!["learn", "extra"].includes(String(v.mode)) ||
      v.lesson.index !== 0 ||
      v.lesson.phase !== "answering" ||
      Object.keys(v.lesson.records).length)
  )
    return false;
  return (
    Object.entries(v.selfReports).every(
      ([id, value]) =>
        (v.wordIds as string[]).includes(id) &&
        ["known", "unknown"].includes(String(value)),
    ) &&
    (!["learn", "extra"].includes(String(v.mode)) ||
      (v.wordIds as string[])
        .slice(0, v.phase === "card" ? Number(v.cardIndex) : undefined)
        .every((id) => !!(v.selfReports as Record<string, unknown>)[id]))
  );
}
export function loadVocabularyStore(storage: KeyStorage | undefined): {
  store: VocabularyStore;
  persistent: boolean;
  issue?: string;
} {
  const store = emptyVocabularyStore();
  const unavailable = {
    store,
    persistent: false,
    issue: "浏览器暂时无法保存词汇进度，关闭或刷新后记录可能丢失。",
  };
  if (!storage) return unavailable;
  let raw: string | null;
  try {
    raw = storage.getItem(VOCABULARY_KEY);
  } catch {
    return unavailable;
  }
  if (!raw) return { store, persistent: true };
  let bad = false;
  try {
    const value: unknown = JSON.parse(raw);
    if (!obj(value) || ![1, 2].includes(Number(value.schemaVersion)))
      throw new Error("version");
    if (obj(value.states))
      for (const [id, state] of Object.entries(value.states)) {
        if (validState(state) && state.wordId === id) store.states[id] = state;
        else bad = true;
      }
    else bad = true;
    if (obj(value.sessions))
      for (const [id, s] of Object.entries(value.sessions)) {
        if (validVocabularySession(s) && s.id === id) store.sessions[id] = s;
        else bad = true;
      }
    else bad = true;
    if (obj(value.batches)) {
      for (const [id, batch] of Object.entries(value.batches)) {
        if (
          obj(batch) &&
          batch.id === id &&
          count(batch.target) &&
          Number(batch.target) > 0 &&
          timestamp(batch.createdAt) &&
          Array.isArray(batch.sessionIds) &&
          batch.sessionIds.length > 0 &&
          new Set(batch.sessionIds).size === batch.sessionIds.length &&
          batch.sessionIds.every(
            (sid) =>
              typeof sid === "string" &&
              store.sessions[sid]?.mode === "extra" &&
              store.sessions[sid]?.batchId === id,
          )
        ) {
          const sessions = (batch.sessionIds as string[]).map(
            (sid) => store.sessions[sid],
          );
          if (
            sessions.reduce((n, s) => n + s.wordIds.length, 0) <=
              Number(batch.target) &&
            sessions.filter((s) => !s.applied).length <= 1
          ) {
            store.batches[id] = {
              id,
              target: Number(batch.target),
              createdAt: String(batch.createdAt),
              sessionIds: batch.sessionIds as string[],
            };
            continue;
          }
        }
        bad = true;
      }
    } else if (value.schemaVersion === 2) bad = true;
    for (const [id, session] of Object.entries(store.sessions)) {
      if (
        session.mode === "extra" &&
        (!session.batchId ||
          !store.batches[session.batchId]?.sessionIds.includes(id))
      ) {
        delete store.sessions[id];
        bad = true;
      }
    }
    if (obj(value.daily))
      for (const [date, p] of Object.entries(value.daily)) {
        if (
          validDate(date) &&
          obj(p) &&
          p.date === date &&
          ids(p.wordIds) &&
          ids(p.completedWordIds) &&
          p.completedWordIds.every((id) => (p.wordIds as string[]).includes(id))
        )
          store.daily[date] = {
            date,
            wordIds: p.wordIds,
            completedWordIds: p.completedWordIds,
            ...(typeof p.activeSessionId === "string" &&
            store.sessions[p.activeSessionId]
              ? { activeSessionId: p.activeSessionId }
              : {}),
          };
        else bad = true;
      }
    else bad = true;
    if (obj(value.xpLedger))
      for (const [key, xp] of Object.entries(value.xpLedger)) {
        if (count(xp)) store.xpLedger[key] = xp as number;
        else bad = true;
      }
    else bad = true;
  } catch {
    bad = true;
  }
  return {
    store,
    persistent: true,
    ...(bad ? { issue: "部分词汇记录无法读取，已保留其他有效记录。" } : {}),
  };
}
export function saveVocabularyStore(
  storage: KeyStorage | undefined,
  store: VocabularyStore,
) {
  try {
    if (!storage) return false;
    storage.setItem(VOCABULARY_KEY, JSON.stringify(store));
    return true;
  } catch {
    return false;
  }
}
