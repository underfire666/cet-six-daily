import test from "node:test";
import assert from "node:assert/strict";
import { getReadingArticles, getTranslationTasks, getWritingTasks, getVocabulary, readingArticleById } from "../src/content/learning";
import { todayInShanghai } from "../src/lib/dates";
import { currentQuestion } from "../src/lib/lesson/session";
import { createProfile, totalXpFor, userFor } from "../src/lib/lesson/profile";
import { createStudyStorage } from "../src/lib/lesson/storage";
import { summarizeObjective, computeStudyStats } from "../src/lib/profile/stats";
import { loadProfile, PROFILE_KEY } from "../src/lib/profile/store";
import { emptyReadingStore, loadReadingStore, saveReadingStore } from "../src/lib/reading/storage";
import { startReading, updateReading } from "../src/lib/reading/store";
import { readingLesson } from "../src/lib/reading/questions";
import { emptyVocabularyStore, loadVocabularyStore, saveVocabularyStore } from "../src/lib/vocabulary/storage";
import { newVocabularyState } from "../src/lib/vocabulary/mastery";
import { emptyReviewStore, loadReviewStore, saveReviewStore } from "../src/lib/review/store";
import { recordWrong } from "../src/lib/review/scheduler";
import { emptyTranslationStore, loadTranslationStore, saveTranslationStore } from "../src/lib/translation/storage";
import { emptyWritingStore, loadWritingStore, saveWritingStore } from "../src/lib/writing/storage";
import { getStorageForNamespace } from "../src/lib/storage/scoped";
import { subscribeRemoteHydrate } from "../src/lib/storage/hydration-events";
import { hydrateFromPull } from "../src/lib/sync/hydrate";
import { applyPullToDomainStores } from "../src/lib/sync/restore";
import { buildGuestMigrationPlan } from "../src/lib/sync/migration";
import { enqueueXpEvent, setSyncUserId } from "../src/lib/sync/adapters";
import { loadQueue } from "../src/lib/sync/client";
import { readPullSnapshotForUser } from "../src/lib/sync/pull";
import { generatePlan } from "../src/lib/dailyPlan/generator";
import { emptyDailyPlanStore, loadDailyPlanStore, saveDailyPlanStore } from "../src/lib/dailyPlan/storage";

const DAY = "2026-09-23";
const START = "2026-09-23T09:00:00.000Z";
const DONE = "2026-09-23T09:15:00.000Z";

class MemoryStorage implements Storage {
  private data = new Map<string, string>();
  get length() { return this.data.size; }
  clear() { this.data.clear(); }
  key(index: number) { return [...this.data.keys()][index] ?? null; }
  getItem(key: string) { return this.data.get(key) ?? null; }
  setItem(key: string, value: string) { this.data.set(key, value); }
  removeItem(key: string) { this.data.delete(key); }
}

function installBrowser(storage = new MemoryStorage()) {
  const events = new EventTarget();
  const windowShim = {
    localStorage: storage,
    addEventListener: events.addEventListener.bind(events),
    removeEventListener: events.removeEventListener.bind(events),
    dispatchEvent: events.dispatchEvent.bind(events),
  };
  (globalThis as unknown as { window: typeof windowShim }).window = windowShim;
  (globalThis as unknown as { localStorage: Storage }).localStorage = storage;
  return storage;
}

function completeReading(id = "remote-reading") {
  let store = startReading(emptyReadingStore(), "daily", DAY, START, id).store;
  store = updateReading(store, id, { type: "start_quiz" }, START);
  const article = readingArticleById(store.sessions[id].articleId)!;
  const definition = readingLesson(article);
  for (let guard = 0; store.sessions[id].lesson.phase !== "complete" && guard < 50; guard++) {
    const lesson = store.sessions[id].lesson;
    if (lesson.phase === "feedback" || lesson.phase === "review_intro") {
      store = updateReading(store, id, { type: "lesson", action: { type: "continue", now: DONE, today: DAY } }, DONE);
    } else if (lesson.phase === "answering" || lesson.phase === "retry") {
      const question = currentQuestion(lesson, definition)!;
      store = updateReading(store, id, { type: "lesson", action: { type: "select", optionId: question.answerId } }, DONE);
      store = updateReading(store, id, { type: "lesson", action: { type: "check" } }, DONE);
    }
  }
  assert.equal(store.sessions[id].applied, true);
  return store.sessions[id];
}

function feedback() {
  return { score: 12, maxScore: 15, summary: "已完成", issues: [], details: [], provider: "mock" as const, createdAt: DONE };
}

test("profile pull restores the existing profile repository and emits a same-tab refresh", () => {
  const storage = installBrowser();
  setSyncUserId("device-b");
  let refreshed = 0;
  const unsubscribe = subscribeRemoteHydrate(["profile"], () => { refreshed++; });
  hydrateFromPull("device-b", { profile: { targetScore: 600, reminders: { evening: false }, createdAt: START, updatedAt: DONE } });
  const scoped = getStorageForNamespace({ type: "user", id: "device-b" })!;
  assert.equal(loadProfile(scoped as Storage).profile.targetScore, 600);
  assert.equal(loadProfile(scoped as Storage).profile.reminders.evening, false);
  assert.equal(refreshed, 1);
  assert.ok(storage.getItem("user:device-b:" + PROFILE_KEY));
  unsubscribe();
  setSyncUserId(null);
});

test("remote XP and completed session feed V11 XP, study-day, duration and accuracy selectors", () => {
  const storage = new MemoryStorage();
  const session = completeReading();
  const amount = session.rewardXp!;
  applyPullToDomainStores(storage, {
    xpEvents: [{ eventId: `reading:${session.id}`, source: "reading", sourceId: session.id, amount, earnedAt: DONE }],
    sessions: [{ id: session.id, module: "reading", activityId: session.articleId, planDate: DAY, startedAt: START, completedAt: DONE, status: "completed", payload: session }],
  });
  const restored = loadReadingStore(storage).store.sessions[session.id];
  assert.ok(restored, "the existing ReadingStore reader accepts the restored session");
  assert.ok(Object.keys(loadReadingStore(storage).store.xpLedger).some((key) => key.startsWith("reading:day:")));
  const profile = createStudyStorage(storage, () => {}).load(DAY).profile;
  assert.equal(totalXpFor(profile), amount);
  assert.equal(userFor(profile, DAY).level, 1);
  const objective = summarizeObjective(restored.lesson.records);
  const stats = computeStudyStats({
    completedDays: new Set(), totalXp: totalXpFor(profile), streak: userFor(profile, DAY).streak,
    level: userFor(profile, DAY).level, levelTitle: userFor(profile, DAY).title,
    objective, wrongCount: 0, wordbookCount: 0, dueReviewCount: 0, xpByDay: {},
    completedSessions: [{ startedAt: restored.startedAt, completedAt: restored.completedAt, day: todayInShanghai(new Date(restored.completedAt!)), rewardXp: restored.rewardXp }],
    today: DAY,
  });
  assert.equal(stats.studyDays, 1);
  assert.equal(stats.totalDurationSeconds, 900);
  assert.equal(stats.overallAccuracy, 100);
  assert.equal(stats.totalXp, amount);
});

test("daily lesson XP uses the Shanghai completion date across UTC midnight", () => {
  const storage = new MemoryStorage();
  applyPullToDomainStores(storage, { xpEvents: [{ eventId: "daily-lesson:2026-09-24", source: "daily_lesson", sourceId: "lesson-1", amount: 45, earnedAt: "2026-09-23T17:00:00.000Z" }] });
  const profile = createStudyStorage(storage, () => {}).load("2026-09-24").profile;
  assert.equal(profile.rewardsByDay["2026-09-24"]?.xp, 45);
  assert.equal(profile.rewardsByDay["2026-09-23"], undefined);
});

test("remote wordbook rows restore V4 states and retain versioned tombstones", () => {
  const storage = new MemoryStorage();
  const wordId = getVocabulary()[0].id;
  applyPullToDomainStores(storage, { wordbook: [{ wordId, source: "vocabulary", addedAt: START, updatedAt: START, version: 1, removedAt: null }] });
  let state = loadVocabularyStore(storage).store.states[wordId];
  assert.equal(state.addedToWordbook, true);
  assert.equal(state.wordbookVersion, 1);
  applyPullToDomainStores(storage, { wordbook: [{ wordId, source: "vocabulary", addedAt: START, updatedAt: DONE, version: 2, removedAt: DONE }] });
  state = loadVocabularyStore(storage).store.states[wordId];
  assert.equal(state.addedToWordbook, false);
  assert.equal(state.wordbookRemovedAt, DONE);
  assert.equal(state.wordbookVersion, 2);
});

test("review remote snapshot saves and reloads as schemaVersion 1 without losing mastery history", () => {
  const storage = new MemoryStorage();
  const item = Object.values(recordWrong({}, "reading", getReadingArticles()[0].id, "rq:q1", DONE, "wrong", "optA"))[0];
  item.version = 2;
  const row = { reviewItemId: item.id, sourceModule: item.sourceModule, activityId: item.sourceActivityId, questionId: item.questionId,
    status: "active", mastery: "learning", dueDate: item.nextReviewAt, priority: item.priority,
    version: 2, createdAt: item.createdAt, updatedAt: item.updatedAt, payload: item };
  applyPullToDomainStores(storage, { reviewItems: [row] });
  const raw = JSON.parse(storage.getItem("cet-daily:v1:review")!);
  assert.equal(raw.schemaVersion, 1);
  assert.equal(Array.isArray(raw.items), false);
  let reloaded = loadReviewStore(storage).store;
  assert.equal(reloaded.items[item.id].history.length, 1);
  assert.equal(reloaded.items[item.id].lastWrongOptionId, "optA");
  const mastered = { ...reloaded.items[item.id], masteryStatus: "mastered" as const, version: 3, updatedAt: new Date(Date.parse(DONE) + 1000).toISOString() };
  reloaded = { ...reloaded, items: { ...reloaded.items, [item.id]: mastered } };
  saveReviewStore(storage, reloaded);
  applyPullToDomainStores(storage, { reviewItems: [{ ...row, version: 4, updatedAt: new Date(Date.parse(DONE) + 2000).toISOString() }] });
  assert.equal(loadReviewStore(storage).store.items[item.id].masteryStatus, "mastered");
});

test("authenticated pull queries and returns translation and writing history", async () => {
  const calls: string[] = [];
  const one = (name: string, result: unknown) => ({ findUnique: async ({ where }: { where: { userId: string } }) => { calls.push(`${name}:${where.userId}`); return result; } });
  const many = (name: string, result: unknown[]) => ({ findMany: async ({ where }: { where: { userId: string } }) => { calls.push(`${name}:${where.userId}`); return result; } });
  const db = {
    profile: one("profile", null), studyPreferences: one("preferences", null), userSettings: one("settings", null),
    xpEvent: many("xp", []), learningSession: many("session", []), wordbookEntry: many("wordbook", []),
    reviewItem: many("review", []), dailyPlanState: many("plan", []),
    translationHistory: many("translation", [{ itemId: "t1" }]), writingHistory: many("writing", [{ itemId: "w1" }]),
  } as unknown as Parameters<typeof readPullSnapshotForUser>[1];
  const response = await readPullSnapshotForUser("authenticated-user", db);
  assert.equal(response.translationHistory.length, 1);
  assert.equal(response.writingHistory.length, 1);
  assert.ok(calls.every((entry) => entry.endsWith(":authenticated-user")));
});

test("translation and writing history hydrate into their existing repositories without duplicate rows", () => {
  const storage = new MemoryStorage();
  const t = getTranslationTasks()[0].id;
  const w = getWritingTasks()[0].id;
  const pull = {
    translationHistory: [{ itemId: "translation-session-1", promptId: t, answer: "A translated paragraph.", feedback: feedback(), createdAt: DONE }],
    writingHistory: [{ itemId: "writing-session-1", promptId: w, answer: "A short English essay.", feedback: feedback(), createdAt: DONE }],
  };
  applyPullToDomainStores(storage, pull);
  applyPullToDomainStores(storage, pull);
  assert.equal(loadTranslationStore(storage).store.history.length, 1);
  assert.equal(loadWritingStore(storage).store.history.length, 1);
  assert.equal(loadTranslationStore(storage).store.history[0].sessionId, "translation-session-1");
  assert.equal(loadWritingStore(storage).store.history[0].wordCount, 4);
});

test("remote hydrate keeps queue length fixed and isolates A, B and guest stores", () => {
  const storage = installBrowser();
  storage.setItem(PROFILE_KEY, JSON.stringify({ schemaVersion: 1, targetScore: 425, reminders: { evening: true, miss: true, lastChance: true }, createdAt: START, updatedAt: START }));
  setSyncUserId("A");
  enqueueXpEvent({ eventId: "queued-local", source: "reading", sourceId: "r1", amount: 5 });
  const before = loadQueue().length;
  const wordId = getVocabulary()[0].id;
  const readingSession = completeReading("queue-check-reading");
  const plan = generatePlan(DAY, "2026-12-19", emptyDailyPlanStore().preferences);
  hydrateFromPull("A", {
    profile: { targetScore: 600, createdAt: START, updatedAt: DONE },
    xpEvents: [{ eventId: `reading:${readingSession.id}`, source: "reading", sourceId: readingSession.id, amount: readingSession.rewardXp, earnedAt: DONE }],
    sessions: [{ id: readingSession.id, module: "reading", payload: readingSession }],
    wordbook: [{ wordId, source: "vocabulary", addedAt: START, updatedAt: DONE, version: 1 }],
    dailyPlans: [{ planDate: DAY, payload: { plan, completedTaskIds: [] } }],
  });
  assert.equal(loadQueue().length, before);
  assert.equal(loadProfile(getStorageForNamespace({ type: "user", id: "A" }) as Storage).profile.targetScore, 600);
  setSyncUserId("B");
  hydrateFromPull("B", { profile: { targetScore: 550, createdAt: START, updatedAt: DONE } });
  assert.equal(loadProfile(getStorageForNamespace({ type: "user", id: "B" }) as Storage).profile.targetScore, 550);
  assert.equal(loadProfile(getStorageForNamespace({ type: "user", id: "A" }) as Storage).profile.targetScore, 600);
  setSyncUserId(null);
  assert.deepEqual(hydrateFromPull("A", { profile: { targetScore: 500 } }), []);
  assert.equal(loadProfile(storage).profile.targetScore, 425);
});

test("guest migration detects current daily plan and preference changes", () => {
  const guest = new MemoryStorage();
  const store = emptyDailyPlanStore();
  store.preferences = { ...store.preferences, intensity: "intense" };
  store.plans[DAY] = generatePlan(DAY, store.preferences.examDate, store.preferences);
  store.plans[DAY].adjusted = true;
  saveDailyPlanStore(guest, store);
  const plan = buildGuestMigrationPlan(guest, "guest-plan", DAY);
  assert.equal(plan.preview.hasData, true);
  assert.ok(plan.mutations.some((mutation) => mutation.entityType === "preferences"));
  assert.ok(plan.mutations.some((mutation) => mutation.entityType === "dailyPlan"));
  const target = new MemoryStorage();
  applyPullToDomainStores(target, {
    preferences: { payload: store.preferences },
    dailyPlans: [{ planDate: DAY, payload: { plan: store.plans[DAY], completedTaskIds: [] } }],
  });
  assert.equal(loadDailyPlanStore(target).store.preferences.intensity, "intense");
  assert.equal(loadDailyPlanStore(target).store.plans[DAY].adjusted, true);
});

test("current guest repositories drive migration detection, preview and payload", () => {
  const guest = new MemoryStorage();
  createStudyStorage(guest, () => {}).saveProfile({ ...createProfile(DAY), bonusXpEvents: { "reading:remote-reading": 17 } });
  const readingSession = completeReading();
  saveReadingStore(guest, { ...emptyReadingStore(), sessions: { [readingSession.id]: readingSession } });
  const word = getVocabulary()[0];
  const state = { ...newVocabularyState(word, START), addedToWordbook: true };
  saveVocabularyStore(guest, { ...emptyVocabularyStore(), states: { [word.id]: state } });
  const wrongItem = Object.values(recordWrong({}, "reading", readingSession.articleId, "rq:q1", DONE, "wrong"))[0];
  saveReviewStore(guest, { ...emptyReviewStore(), items: { [wrongItem.id]: wrongItem } });
  const t = getTranslationTasks()[0].id;
  const w = getWritingTasks()[0].id;
  saveTranslationStore(guest, { ...emptyTranslationStore(), history: [{ taskId: t, sessionId: "t1", submittedText: "answer", feedback: feedback(), score: 12, createdAt: DONE }] });
  saveWritingStore(guest, { ...emptyWritingStore(), history: [{ taskId: w, sessionId: "w1", submittedText: "essay", feedback: feedback(), score: 12, wordCount: 1, createdAt: DONE }] });
  const before = guest.getItem("cet-daily:v3:vocabulary");
  const first = buildGuestMigrationPlan(guest, "guest-1", DAY);
  assert.equal(first.preview.hasData, true);
  assert.equal(first.preview.xp, 17);
  assert.equal(first.preview.studyDays, 1);
  assert.equal(first.preview.sessionCount, 1);
  assert.equal(first.preview.wordCount, 1);
  assert.equal(first.preview.wrongCount, 1);
  assert.equal(first.preview.translationCount, 1);
  assert.equal(first.preview.writingCount, 1);
  for (const entity of ["xpEvent", "session", "wordbook", "reviewItem", "translationHistory", "writingHistory"]) {
    assert.ok(first.mutations.some((mutation) => mutation.entityType === entity), `${entity} must be included`);
  }
  // "Later" leaves the current repositories intact and no completed flag is written.
  const again = buildGuestMigrationPlan(guest, "guest-1", DAY);
  assert.equal(again.preview.hasData, true);
  assert.equal(guest.getItem("cet-daily:v3:vocabulary"), before);
  assert.equal(guest.getItem("cet-daily:v12:guest-migrated-to"), null);
});
