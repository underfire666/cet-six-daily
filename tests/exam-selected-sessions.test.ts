import test from "node:test";
import assert from "node:assert/strict";
import { getExamCatalog, type ExamModule } from "../src/content/exam-catalog";
import { readingArticleById, listeningMaterialById, translationTaskById, writingTaskById } from "../src/content/learning";
import { resolveContentById } from "../src/content/registry";
import { currentQuestion } from "../src/lib/lesson/session";
import { readingLesson } from "../src/lib/reading/questions";
import { listeningLesson } from "../src/lib/listening/questions";
import { startReading, startSelectedReading, updateReading, readingDayStats } from "../src/lib/reading/store";
import { startListening, startSelectedListening, updateListening, listeningDayStats, listeningResumeSessions } from "../src/lib/listening/store";
import { startTranslation, startSelectedTranslation, updateTranslation, translationDayStats, translationResumeSessions } from "../src/lib/translation/store";
import { startWriting, startSelectedWriting, updateWriting, writingDayStats, writingResumeSessions } from "../src/lib/writing/store";
import { emptyReadingStore, loadReadingStore, saveReadingStore } from "../src/lib/reading/storage";
import { emptyListeningStore, loadListeningStore, saveListeningStore } from "../src/lib/listening/storage";
import { emptyTranslationStore, loadTranslationStore, saveTranslationStore } from "../src/lib/translation/storage";
import { emptyWritingStore, loadWritingStore, saveWritingStore } from "../src/lib/writing/storage";
import { applyPullToDomainStores } from "../src/lib/sync/restore";
import type { KeyStorage } from "../src/lib/lesson/storage";
import type { ReadingStore } from "../src/types/reading";
import type { ListeningStore } from "../src/types/listening";
import type { TranslationStore } from "../src/types/translation";
import type { WritingStore } from "../src/types/writing";

const DAY = "2026-10-08";
const NEXT_DAY = "2026-10-09";
const NOW = "2026-10-08T10:00:00.000+08:00";
const NEXT_NOW = "2026-10-09T10:00:00.000+08:00";

function memory(): KeyStorage {
  const data = new Map<string, string>();
  return {
    getItem: key => data.get(key) ?? null,
    setItem: (key, value) => { data.set(key, value); },
    removeItem: key => { data.delete(key); },
    key: index => [...data.keys()][index] ?? null,
    get length() { return data.size; },
  };
}

function finishReading(initial: ReadingStore, id: string): ReadingStore {
  let store = updateReading(initial, id, { type: "start_quiz" }, NOW);
  const definition = readingLesson(readingArticleById(store.sessions[id].articleId)!);
  let guard = 0;
  while (store.sessions[id].phase !== "complete" && guard++ < 100) {
    const lesson = store.sessions[id].lesson;
    if (lesson.phase === "answering") {
      const question = currentQuestion(lesson, definition)!;
      store = updateReading(store, id, { type: "lesson", action: { type: "select", optionId: question.answerId } }, NOW);
      store = updateReading(store, id, { type: "lesson", action: { type: "check" } }, NOW);
    } else {
      store = updateReading(store, id, { type: "lesson", action: { type: "continue", now: NOW, today: DAY } }, NOW);
    }
  }
  assert.equal(store.sessions[id].phase, "complete");
  return store;
}

function finishListening(initial: ListeningStore, id: string): ListeningStore {
  let store = updateListening(initial, id, { type: "start_question" }, NOW);
  const definition = listeningLesson(listeningMaterialById(store.sessions[id].materialId)!);
  let guard = 0;
  while (store.sessions[id].phase !== "complete" && guard++ < 100) {
    const lesson = store.sessions[id].lesson;
    if (lesson.phase === "answering") {
      const question = currentQuestion(lesson, definition)!;
      store = updateListening(store, id, { type: "lesson", action: { type: "select", optionId: question.answerId } }, NOW);
      store = updateListening(store, id, { type: "lesson", action: { type: "check" } }, NOW);
    } else {
      store = updateListening(store, id, { type: "lesson", action: { type: "continue", now: NOW, today: DAY } }, NOW);
    }
  }
  assert.equal(store.sessions[id].phase, "complete");
  return store;
}

function finishTranslation(store: TranslationStore, id: string): TranslationStore {
  const task = translationTaskById(store.sessions[id].taskId)!;
  store = updateTranslation(store, id, { type: "set_draft", draft: task.referenceTranslation }, NOW);
  store = updateTranslation(store, id, { type: "submit", now: NOW }, NOW);
  return updateTranslation(store, id, { type: "finish", now: NOW }, NOW);
}

function finishWriting(store: WritingStore, id: string): WritingStore {
  const task = writingTaskById(store.sessions[id].taskId)!;
  store = updateWriting(store, id, { type: "set_draft", draft: task.referenceEssay }, NOW);
  store = updateWriting(store, id, { type: "submit", now: NOW }, NOW);
  return updateWriting(store, id, { type: "finish", now: NOW }, NOW);
}

interface SelectionStore {
  daily: Record<string, unknown>;
  sessions: Record<string, { id: string; mode: string; phase: string; applied: boolean; rewardXp?: number }>;
  xpLedger: Record<string, number>;
}

interface SelectionHarness<S extends SelectionStore> {
  module: ExamModule;
  empty: () => S;
  start: (store: S, mode: "daily" | "extra", date: string, now: string, id: string) => { store: S; id?: string };
  selected: (store: S, contentId: string, date: string, now: string, id: string) => { store: S; id?: string };
  change: (store: S, id: string) => S;
  finish: (store: S, id: string) => S;
  contentId: (store: S, id: string) => string;
  save: (storage: KeyStorage | undefined, store: S) => boolean;
  load: (storage: KeyStorage | undefined) => { store: S; issue?: string };
  stats: (store: S, date: string) => { extra: number; xp: number };
}

function selectionTests<S extends SelectionStore>(h: SelectionHarness<S>) {
  const contentId = getExamCatalog()[0].exercises[h.module][0].id;

  test(`选练 ${h.module}：精确选择不受每日门槛限制，保留已存在每日任务`, () => {
    const baseline = h.start(h.empty(), "daily", DAY, NOW, "daily").store;
    const result = h.selected(baseline, contentId, DAY, NOW, "selected");
    assert.equal(result.id, "selected");
    assert.equal(h.contentId(result.store, "selected"), contentId);
    assert.equal(result.store.sessions.selected.mode, "selected");
    assert.strictEqual(result.store.daily, baseline.daily);
    assert.strictEqual(result.store.sessions.daily, baseline.sessions.daily);
    assert.strictEqual(result.store.xpLedger, baseline.xpLedger);
    assert.equal(h.stats(result.store, DAY).extra, 0);
  });

  test(`选练 ${h.module}：跨日继续同一内容，仅复用尚未完成的选练`, () => {
    const first = h.selected(h.empty(), contentId, DAY, NOW, "first");
    const changed = h.change(first.store, "first");
    const resumed = h.selected(changed, contentId, NEXT_DAY, NEXT_NOW, "unused");
    assert.equal(resumed.id, "first");
    assert.strictEqual(resumed.store, changed);
    assert.equal(resumed.store.sessions.first.mode, "selected");
    const another = getExamCatalog()[0].exercises[h.module][1]?.id
      ?? getExamCatalog()[1].exercises[h.module][0].id;
    assert.notEqual(another, contentId);
    const separate = h.selected(changed, another, DAY, NOW, "separate");
    assert.equal(separate.id, "separate");
    assert.ok(separate.store.sessions.first);
  });

  test(`选练 ${h.module}：每日与额外入口不会借用未完成选练`, () => {
    const selected = h.selected(h.empty(), contentId, DAY, NOW, "selected").store;
    const daily = h.start(selected, "daily", DAY, NOW, "daily");
    assert.equal(daily.id, "daily");
    assert.equal(daily.store.sessions.daily.mode, "daily");
    const blockedExtra = h.start(selected, "extra", DAY, NOW, "extra");
    assert.equal(blockedExtra.id, undefined);
    assert.strictEqual(blockedExtra.store, selected);
  });

  test(`选练 ${h.module}：未知、Mock、PRIVATE 与不在目录内的 ID 均拒绝`, () => {
    const baseline = h.empty();
    for (const invalid of ["missing", "reading-1", "listening-1", "translation-1", "writing-1", "PRIVATE:user:paper:question", "REAL:CET6:2024:06:set1:reading:1"]) {
      const result = h.selected(baseline, invalid, DAY, NOW, "rejected");
      assert.equal(result.id, undefined);
      assert.strictEqual(result.store, baseline);
    }
  });

  test(`选练 ${h.module}：已下线内容不允许创建或继续选练`, () => {
    const initial = h.selected(h.empty(), contentId, DAY, NOW, "initial").store;
    const item = resolveContentById<{ status: string }>(contentId)!;
    const original = item.status;
    try {
      item.status = "deprecated";
      const result = h.selected(initial, contentId, DAY, NOW, "rejected");
      assert.equal(result.id, undefined);
      assert.strictEqual(result.store, initial);
    } finally {
      item.status = original;
    }
  });

  test(`选练 ${h.module}：刷新完整保留答题状态、速度或草稿`, () => {
    const storage = memory();
    const initial = h.selected(h.empty(), contentId, DAY, NOW, "selected").store;
    const changed = h.change(initial, "selected");
    assert.equal(h.save(storage, changed), true);
    const restored = h.load(storage);
    assert.equal(restored.issue, undefined);
    assert.deepEqual(restored.store, changed);
    assert.equal(h.selected(restored.store, contentId, DAY, NOW, "unused").id, "selected");
  });

  test(`选练 ${h.module}：完成不增加每日或额外计数，重练沿用 XP 去重账本`, () => {
    const baseline = h.start(h.empty(), "daily", DAY, NOW, "daily").store;
    const first = h.selected(baseline, contentId, DAY, NOW, "first").store;
    const completed = h.finish(first, "first");
    assert.equal(completed.sessions.first.phase, "complete");
    assert.ok(completed.sessions.first.applied);
    assert.ok((completed.sessions.first.rewardXp ?? 0) > 0);
    assert.strictEqual(completed.daily, baseline.daily);
    assert.equal(h.stats(completed, DAY).extra, 0);
    const second = h.selected(completed, contentId, DAY, NOW, "second");
    assert.equal(second.id, "second");
    const repeated = h.finish(second.store, "second");
    assert.equal(repeated.sessions.second.rewardXp, 0);
    assert.deepEqual(repeated.xpLedger, completed.xpLedger);
    assert.strictEqual(repeated.daily, baseline.daily);
    const storage = memory();
    h.save(storage, repeated);
    assert.deepEqual(h.load(storage).store, repeated);
  });

  test(`选练 ${h.module}：与每日练习共享去重账本，不重复奖励同一内容`, () => {
    const daily = h.start(h.empty(), "daily", DAY, NOW, "daily").store;
    const dailyContent = h.contentId(daily, "daily");
    const completedDaily = h.finish(daily, "daily");
    const afterDaily = h.finish(h.selected(completedDaily, dailyContent, DAY, NOW, "selected").store, "selected");
    assert.equal(afterDaily.sessions.selected.rewardXp, 0);
    assert.deepEqual(afterDaily.xpLedger, completedDaily.xpLedger);
    assert.strictEqual(afterDaily.daily, completedDaily.daily);
    const completedSelected = h.finish(h.selected(daily, dailyContent, DAY, NOW, "selected-first").store, "selected-first");
    const dailyAfterSelected = h.finish(completedSelected, "daily");
    assert.equal(dailyAfterSelected.sessions.daily.rewardXp, 0);
    assert.deepEqual(dailyAfterSelected.xpLedger, completedSelected.xpLedger);
    assert.deepEqual(dailyAfterSelected.daily, completedDaily.daily);
  });

  test(`选练 ${h.module}：同步恢复完成记录与 XP 去重，保留每日计划`, () => {
    const storage = memory();
    const baseline = h.start(h.empty(), "daily", DAY, NOW, "local-daily").store;
    h.save(storage, baseline);
    const completed = h.finish(h.selected(h.empty(), contentId, DAY, NOW, "remote-selected").store, "remote-selected");
    const snapshot = completed.sessions["remote-selected"];
    const pull = { sessions: [{ id: snapshot.id, module: h.module, payload: snapshot }] };
    assert.ok(applyPullToDomainStores(storage, pull).includes(h.module));
    applyPullToDomainStores(storage, pull);
    const restored = h.load(storage).store;
    assert.deepEqual(restored.sessions["remote-selected"], snapshot);
    assert.deepEqual(restored.daily, baseline.daily);
    assert.equal(h.stats(restored, DAY).extra, 0);
    const repeated = h.finish(h.selected(restored, contentId, DAY, NOW, "local-repeat").store, "local-repeat");
    assert.equal(repeated.sessions["local-repeat"].rewardXp, 0);
    assert.deepEqual(repeated.xpLedger, restored.xpLedger);
    assert.deepEqual(repeated.daily, baseline.daily);
  });
}

selectionTests<ReadingStore>({
  module: "reading", empty: emptyReadingStore, start: startReading, selected: startSelectedReading,
  change: (initial, id) => {
    let store = updateReading(initial, id, { type: "start_quiz" }, NOW);
    const question = readingArticleById(store.sessions[id].articleId)!.questions[0];
    store = updateReading(store, id, { type: "lesson", action: { type: "select", optionId: question.answerId } }, NOW);
    return store;
  },
  finish: finishReading, contentId: (store, id) => store.sessions[id].articleId,
  save: saveReadingStore, load: loadReadingStore, stats: readingDayStats,
});

selectionTests<ListeningStore>({
  module: "listening", empty: emptyListeningStore, start: startListening, selected: startSelectedListening,
  change: (store, id) => {
    store = updateListening(store, id, { type: "record_play" }, NOW);
    return updateListening(store, id, { type: "set_rate", rate: 0.8 }, NOW);
  },
  finish: finishListening, contentId: (store, id) => store.sessions[id].materialId,
  save: saveListeningStore, load: loadListeningStore, stats: listeningDayStats,
});

selectionTests<TranslationStore>({
  module: "translation", empty: emptyTranslationStore, start: startTranslation, selected: startSelectedTranslation,
  change: (store, id) => updateTranslation(store, id, { type: "set_draft", draft: "My saved translation draft." }, NOW),
  finish: finishTranslation, contentId: (store, id) => store.sessions[id].taskId,
  save: saveTranslationStore, load: loadTranslationStore, stats: translationDayStats,
});

selectionTests<WritingStore>({
  module: "writing", empty: emptyWritingStore, start: startWriting, selected: startSelectedWriting,
  change: (store, id) => updateWriting(store, id, { type: "set_draft", draft: "My saved writing draft." }, NOW),
  finish: finishWriting, contentId: (store, id) => store.sessions[id].taskId,
  save: saveWritingStore, load: loadWritingStore, stats: writingDayStats,
});

test("共用听力与阅读：第3套回到规范内容 ID 后继续同一选练记录", () => {
  const catalog = getExamCatalog();
  const sharedListening = catalog.find(entry => entry.listeningSharedWith === "2")!;
  const originalListening = catalog.find(entry => entry.year === sharedListening.year && entry.period === sharedListening.period && entry.set === "2")!;
  assert.equal(sharedListening.exercises.listening[0].id, originalListening.exercises.listening[0].id);
  const listening = startSelectedListening(emptyListeningStore(), originalListening.exercises.listening[0].id, DAY, NOW, "listening");
  assert.equal(startSelectedListening(listening.store, sharedListening.exercises.listening[0].id, DAY, NOW, "unused").id, "listening");
  const sharedReading = catalog.find(entry => entry.readingSharedWith)!;
  const originalReading = catalog.find(entry => entry.year === sharedReading.year && entry.period === sharedReading.period && entry.set === sharedReading.readingSharedWith)!;
  assert.equal(sharedReading.exercises.reading[0].id, originalReading.exercises.reading[0].id);
  const reading = startSelectedReading(emptyReadingStore(), originalReading.exercises.reading[0].id, DAY, NOW, "reading");
  assert.equal(startSelectedReading(reading.store, sharedReading.exercises.reading[0].id, DAY, NOW, "unused").id, "reading");
});

test("选练：听力、翻译和写作未完成记录不进入每日/额外恢复入口", () => {
  const entry = getExamCatalog()[0];
  const listening = startSelectedListening(emptyListeningStore(), entry.exercises.listening[0].id, DAY, NOW, "l").store;
  const translation = startSelectedTranslation(emptyTranslationStore(), entry.exercises.translation[0].id, DAY, NOW, "t").store;
  const writing = startSelectedWriting(emptyWritingStore(), entry.exercises.writing[0].id, DAY, NOW, "w").store;
  for (const entries of [listeningResumeSessions(listening, DAY), translationResumeSessions(translation, DAY), writingResumeSessions(writing, DAY)]) {
    assert.equal(entries.active, undefined);
    assert.equal(entries.previousDaily, undefined);
    assert.equal(entries.extraActive, undefined);
  }
});
