import test from "node:test";
import assert from "node:assert/strict";
import {
  mockWritingTasks,
  writingTaskById,
} from "../src/data/mockWriting";
import {
  emptyWritingStore,
  loadWritingStore,
  saveWritingStore,
} from "../src/lib/writing/storage";
import {
  planWritingFor,
  startWriting,
  updateWriting,
  writingDayStats,
  pickDailyWriting,
  writingResumeSessions,
  deleteWritingHistory,
} from "../src/lib/writing/store";
import { writingXp, WRITING_BASE_XP } from "../src/lib/writing/xp";
import { countWords, scoreWriting } from "../src/lib/writing/scoring";

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

test("写作：每日任务生成且同一天结果稳定", () => {
  const a = pickDailyWriting(DAY);
  const b = pickDailyWriting(DAY);
  assert.deepEqual(a, b);
  assert.equal(a.length, 1);
  assert.ok(writingTaskById(a[0]));
});

test("写作：草稿自动保存", () => {
  let store = startWriting(emptyWritingStore(), "daily", DAY, NOW, "s1").store;
  store = updateWriting(store, "s1", { type: "set_draft", draft: "Nowadays AI..." }, NOW);
  assert.equal(store.sessions.s1.draft, "Nowadays AI...");
});

test("写作：草稿刷新恢复", () => {
  const m = memory();
  let store = startWriting(emptyWritingStore(), "daily", DAY, NOW, "s2").store;
  store = updateWriting(store, "s2", { type: "set_draft", draft: "half essay..." }, NOW);
  saveWritingStore(m, store);
  const reloaded = loadWritingStore(m).store;
  assert.equal(reloaded.sessions.s2.draft, "half essay...");
});

test("写作：字数统计正确", () => {
  assert.equal(countWords(""), 0);
  assert.equal(countWords("   "), 0);
  assert.equal(countWords("one two three"), 3);
  assert.equal(countWords("  hello   world  "), 2);
});

test("写作：空内容不能提交", () => {
  let store = startWriting(emptyWritingStore(), "daily", DAY, NOW, "s3").store;
  store = updateWriting(store, "s3", { type: "set_draft", draft: "  " }, NOW);
  const after = updateWriting(store, "s3", { type: "submit", now: NOW }, NOW);
  assert.equal(after, store);
  assert.equal(store.sessions.s3.phase, "drafting");
});

test("写作：提交后产生 Mock Feedback，provider=mock", () => {
  let store = startWriting(emptyWritingStore(), "daily", DAY, NOW, "s4").store;
  const task = writingTaskById(store.sessions.s4.taskId)!;
  store = updateWriting(
    store,
    "s4",
    { type: "set_draft", draft: task.referenceEssay },
    NOW,
  );
  store = updateWriting(store, "s4", { type: "submit", now: NOW }, NOW);
  assert.equal(store.sessions.s4.phase, "reviewing");
  const fb = store.sessions.s4.feedback!;
  assert.equal(fb.provider, "mock");
  assert.ok(fb.score >= 0 && fb.score <= fb.maxScore);
  assert.ok(store.sessions.s4.wordCount! > 0);
});

test("写作：参考范文提交前不可见（drafting 阶段无 feedback）", () => {
  let store = startWriting(emptyWritingStore(), "daily", DAY, NOW, "s5").store;
  assert.equal(store.sessions.s5.feedback, undefined);
  const task = writingTaskById(store.sessions.s5.taskId)!;
  store = updateWriting(store, "s5", { type: "set_draft", draft: "Some essay text here enough words for now" }, NOW);
  store = updateWriting(store, "s5", { type: "submit", now: NOW }, NOW);
  assert.ok(store.sessions.s5.feedback);
  assert.ok(task.referenceEssay.length > 0);
});

test("写作：完成后 daily 1/1", () => {
  let store = startWriting(emptyWritingStore(), "daily", DAY, NOW, "s6").store;
  const task = writingTaskById(store.sessions.s6.taskId)!;
  store = updateWriting(store, "s6", { type: "set_draft", draft: task.referenceEssay }, NOW);
  store = updateWriting(store, "s6", { type: "submit", now: NOW }, NOW);
  store = updateWriting(store, "s6", { type: "finish", now: NOW }, NOW);
  assert.equal(store.sessions.s6.phase, "complete");
  assert.equal(planWritingFor(store, DAY).completedTaskIds.length, 1);
});

test("写作：额外写作独立计数", () => {
  let store = startWriting(emptyWritingStore(), "daily", DAY, NOW, "d1").store;
  const t1 = writingTaskById(store.sessions.d1.taskId)!;
  store = updateWriting(store, "d1", { type: "set_draft", draft: t1.referenceEssay }, NOW);
  store = updateWriting(store, "d1", { type: "submit", now: NOW }, NOW);
  store = updateWriting(store, "d1", { type: "finish", now: NOW }, NOW);
  const r2 = startWriting(store, "extra", DAY, NOW, "e1");
  assert.ok(r2.id);
  store = r2.store;
  const t2 = writingTaskById(store.sessions.e1.taskId)!;
  store = updateWriting(store, "e1", { type: "set_draft", draft: t2.referenceEssay }, NOW);
  store = updateWriting(store, "e1", { type: "submit", now: NOW }, NOW);
  store = updateWriting(store, "e1", { type: "finish", now: NOW }, NOW);
  assert.equal(planWritingFor(store, DAY).completedTaskIds.length, 1);
  assert.equal(writingDayStats(store, DAY).extra, 1);
});

test("写作：XP 同日重复同一篇 = 0", () => {
  let store = startWriting(emptyWritingStore(), "daily", DAY, NOW, "x1").store;
  const task = writingTaskById(store.sessions.x1.taskId)!;
  store = updateWriting(store, "x1", { type: "set_draft", draft: task.referenceEssay }, NOW);
  store = updateWriting(store, "x1", { type: "submit", now: NOW }, NOW);
  store = updateWriting(store, "x1", { type: "finish", now: NOW }, NOW);
  assert.ok(store.sessions.x1.rewardXp! >= WRITING_BASE_XP);
  const again = writingXp(
    { ...store.sessions.x1, phase: "reviewing" },
    store.xpLedger,
    NOW,
  );
  assert.equal(again.xp, 0);
});

test("写作：历史记录保存与删除", () => {
  let store = startWriting(emptyWritingStore(), "daily", DAY, NOW, "h1").store;
  const task = writingTaskById(store.sessions.h1.taskId)!;
  store = updateWriting(store, "h1", { type: "set_draft", draft: task.referenceEssay }, NOW);
  store = updateWriting(store, "h1", { type: "submit", now: NOW }, NOW);
  store = updateWriting(store, "h1", { type: "finish", now: NOW }, NOW);
  assert.equal(store.history.length, 1);
  assert.equal(store.history[0].taskId, task.id);
  assert.ok(store.history[0].wordCount! > 0);
  const after = deleteWritingHistory(store, 0);
  assert.equal(after.history.length, 0);
});

test("写作：schemaVersion 不匹配时重置", () => {
  const m = memory();
  m.setItem("cet-daily:v1:writing", JSON.stringify({ schemaVersion: 999 }));
  const loaded = loadWritingStore(m);
  assert.equal(loaded.store.schemaVersion, 1);
  assert.ok(loaded.issue);
});

test("写作：坏 session 隔离", () => {
  const m = memory();
  const good = startWriting(emptyWritingStore(), "daily", DAY, NOW, "good").store;
  saveWritingStore(m, good);
  const raw = JSON.parse(m.getItem("cet-daily:v1:writing")!);
  raw.sessions.bad = { schemaVersion: 1, bogus: true };
  m.setItem("cet-daily:v1:writing", JSON.stringify(raw));
  const loaded = loadWritingStore(m);
  assert.ok(loaded.store.sessions.good);
  assert.equal(loaded.store.sessions.bad, undefined);
});

test("写作：日期切换后今日任务独立", () => {
  let store = startWriting(emptyWritingStore(), "daily", DAY, NOW, "d1").store;
  const t1 = writingTaskById(store.sessions.d1.taskId)!;
  store = updateWriting(store, "d1", { type: "set_draft", draft: t1.referenceEssay }, NOW);
  store = updateWriting(store, "d1", { type: "submit", now: NOW }, NOW);
  store = updateWriting(store, "d1", { type: "finish", now: NOW }, NOW);
  store = startWriting(store, "daily", NEXT_DAY, NOW_NEXT, "d2").store;
  assert.equal(planWritingFor(store, NEXT_DAY).completedTaskIds.length, 0);
});

test("写作：刷新恢复未完成草稿", () => {
  const m = memory();
  let store = startWriting(emptyWritingStore(), "daily", DAY, NOW, "r1").store;
  store = updateWriting(store, "r1", { type: "set_draft", draft: "unfinished essay" }, NOW);
  saveWritingStore(m, store);
  const loaded = loadWritingStore(m).store;
  const resumed = writingResumeSessions(loaded, DAY);
  assert.equal(resumed.active?.id, "r1");
  assert.equal(resumed.active?.draft, "unfinished essay");
});

test("写作：scoreWriting 对空文本给低分", () => {
  const task = mockWritingTasks[0];
  const fb = scoreWriting(task, "", NOW);
  assert.equal(fb.score, 0);
  assert.equal(fb.provider, "mock");
});
