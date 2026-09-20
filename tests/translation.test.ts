import test from "node:test";
import assert from "node:assert/strict";
import {
  translationTaskById,
} from "../src/data/mockTranslation";
import {
  emptyTranslationStore,
  loadTranslationStore,
  saveTranslationStore,
} from "../src/lib/translation/storage";
import {
  planFor,
  startTranslation,
  updateTranslation,
  translationDayStats,
  pickDailyTranslation,
  translationResumeSessions,
  deleteTranslationHistory,
} from "../src/lib/translation/store";
import { translationXp, TRANSLATION_BASE_XP } from "../src/lib/translation/xp";

const DAY = "2026-09-20";
const NEXT_DAY = "2026-09-21";
const NOW = "2026-09-20T10:00:00.000+08:00";
const NOW_NEXT = "2026-09-21T10:00:00.000+08:00";

function memory() {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    key: (i: number) => [...data.keys()][i] ?? null,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
    removeItem: (key: string) => {
      data.delete(key);
    },
  };
}

test("翻译：每日任务生成且同一天结果稳定", () => {
  const a = pickDailyTranslation(DAY);
  const b = pickDailyTranslation(DAY);
  assert.deepEqual(a, b);
  assert.equal(a.length, 1);
  assert.ok(translationTaskById(a[0]));
  const c = pickDailyTranslation(NEXT_DAY);
  // 至少换一天结果有变化的概率高；不强制断言不同
  assert.ok(Array.isArray(c));
});

test("翻译：草稿自动保存到 session.draft", () => {
  let store = startTranslation(emptyTranslationStore(), "daily", DAY, NOW, "s1").store;
  store = updateTranslation(store, "s1", { type: "set_draft", draft: "Spring Festival is..." }, NOW);
  assert.equal(store.sessions.s1.draft, "Spring Festival is...");
  assert.equal(store.sessions.s1.phase, "drafting");
});

test("翻译：刷新恢复草稿（重新 load store 后 draft 仍在）", () => {
  const m = memory();
  let store = startTranslation(emptyTranslationStore(), "daily", DAY, NOW, "s2").store;
  store = updateTranslation(store, "s2", { type: "set_draft", draft: "half-written..." }, NOW);
  saveTranslationStore(m, store);
  const reloaded = loadTranslationStore(m).store;
  assert.equal(reloaded.sessions.s2.draft, "half-written...");
  assert.equal(reloaded.sessions.s2.phase, "drafting");
});

test("翻译：空内容不能提交", () => {
  let store = startTranslation(emptyTranslationStore(), "daily", DAY, NOW, "s3").store;
  store = updateTranslation(store, "s3", { type: "set_draft", draft: "   " }, NOW);
  const before = store;
  const after = updateTranslation(store, "s3", { type: "submit", now: NOW }, NOW);
  assert.equal(after, before);
  assert.equal(store.sessions.s3.phase, "drafting");
});

test("翻译：提交后产生 Mock Feedback，provider=mock", () => {
  let store = startTranslation(emptyTranslationStore(), "daily", DAY, NOW, "s4").store;
  const task = translationTaskById(store.sessions.s4.taskId)!;
  store = updateTranslation(
    store,
    "s4",
    { type: "set_draft", draft: task.referenceTranslation },
    NOW,
  );
  store = updateTranslation(store, "s4", { type: "submit", now: NOW }, NOW);
  assert.equal(store.sessions.s4.phase, "reviewing");
  const fb = store.sessions.s4.feedback!;
  assert.equal(fb.provider, "mock");
  assert.ok(fb.score >= 0 && fb.score <= fb.maxScore);
  assert.ok(fb.summary.length > 0);
});

test("翻译：参考译文只在提交后才在 session 中可见（drafting 阶段前端不应读）", () => {
  // 数据层：task 本身带 referenceTranslation；session.drafting 阶段不向结果页暴露
  let store = startTranslation(emptyTranslationStore(), "daily", DAY, NOW, "s5").store;
  const task = translationTaskById(store.sessions.s5.taskId)!;
  // drafting 阶段 session 上没有 feedback / submittedText
  assert.equal(store.sessions.s5.feedback, undefined);
  assert.equal(store.sessions.s5.submittedText, undefined);
  // 提交后才有
  store = updateTranslation(store, "s5", { type: "set_draft", draft: "Some answer here enough length" }, NOW);
  store = updateTranslation(store, "s5", { type: "submit", now: NOW }, NOW);
  assert.ok(store.sessions.s5.feedback);
  assert.ok(task.referenceTranslation.length > 0);
});

test("翻译：完成后 daily 统计 1/1", () => {
  let store = startTranslation(emptyTranslationStore(), "daily", DAY, NOW, "s6").store;
  const task = translationTaskById(store.sessions.s6.taskId)!;
  store = updateTranslation(store, "s6", { type: "set_draft", draft: task.referenceTranslation }, NOW);
  store = updateTranslation(store, "s6", { type: "submit", now: NOW }, NOW);
  store = updateTranslation(store, "s6", { type: "finish", now: NOW }, NOW);
  assert.equal(store.sessions.s6.phase, "complete");
  assert.ok(store.sessions.s6.applied);
  assert.equal(planFor(store, DAY).completedTaskIds.length, 1);
});

test("翻译：额外翻译独立计数，不挤占今日 0/1", () => {
  let store = startTranslation(emptyTranslationStore(), "daily", DAY, NOW, "d1").store;
  const t1 = translationTaskById(store.sessions.d1.taskId)!;
  store = updateTranslation(store, "d1", { type: "set_draft", draft: t1.referenceTranslation }, NOW);
  store = updateTranslation(store, "d1", { type: "submit", now: NOW }, NOW);
  store = updateTranslation(store, "d1", { type: "finish", now: NOW }, NOW);
  assert.equal(planFor(store, DAY).completedTaskIds.length, 1);
  // 开始额外
  const r2 = startTranslation(store, "extra", DAY, NOW, "e1");
  assert.ok(r2.id);
  store = r2.store;
  const t2 = translationTaskById(store.sessions.e1.taskId)!;
  store = updateTranslation(store, "e1", { type: "set_draft", draft: t2.referenceTranslation }, NOW);
  store = updateTranslation(store, "e1", { type: "submit", now: NOW }, NOW);
  store = updateTranslation(store, "e1", { type: "finish", now: NOW }, NOW);
  // daily 仍是 1/1
  assert.equal(planFor(store, DAY).completedTaskIds.length, 1);
  assert.equal(translationDayStats(store, DAY).extra, 1);
});

test("翻译：XP 去重（同日重复同一篇 = 0）", () => {
  let store = startTranslation(emptyTranslationStore(), "daily", DAY, NOW, "x1").store;
  const task = translationTaskById(store.sessions.x1.taskId)!;
  store = updateTranslation(store, "x1", { type: "set_draft", draft: task.referenceTranslation }, NOW);
  store = updateTranslation(store, "x1", { type: "submit", now: NOW }, NOW);
  store = updateTranslation(store, "x1", { type: "finish", now: NOW }, NOW);
  assert.ok(store.sessions.x1.rewardXp! >= TRANSLATION_BASE_XP);
  const xp1 = store.sessions.x1.rewardXp!;
  // 同日再做一次同一题（模拟再做）
  // x2 可能是另一题；直接用 xp 函数测同日同 taskId
  const again = translationXp(
    { ...store.sessions.x1, phase: "reviewing" },
    store.xpLedger,
    NOW,
  );
  assert.equal(again.xp, 0);
  assert.ok(xp1 > 0);
});

test("翻译：历史记录保存与删除", () => {
  let store = startTranslation(emptyTranslationStore(), "daily", DAY, NOW, "h1").store;
  const task = translationTaskById(store.sessions.h1.taskId)!;
  store = updateTranslation(store, "h1", { type: "set_draft", draft: task.referenceTranslation }, NOW);
  store = updateTranslation(store, "h1", { type: "submit", now: NOW }, NOW);
  store = updateTranslation(store, "h1", { type: "finish", now: NOW }, NOW);
  assert.equal(store.history.length, 1);
  assert.equal(store.history[0].taskId, task.id);
  assert.ok(store.history[0].submittedText.length > 0);
  const after = deleteTranslationHistory(store, 0);
  assert.equal(after.history.length, 0);
});

test("翻译：schemaVersion 不匹配时重置", () => {
  const m = memory();
  m.setItem("cet-daily:v1:translation", JSON.stringify({ schemaVersion: 999 }));
  const loaded = loadTranslationStore(m);
  assert.equal(loaded.store.schemaVersion, 1);
  assert.equal(Object.keys(loaded.store.sessions).length, 0);
  assert.ok(loaded.issue);
});

test("翻译：坏 session 被隔离，其他保留", () => {
  const m = memory();
  const good = startTranslation(emptyTranslationStore(), "daily", DAY, NOW, "good").store;
  saveTranslationStore(m, good);
  const raw = JSON.parse(m.getItem("cet-daily:v1:translation")!);
  raw.sessions.bad = { schemaVersion: 1, bogus: true };
  m.setItem("cet-daily:v1:translation", JSON.stringify(raw));
  const loaded = loadTranslationStore(m);
  assert.ok(loaded.store.sessions.good);
  assert.equal(loaded.store.sessions.bad, undefined);
  assert.ok(loaded.issue);
});

test("翻译：日期切换后今日任务独立", () => {
  let store = startTranslation(emptyTranslationStore(), "daily", DAY, NOW, "d1").store;
  const t1 = translationTaskById(store.sessions.d1.taskId)!;
  store = updateTranslation(store, "d1", { type: "set_draft", draft: t1.referenceTranslation }, NOW);
  store = updateTranslation(store, "d1", { type: "submit", now: NOW }, NOW);
  store = updateTranslation(store, "d1", { type: "finish", now: NOW }, NOW);
  // 第二天
  store = startTranslation(store, "daily", NEXT_DAY, NOW_NEXT, "d2").store;
  assert.equal(planFor(store, NEXT_DAY).completedTaskIds.length, 0);
  assert.ok(store.sessions.d2);
});

test("翻译：刷新恢复未完成的草稿（跨 store 重建）", () => {
  const m = memory();
  let store = startTranslation(emptyTranslationStore(), "daily", DAY, NOW, "r1").store;
  store = updateTranslation(store, "r1", { type: "set_draft", draft: "unfinished draft text" }, NOW);
  saveTranslationStore(m, store);
  const loaded = loadTranslationStore(m).store;
  const resumed = translationResumeSessions(loaded, DAY);
  assert.equal(resumed.active?.id, "r1");
  assert.equal(resumed.active?.draft, "unfinished draft text");
});
