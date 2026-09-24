/** Read the current guest repositories and prepare one transactional import. */
import { todayInShanghai } from "@/lib/dates";
import { createStudyStorage, defaultSettings, type KeyStorage } from "@/lib/lesson/storage";
import { totalXpFor } from "@/lib/lesson/profile";
import { loadProfile, PROFILE_KEY } from "@/lib/profile/store";
import { loadVocabularyStore } from "@/lib/vocabulary/storage";
import { loadReadingStore } from "@/lib/reading/storage";
import { loadListeningStore } from "@/lib/listening/storage";
import { loadTranslationStore } from "@/lib/translation/storage";
import { loadWritingStore } from "@/lib/writing/storage";
import { loadReviewStore } from "@/lib/review/store";
import { loadDailyPlanStore, DAILY_PLAN_KEY } from "@/lib/dailyPlan/storage";
import { DEFAULT_PREFERENCES } from "@/lib/dailyPlan/config";
import { toRemoteMastery } from "./domain-mappers";
import type { SyncMutationInput } from "./server";

export interface GuestMigrationPreview {
  hasData: boolean;
  xp: number;
  studyDays: number;
  sessionCount: number;
  wordCount: number;
  wrongCount: number;
  translationCount: number;
  writingCount: number;
}

export interface GuestMigrationPlan {
  preview: GuestMigrationPreview;
  mutations: SyncMutationInput[];
}

function noon(date: string): string {
  return new Date(`${date}T12:00:00+08:00`).toISOString();
}

function sourceFor(eventId: string): string {
  const source = eventId.split(":")[0];
  return ["vocabulary", "reading", "listening", "review", "translation", "writing", "daily_lesson", "achievement", "bonus"].includes(source)
    ? source
    : "bonus";
}

/** This function reads only the guest namespace passed by the caller. */
export function buildGuestMigrationPlan(storage: KeyStorage, migrationId: string, today = todayInShanghai()): GuestMigrationPlan {
  const hasStoredProfile = storage.getItem(PROFILE_KEY) !== null;
  const hasStoredDailyPlan = storage.getItem(DAILY_PLAN_KEY) !== null;
  const profile = loadProfile(storage as Storage).profile;
  const study = createStudyStorage(storage, () => {}).load(today);
  const vocabulary = loadVocabularyStore(storage).store;
  const reading = loadReadingStore(storage).store;
  const listening = loadListeningStore(storage).store;
  const translation = loadTranslationStore(storage).store;
  const writing = loadWritingStore(storage).store;
  const review = loadReviewStore(storage as Storage).store;
  const dailyPlan = loadDailyPlanStore(storage).store;
  const mutations: SyncMutationInput[] = [];
  const add = (entityType: SyncMutationInput["entityType"], entityId: string, payload: Record<string, unknown>, operation: SyncMutationInput["operation"] = "upsert") => {
    mutations.push({ mutationId: `guest:${migrationId}:${entityType}:${entityId}`, entityType, entityId, operation, payload });
  };

  if (hasStoredProfile || hasStoredDailyPlan) {
    add("profile", "me", {
      targetScore: profile.targetScore,
      reminders: profile.reminders,
      examDate: dailyPlan.preferences.examDate,
    });
  }
  if (hasStoredDailyPlan) add("preferences", "me", { payload: dailyPlan.preferences });
  if (storage.getItem("cet-daily:v2:settings") !== null && JSON.stringify(study.settings) !== JSON.stringify(defaultSettings)) {
    add("settings", "me", { payload: { feedback: study.settings } });
  }

  const completedDates = new Set<string>([
    ...Object.keys(study.profile.rewardsByDay),
    ...Object.keys(dailyPlan.completionLedger).map((key) => key.slice("daily-plan-complete:".length)),
  ]);
  const allSessions = [
    ...Object.values(study.sessions).map((session) => ({ module: "daily", id: session.id, activityId: `${session.date}:${session.mode}`, planDate: session.date, startedAt: session.startedAt, completedAt: session.completedAt, applied: session.phase === "complete", payload: session })),
    ...Object.values(vocabulary.sessions).map((session) => ({ module: "vocabulary", id: session.id, activityId: session.wordIds.join(","), planDate: session.date, startedAt: session.lesson.startedAt, completedAt: session.completedAt, applied: session.applied, payload: session })),
    ...Object.values(reading.sessions).map((session) => ({ module: "reading", id: session.id, activityId: session.articleId, planDate: session.planDate, startedAt: session.startedAt, completedAt: session.completedAt, applied: session.applied, payload: session })),
    ...Object.values(listening.sessions).map((session) => ({ module: "listening", id: session.id, activityId: session.materialId, planDate: session.planDate, startedAt: session.startedAt, completedAt: session.completedAt, applied: session.applied, payload: session })),
    ...Object.values(translation.sessions).map((session) => ({ module: "translation", id: session.id, activityId: session.taskId, planDate: session.planDate, startedAt: session.startedAt, completedAt: session.completedAt, applied: session.applied, payload: session })),
    ...Object.values(writing.sessions).map((session) => ({ module: "writing", id: session.id, activityId: session.taskId, planDate: session.planDate, startedAt: session.startedAt, completedAt: session.completedAt, applied: session.applied, payload: session })),
    ...Object.values(review.sessions).map((session) => ({ module: "review", id: session.id, activityId: session.id, planDate: session.date, startedAt: session.startedAt, completedAt: session.completedAt, applied: session.applied, payload: session })),
  ];
  for (const session of allSessions) {
    add("session", session.id, {
      sessionId: session.id,
      module: session.module,
      activityId: session.activityId,
      planDate: session.planDate,
      startedAt: session.startedAt,
      completedAt: session.completedAt,
      status: session.applied ? "completed" : "in_progress",
      payload: session.payload as unknown as Record<string, unknown>,
    });
    if (session.applied && session.completedAt) completedDates.add(todayInShanghai(new Date(session.completedAt)));
  }

  for (const [date, reward] of Object.entries(study.profile.rewardsByDay)) {
    if (reward.xp <= 0) continue;
    add("xpEvent", `daily-lesson:${date}`, {
      eventId: `daily-lesson:${date}`,
      source: "daily_lesson",
      sourceId: reward.sessionId,
      amount: reward.xp,
      earnedAt: noon(date),
    });
  }
  for (const [eventId, amount] of Object.entries(study.profile.bonusXpEvents ?? {})) {
    if (amount <= 0) continue;
    const date = /^daily-plan-complete:(\d{4}-\d{2}-\d{2})$/.exec(eventId)?.[1];
    const matchingSession = allSessions.find((session) => `${session.module}:${session.id}` === eventId || `review-session:${session.id}` === eventId);
    add("xpEvent", eventId, {
      eventId,
      source: sourceFor(eventId),
      sourceId: eventId,
      amount,
      earnedAt: matchingSession?.completedAt ?? (date ? noon(date) : new Date().toISOString()),
    });
  }

  for (const state of Object.values(vocabulary.states)) {
    if (!state.addedToWordbook && !state.wordbookRemovedAt) continue;
    add("wordbook", state.wordId, {
      wordId: state.wordId,
      source: state.source,
      addedAt: state.wordbookAddedAt ?? state.firstSeenAt,
      removedAt: state.wordbookRemovedAt ?? null,
      updatedAt: state.wordbookUpdatedAt ?? state.wordbookRemovedAt ?? state.firstSeenAt,
      version: state.wordbookVersion ?? 1,
    }, state.addedToWordbook ? "upsert" : "remove");
  }
  for (const item of Object.values(review.items)) {
    add("reviewItem", item.id, {
      reviewItemId: item.id,
      sourceModule: item.sourceModule,
      activityId: item.sourceActivityId,
      questionId: item.questionId,
      status: item.removed ? "removed" : item.masteryStatus === "mastered" ? "mastered" : "active",
      mastery: toRemoteMastery(item.masteryStatus),
      dueDate: item.nextReviewAt,
      priority: item.priority,
      version: item.version ?? 1,
      removedAt: item.removed ? item.updatedAt : null,
      payload: item,
    }, item.removed ? "remove" : "upsert");
  }
  for (const [date, plan] of Object.entries(dailyPlan.plans)) {
    add("dailyPlan", date, {
      plan,
      completedTaskIds: plan.status === "completed" ? plan.tasks.filter((task) => !task.removed).map((task) => task.id) : [],
    });
  }
  for (const entry of translation.history) {
    const id = entry.sessionId ?? `${entry.taskId}:${entry.createdAt}`;
    add("translationHistory", id, {
      itemId: id, promptId: entry.taskId, answer: entry.submittedText,
      feedback: entry.feedback as unknown as Record<string, unknown>, createdAt: entry.createdAt,
    });
  }
  for (const entry of writing.history) {
    const id = entry.sessionId ?? `${entry.taskId}:${entry.createdAt}`;
    add("writingHistory", id, {
      itemId: id, promptId: entry.taskId, answer: entry.submittedText,
      feedback: entry.feedback as unknown as Record<string, unknown>, createdAt: entry.createdAt,
    });
  }

  const sessionCount = allSessions.filter((session) => session.applied).length;
  const wordCount = Object.values(vocabulary.states).filter((state) => state.addedToWordbook).length;
  const wrongCount = Object.values(review.items).filter((item) => !item.removed).length;
  const xp = totalXpFor(study.profile);
  const profileChanged = hasStoredProfile && (profile.targetScore !== 500 || !profile.reminders.evening || !profile.reminders.miss || !profile.reminders.lastChance);
  const meaningfulPlan = Object.values(dailyPlan.plans).some((plan) => plan.status === "completed" || plan.adjusted) || dailyPlan.customizedDates.length > 0 || Object.keys(dailyPlan.completionLedger).length > 0;
  const preferencesChanged = hasStoredDailyPlan && JSON.stringify(dailyPlan.preferences) !== JSON.stringify(DEFAULT_PREFERENCES);
  const settingsChanged = JSON.stringify(study.settings) !== JSON.stringify(defaultSettings);
  const hasData = xp > 0 || allSessions.length > 0 || wordCount > 0 || wrongCount > 0 || translation.history.length > 0 || writing.history.length > 0 || profileChanged || meaningfulPlan || preferencesChanged || settingsChanged;
  return {
    preview: { hasData, xp, studyDays: completedDates.size, sessionCount, wordCount, wrongCount, translationCount: translation.history.length, writingCount: writing.history.length },
    mutations: hasData ? mutations : [],
  };
}
