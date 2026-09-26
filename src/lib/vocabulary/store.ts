import { getVocabulary, getHistoricalVocabulary, vocabularySettings, wordById } from "@/content/learning";

import type {
  VocabularyStore,
  VocabularySessionMode,
  Word,
} from "@/types/vocabulary";
import { vocabularyLesson, questionTypeFor } from "./questions";
import {
  createVocabularySession,
  reduceVocabularySession,
  currentVocabularyWordId,
  type VocabularyAction,
} from "./session";
import {
  newVocabularyState,
  markSelfReport,
  applyVocabularyResult,
} from "./mastery";
import { getWordsDueForReview } from "./reviewScheduler";
import { vocabularyXp } from "./xp";
import { todayInShanghai } from "@/lib/dates";
export function batchProgress(store: VocabularyStore, batchId: string) {
  const batch = store.batches[batchId];
  const sessions = (batch?.sessionIds ?? [])
    .map((id) => store.sessions[id])
    .filter(Boolean);
  return {
    completed: sessions
      .filter((s) => s.applied)
      .reduce((n, s) => n + s.wordIds.length, 0),
    xp: sessions
      .filter((s) => s.applied)
      .reduce((n, s) => n + (s.rewardXp ?? 0), 0),
    active: sessions.find((s) => !s.applied),
  };
}
export function vocabularyDayStats(store: VocabularyStore, date: string) {
  const completed = Object.values(store.sessions).filter(
    (s) =>
      s.applied &&
      s.completedAt &&
      todayInShanghai(new Date(s.completedAt)) === date,
  );
  return {
    extra: completed
      .filter((s) => s.mode === "extra")
      .reduce((n, s) => n + s.wordIds.length, 0),
    xp: Object.entries(store.xpLedger)
      .filter(([key]) => key.startsWith(`day:${date}:`))
      .reduce((n, [, xp]) => n + xp, 0),
  };
}
/**
 * 把任意来源的单词写入统一生词本（V5 阅读收藏复用此入口）。
 * 已收藏时返回原 store 与 added=false，保证不重复添加。
 */
export function addWordToWordbook(
  store: VocabularyStore,
  word: Word,
  now: string,
): { store: VocabularyStore; added: boolean } {
  const previous = store.states[word.id];
  if (previous?.addedToWordbook) return { store, added: false };
  const state = {
    ...(previous ?? newVocabularyState(word, now)),
    addedToWordbook: true,
    wordbookAddedAt: now,
    wordbookRemovedAt: undefined,
    wordbookUpdatedAt: now,
    wordbookVersion: (previous?.wordbookVersion ?? 0) + 1,
  };
  return {
    store: { ...store, states: { ...store.states, [word.id]: state } },
    added: true,
  };
}
function rankedWords(store: VocabularyStore) {
  return [...getVocabulary()].sort((a, b) =>
    (store.states[a.id]?.lastReviewedAt ?? "").localeCompare(
      store.states[b.id]?.lastReviewedAt ?? "",
    ),
  );
}
export function planFor(store: VocabularyStore, date: string) {
  const saved = store.daily[date];
  const existing = saved?.wordIds ?? [];
  const wordIds = [
    ...existing,
    ...rankedWords(store)
      .filter((w) => !existing.includes(w.id))
      .map((w) => w.id),
  ].slice(0, vocabularySettings.dailyNewWords);
  return {
    ...saved,
    date,
    wordIds,
    completedWordIds: saved?.completedWordIds ?? [],
  };
}
export function startVocabulary(
  store: VocabularyStore,
  mode: VocabularySessionMode,
  date: string,
  now: string,
  id: string,
  selectedWordId?: string,
  extraTarget?: number,
) {
  const active = Object.values(store.sessions).find(
    (s) =>
      s.phase !== "complete" &&
      s.mode === mode &&
      (mode !== "learn" || s.date === date) &&
      (mode !== "single_review" || s.wordIds[0] === selectedWordId),
  );
  if (active) return { store, id: active.id };
  const progress = planFor(store, date);
  let batch =
    mode === "extra"
      ? Object.values(store.batches).find(
          (b) => batchProgress(store, b.id).completed < b.target,
        )
      : undefined;
  if (mode === "extra" && !batch) {
    if (
      progress.completedWordIds.length < progress.wordIds.length ||
      !Number.isSafeInteger(extraTarget) ||
      !extraTarget ||
      extraTarget < 1
    )
      return { store, id: undefined };
    batch = {
      id: `batch:${id}`,
      target: extraTarget,
      createdAt: now,
      sessionIds: [],
    };
  }
  let ids =
    mode === "learn"
      ? progress.wordIds.filter((w) => !progress.completedWordIds.includes(w))
      : mode === "extra"
        ? rankedWords(store)
            .filter(
              (w) =>
                !(
                  (batch?.sessionIds.length
                    ? store.sessions[batch.sessionIds.at(-1)!]?.wordIds
                    : []) ?? []
                ).includes(w.id),
            )
            .map((w) => w.id)
        : mode === "due_review"
          ? getWordsDueForReview(store.states, now).map((s) => s.wordId)
          : mode === "single_review"
            ? selectedWordId && wordById(selectedWordId)
              ? [selectedWordId]
              : []
            : Object.values(store.states)
                .filter((s) => s.addedToWordbook)
                .sort((a, b) =>
                  (a.lastReviewedAt ?? "").localeCompare(
                    b.lastReviewedAt ?? "",
                  ),
                )
                .map((s) => s.wordId);
  ids = ids.slice(
    0,
    Math.min(
      vocabularySettings.sessionWords,
      batch
        ? batch.target - batchProgress(store, batch.id).completed
        : vocabularySettings.sessionWords,
    ),
  );
  if (!ids.length) return { store, id: undefined };
  const definition = vocabularyLesson(ids, getHistoricalVocabulary(), store.states);
  const questionTypes = Object.fromEntries(
    ids.map((wordId, index) => [
      wordId,
      questionTypeFor(store.states[wordId], index),
    ]),
  );
  const session = createVocabularySession(
    id,
    mode,
    date,
    ids,
    definition,
    now,
    questionTypes,
  );
  if (batch) session.batchId = batch.id;
  return {
    id,
    store: {
      ...store,
      sessions: { ...store.sessions, [id]: session },
      batches: batch
        ? {
            ...store.batches,
            [batch.id]: { ...batch, sessionIds: [...batch.sessionIds, id] },
          }
        : store.batches,
      daily:
        mode === "learn"
          ? { ...store.daily, [date]: { ...progress, activeSessionId: id } }
          : store.daily,
    },
  };
}
export function updateVocabulary(
  store: VocabularyStore,
  id: string,
  action: VocabularyAction,
  now: string,
): VocabularyStore {
  const previous = store.sessions[id];
  if (!previous || previous.applied) return store;
  let session = reduceVocabularySession(previous, action);
  if (session === previous) return store;
  const states = { ...store.states };
  let daily = store.daily,
    xpLedger = store.xpLedger;
  if (action.type === "self_report") {
    const word = wordById(currentVocabularyWordId(previous)!);
    if (word)
      states[word.id] = markSelfReport(
        states[word.id] ?? newVocabularyState(word, now),
        action.value === "unknown",
        now,
      );
  }
  if (session.phase === "complete") {
    for (const wordId of session.wordIds) {
      const word = wordById(wordId)!;
      states[wordId] = applyVocabularyResult(
        states[wordId] ?? newVocabularyState(word, now),
        session.lesson.records[`vq:${wordId}`],
        session.questionTypes[wordId],
        now,
        !!states[wordId]?.lastReviewedAt,
      );
    }
    const reward = vocabularyXp(session, xpLedger, now);
    xpLedger = reward.ledger;
    session = {
      ...session,
      rewardXp: reward.xp,
      applied: true,
      completedAt: now,
    };
    if (session.mode === "learn") {
      const progress = store.daily[session.date] ?? {
        date: session.date,
        wordIds: session.wordIds,
        completedWordIds: [],
      };
      daily = {
        ...daily,
        [session.date]: {
          date: progress.date,
          wordIds: progress.wordIds,
          completedWordIds: [
            ...new Set([...progress.completedWordIds, ...session.wordIds]),
          ],
        },
      };
    }
  }
  return {
    ...store,
    states,
    daily,
    xpLedger,
    sessions: { ...store.sessions, [id]: session },
  };
}
