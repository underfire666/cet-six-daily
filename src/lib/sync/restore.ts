/** Remote DTO → V4–V11 repositories. No enqueue adapter is called here. */
import { todayInShanghai, validDate } from "@/lib/dates";
import { createStudyStorage, defaultSettings, validSession, type KeyStorage } from "@/lib/lesson/storage";
import { loadProfile, saveProfile, PROFILE_KEY } from "@/lib/profile/store";
import { loadVocabularyStore, saveVocabularyStore, validVocabularySession } from "@/lib/vocabulary/storage";
import { planFor as vocabularyPlanFor } from "@/lib/vocabulary/store";
import { vocabularyXp } from "@/lib/vocabulary/xp";
import { loadReadingStore, saveReadingStore, validReadingSession } from "@/lib/reading/storage";
import { planFor as readingPlanFor } from "@/lib/reading/store";
import { readingXp } from "@/lib/reading/xp";
import { loadListeningStore, saveListeningStore, validListeningSession } from "@/lib/listening/storage";
import { planFor as listeningPlanFor } from "@/lib/listening/store";
import { listeningXp } from "@/lib/listening/xp";
import { loadTranslationStore, saveTranslationStore, validTranslationSession } from "@/lib/translation/storage";
import { planFor as translationPlanFor } from "@/lib/translation/store";
import { translationXp } from "@/lib/translation/xp";
import { loadWritingStore, saveWritingStore, validWritingSession } from "@/lib/writing/storage";
import { planWritingFor } from "@/lib/writing/store";
import { writingXp } from "@/lib/writing/xp";
import { loadReviewStore, saveReviewStore, validReviewSession } from "@/lib/review/store";
import { recordWrong, reviewItemId } from "@/lib/review/scheduler";
import { generatePlan } from "@/lib/dailyPlan/generator";
import { isValidStudyPreferences, loadDailyPlanStore, saveDailyPlanStore } from "@/lib/dailyPlan/storage";
import { dateOnly, iso, mapRemoteProfile, mapRemoteReviewItem, mapRemoteTranslationHistory, mapRemoteWordbookState, mapRemoteWritingHistory, record, type RemoteRecord } from "./domain-mappers";
import type { HydratedDomain } from "@/lib/storage/hydration-events";
import type { AnswerRecord, LessonSession } from "@/types/session";
import type { VocabularySession } from "@/types/vocabulary";
import type { ReadingSession } from "@/types/reading";
import type { ListeningSession } from "@/types/listening";
import type { TranslationSession } from "@/types/translation";
import type { WritingSession } from "@/types/writing";
import type { ReviewSession } from "@/types/review";
import type { DailyPlan } from "@/types/dailyPlan";

export interface PullResponse {
  profile?: RemoteRecord | null;
  preferences?: { payload?: unknown } | null;
  settings?: { payload?: unknown } | null;
  xpEvents?: RemoteRecord[];
  sessions?: RemoteRecord[];
  wordbook?: RemoteRecord[];
  reviewItems?: RemoteRecord[];
  dailyPlans?: RemoteRecord[];
  translationHistory?: RemoteRecord[];
  writingHistory?: RemoteRecord[];
  pulledAt?: string;
}

const validXp = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value > 0;
const rows = (value: unknown): RemoteRecord[] => Array.isArray(value) ? value.filter((v): v is RemoteRecord => record(v) !== null) : [];
const stringArray = (value: unknown): string[] => Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
const union = (a: string[], b: string[]) => [...new Set([...a, ...b])];

function preferIncoming<T extends { applied?: boolean; phase?: string; completedAt?: string }>(existing: T | undefined, incoming: T): T {
  if (!existing) return incoming;
  const existingDone = existing.applied === true || existing.phase === "complete";
  const incomingDone = incoming.applied === true || incoming.phase === "complete";
  if (existingDone && !incomingDone) return existing;
  if (existingDone && incomingDone && existing.completedAt && incoming.completedAt && existing.completedAt > incoming.completedAt) return existing;
  return incoming;
}

function isSessionSnapshot(row: RemoteRecord): RemoteRecord | null {
  const payload = record(row.payload);
  return payload && payload.schemaVersion === 1 && payload.id === row.id ? payload : null;
}

/** Returns the provider stores that must reload after all writes have completed. */
export function applyPullToDomainStores(storage: KeyStorage, data: PullResponse): HydratedDomain[] {
  const changed = new Set<HydratedDomain>();
  const rawProfile = storage.getItem(PROFILE_KEY);
  const localProfile = loadProfile(storage as Storage).profile;
  if (record(data.profile)) {
    const remote = data.profile as RemoteRecord;
    const remoteUpdated = iso(remote.updatedAt, "");
    if (!rawProfile || !remoteUpdated || remoteUpdated >= localProfile.updatedAt) {
      saveProfile(storage as Storage, mapRemoteProfile(localProfile, remote));
      changed.add("profile");
    }
  }

  const plan = loadDailyPlanStore(storage).store;
  let planChanged = false;
  const pulledPreferences = record(data.preferences?.payload);
  if (isValidStudyPreferences(pulledPreferences)) {
    plan.preferences = pulledPreferences;
    planChanged = true;
  } else if (record(data.profile)) {
    const examDate = dateOnly(data.profile?.examDate);
    if (examDate && examDate !== plan.preferences.examDate) {
      plan.preferences = { ...plan.preferences, examDate };
      planChanged = true;
    }
  }
  for (const row of rows(data.dailyPlans)) {
    const date = typeof row.planDate === "string" && validDate(row.planDate) ? row.planDate : "";
    if (!date) continue;
    const payload = record(row.payload);
    const candidate = record(payload?.plan);
    const snapshot = candidate && candidate.date === date && candidate.planVersion === 1 && Array.isArray(candidate.tasks)
      ? (candidate as unknown as DailyPlan)
      : null;
    const current = plan.plans[date];
    const base = snapshot && !plan.customizedDates.includes(date)
      ? snapshot
      : current ?? generatePlan(date, plan.preferences.examDate, plan.preferences);
    const completedIds = stringArray(payload?.completedTaskIds);
    const activeIds = base.tasks.filter((task) => !task.removed).map((task) => task.id);
    const status = completedIds.length && activeIds.length && activeIds.every((id) => completedIds.includes(id))
      ? "completed"
      : completedIds.length ? "in_progress" : base.status;
    plan.plans[date] = { ...base, status: base.status === "completed" ? "completed" : status };
    if (plan.plans[date].status === "completed") {
      const key = `daily-plan-complete:${date}`;
      plan.completionLedger[key] = plan.completionLedger[key] ?? 10;
    }
    planChanged = true;
  }
  if (planChanged) {
    saveDailyPlanStore(storage, plan);
    changed.add("dailyPlan");
  }

  const studyRepository = createStudyStorage(storage, () => {});
  const savedStudy = studyRepository.load(todayInShanghai());
  const studyProfile = {
    ...savedStudy.profile,
    completedLessons: { ...savedStudy.profile.completedLessons },
    rewardsByDay: { ...savedStudy.profile.rewardsByDay },
    bonusXpEvents: { ...savedStudy.profile.bonusXpEvents },
  };
  let studyChanged = false;
  const settingsPayload = record(data.settings?.payload);
  const feedback = record(settingsPayload?.feedback) ?? settingsPayload;
  if (feedback && Object.keys(defaultSettings).every((key) => typeof feedback[key] === "boolean")) {
    studyRepository.saveSettings({
      soundEnabled: feedback.soundEnabled as boolean,
      hapticsEnabled: feedback.hapticsEnabled as boolean,
      celebrationEnabled: feedback.celebrationEnabled as boolean,
    });
    studyChanged = true;
  }
  for (const event of rows(data.xpEvents)) {
    if (typeof event.eventId !== "string" || !validXp(event.amount)) continue;
    if (event.source === "daily_lesson" && event.amount === 45) {
      const earnedAt = iso(event.earnedAt, "");
      const day = earnedAt ? todayInShanghai(new Date(earnedAt)) : dateOnly(event.earnedAt);
      if (day) {
        const sessionId = typeof event.sourceId === "string" ? event.sourceId : event.eventId;
        studyProfile.rewardsByDay[day] ??= { xp: 45, sessionId };
        studyProfile.completedLessons[day] ??= sessionId;
      }
    } else {
      studyProfile.bonusXpEvents[event.eventId] = Math.max(studyProfile.bonusXpEvents[event.eventId] ?? 0, event.amount);
    }
    studyChanged = true;
  }

  const vocabulary = loadVocabularyStore(storage).store;
  const reading = loadReadingStore(storage).store;
  const listening = loadListeningStore(storage).store;
  const translation = loadTranslationStore(storage).store;
  const writing = loadWritingStore(storage).store;
  const review = loadReviewStore(storage as Storage).store;

  for (const row of rows(data.sessions)) {
    if (typeof row.id !== "string") continue;
    const snapshot = isSessionSnapshot(row);
    if (!snapshot) continue;
    const id = row.id;
    const sessionModule = row.module;
    if (sessionModule === "daily" && validSession(snapshot)) {
      const session = preferIncoming(savedStudy.sessions[`${snapshot.date}:${snapshot.mode}`], snapshot as unknown as LessonSession);
      studyRepository.saveSession(session);
      if (session.phase === "complete" && session.mode === "daily") {
        studyProfile.completedLessons[session.date] ??= session.id;
        if (session.reward?.xp === 45 && session.completedDay) studyProfile.rewardsByDay[session.completedDay] ??= { xp: 45, sessionId: session.id };
      }
      studyChanged = true;
      continue;
    }
    if (!["vocabulary", "reading", "listening", "translation", "writing", "review"].includes(String(sessionModule))) continue;
    if (sessionModule === "review") {
      if (!validReviewSession(snapshot)) continue;
      const incoming = snapshot as unknown as ReviewSession;
      review.sessions[id] = preferIncoming(review.sessions[id], incoming);
      changed.add("review");
      if (incoming.applied && validXp(incoming.rewardXp)) {
        studyProfile.bonusXpEvents[`review-session:${id}`] ??= incoming.rewardXp;
        studyChanged = true;
      }
      continue;
    }
    if (snapshot.applied !== true || snapshot.phase !== "complete" || !iso(snapshot.completedAt, "")) continue;
    if (sessionModule === "vocabulary" && !validVocabularySession(snapshot)) continue;
    if (sessionModule === "reading" && !validReadingSession(snapshot)) continue;
    if (sessionModule === "listening" && !validListeningSession(snapshot)) continue;
    if (sessionModule === "translation" && !validTranslationSession(snapshot)) continue;
    if (sessionModule === "writing" && !validWritingSession(snapshot)) continue;
    const reward = snapshot.rewardXp;
    if (validXp(reward)) {
      studyProfile.bonusXpEvents[`${sessionModule}:${id}`] ??= reward;
      studyChanged = true;
    }
    if (sessionModule === "vocabulary") {
      const s = snapshot as unknown as VocabularySession;
      vocabulary.sessions[id] = preferIncoming(vocabulary.sessions[id], s);
      if (s.mode === "learn") {
        const progress = vocabularyPlanFor(vocabulary, s.date);
        vocabulary.daily[s.date] = {
          ...progress,
          wordIds: union(progress.wordIds, s.wordIds),
          completedWordIds: union(progress.completedWordIds, s.wordIds),
        };
      }
      changed.add("vocabulary");
    } else if (sessionModule === "reading") {
      const s = snapshot as unknown as ReadingSession;
      reading.sessions[id] = preferIncoming(reading.sessions[id], s);
      if (s.mode === "daily") {
        const progress = readingPlanFor(reading, s.planDate);
        reading.daily[s.planDate] = {
          ...progress,
          articleIds: union(progress.articleIds, [s.articleId]),
          completedArticleIds: union(progress.completedArticleIds, [s.articleId]),
        };
      }
      changed.add("reading");
    } else if (sessionModule === "listening") {
      const s = snapshot as unknown as ListeningSession;
      listening.sessions[id] = preferIncoming(listening.sessions[id], s);
      if (s.mode === "daily") {
        const progress = listeningPlanFor(listening, s.planDate);
        listening.daily[s.planDate] = {
          ...progress,
          materialIds: union(progress.materialIds, [s.materialId]),
          completedMaterialIds: union(progress.completedMaterialIds, [s.materialId]),
        };
      }
      changed.add("listening");
    } else if (sessionModule === "translation") {
      const s = snapshot as unknown as TranslationSession;
      translation.sessions[id] = preferIncoming(translation.sessions[id], s);
      if (s.mode === "daily") {
        const progress = translationPlanFor(translation, s.planDate);
        translation.daily[s.planDate] = {
          ...progress,
          taskIds: union(progress.taskIds, [s.taskId]),
          completedTaskIds: union(progress.completedTaskIds, [s.taskId]),
        };
      }
      changed.add("translation");
    } else if (sessionModule === "writing") {
      const s = snapshot as unknown as WritingSession;
      writing.sessions[id] = preferIncoming(writing.sessions[id], s);
      if (s.mode === "daily") {
        const progress = planWritingFor(writing, s.planDate);
        writing.daily[s.planDate] = {
          ...progress,
          taskIds: union(progress.taskIds, [s.taskId]),
          completedTaskIds: union(progress.completedTaskIds, [s.taskId]),
        };
      }
      changed.add("writing");
    }
  }

  // Rebuild the repositories' existing reward ledgers from restored sessions.
  // They guard against granting the same content's XP again on this device.
  const byCompletion = <T extends { completedAt?: string }>(sessions: Record<string, T>) =>
    Object.values(sessions).filter((session) => session.completedAt).sort((a, b) => (a.completedAt ?? "").localeCompare(b.completedAt ?? ""));
  for (const session of byCompletion(vocabulary.sessions)) {
    if (session.rewardXp && session.completedAt) vocabulary.xpLedger = vocabularyXp(session, vocabulary.xpLedger, session.completedAt).ledger;
  }
  for (const session of byCompletion(reading.sessions)) {
    if (session.rewardXp && session.completedAt) reading.xpLedger = readingXp(session, reading.xpLedger, session.completedAt).ledger;
  }
  for (const session of byCompletion(listening.sessions)) {
    if (session.rewardXp && session.completedAt) listening.xpLedger = listeningXp(session, listening.xpLedger, session.completedAt).ledger;
  }
  for (const session of byCompletion(translation.sessions)) {
    if (session.rewardXp && session.completedAt) translation.xpLedger = translationXp(session, translation.xpLedger, session.completedAt).ledger;
  }
  for (const session of byCompletion(writing.sessions)) {
    if (session.rewardXp && session.completedAt) writing.xpLedger = writingXp(session, writing.xpLedger, session.completedAt).ledger;
  }
  for (const session of byCompletion(review.sessions)) {
    if (!session.applied || !session.rewardXp) continue;
    let remaining = session.rewardXp;
    for (const itemId of session.itemIds) {
      if (remaining < 2 || !session.answers[itemId]?.correct) continue;
      const key = `review:${session.date}:${itemId}`;
      if (review.xpLedger[key] !== undefined) continue;
      review.xpLedger[key] = 2;
      remaining -= 2;
      changed.add("review");
    }
  }

  // Extra vocabulary sessions share a batch. Rebuild its existing V4 container
  // from the full session snapshots so loadVocabularyStore accepts the sessions.
  if (changed.has("vocabulary")) {
    for (const session of Object.values(vocabulary.sessions)) {
      if (session.mode !== "extra" || !session.batchId) continue;
      const siblings = Object.values(vocabulary.sessions).filter((s) => s.mode === "extra" && s.batchId === session.batchId);
      const prior = vocabulary.batches[session.batchId];
      vocabulary.batches[session.batchId] = {
        id: session.batchId,
        target: Math.max(prior?.target ?? 0, siblings.reduce((count, s) => count + s.wordIds.length, 0)),
        createdAt: prior?.createdAt ?? session.lesson.startedAt,
        sessionIds: union(prior?.sessionIds ?? [], siblings.map((s) => s.id)),
      };
    }
  }

  for (const row of rows(data.wordbook)) {
    const wordId = typeof row.wordId === "string" ? row.wordId : "";
    const state = mapRemoteWordbookState(vocabulary.states[wordId], row);
    if (!state) continue;
    vocabulary.states[wordId] = state;
    changed.add("vocabulary");
  }

  for (const row of rows(data.reviewItems)) {
    const id = typeof row.reviewItemId === "string" ? row.reviewItemId : "";
    const item = mapRemoteReviewItem(row, review.items[id]);
    if (!item) continue;
    review.items[id] = item;
    changed.add("review");
  }

  // Reading/listening answer imports are already represented by remote review
  // items. Mark their source events so a mounted ReviewProvider does not replay
  // an old wrong answer over a mastered item during its regular scan.
  for (const [module, sessions] of [["reading", reading.sessions], ["listening", listening.sessions]] as const) {
    for (const [sessionId, session] of Object.entries(sessions)) {
      for (const [questionId, answer] of Object.entries(session.lesson.records as Record<string, AnswerRecord>)) {
        if (answer.initialResult !== "wrong" || !answer.retest.length) continue;
        const activityId = module === "reading" ? (session as ReadingSession).articleId : (session as ListeningSession).materialId;
        const itemId = reviewItemId(module, activityId, questionId);
        if (!review.items[itemId]) {
          const wrongOptionId = [...answer.initial, ...answer.retest].find((attempt) => !attempt.correct)?.optionId;
          review.items = recordWrong(review.items, module, activityId, questionId,
            session.completedAt ?? new Date().toISOString(),
            answer.retest.some((attempt) => !attempt.correct) ? "wrong" : "second_try_correct",
            wrongOptionId);
          changed.add("review");
        }
        const eventId = JSON.stringify([module, sessionId, questionId, answer.retest.length]);
        review.importedEvents = { ...review.importedEvents, [eventId]: true };
        changed.add("review");
      }
    }
  }

  for (const row of rows(data.translationHistory)) {
    const entry = mapRemoteTranslationHistory(row);
    if (!entry || translation.history.some((item) => item.sessionId === entry.sessionId && item.taskId === entry.taskId)) continue;
    translation.history.push(entry);
    changed.add("translation");
  }
  for (const row of rows(data.writingHistory)) {
    const entry = mapRemoteWritingHistory(row);
    if (!entry || writing.history.some((item) => item.sessionId === entry.sessionId && item.taskId === entry.taskId)) continue;
    writing.history.push(entry);
    changed.add("writing");
  }

  for (const [date, dayPlan] of Object.entries(plan.plans)) {
    if (dayPlan.status !== "completed") continue;
    const key = `daily-plan-complete:${date}`;
    studyProfile.bonusXpEvents[key] ??= plan.completionLedger[key] ?? 10;
    studyChanged = true;
  }
  if (studyChanged) {
    studyRepository.saveProfile(studyProfile);
    changed.add("study");
  }
  if (changed.has("vocabulary")) saveVocabularyStore(storage, vocabulary);
  if (changed.has("reading")) saveReadingStore(storage, reading);
  if (changed.has("listening")) saveListeningStore(storage, listening);
  if (changed.has("translation")) saveTranslationStore(storage, translation);
  if (changed.has("writing")) saveWritingStore(storage, writing);
  if (changed.has("review")) saveReviewStore(storage as Storage, review);
  if (data.pulledAt) storage.setItem("cet-daily:v12:last-sync", JSON.stringify({ at: iso(data.pulledAt, new Date().toISOString()) }));
  return [...changed];
}
