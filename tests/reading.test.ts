import test from "node:test";
import assert from "node:assert/strict";
import {
  mockReadingArticles,
  readingArticleById,
} from "../src/data/mockReading";
import { readingWordById } from "../src/data/readingVocabulary";
import { wordById } from "../src/data/mockVocabulary";
import { todayInShanghai } from "../src/lib/dates";
import { currentQuestion } from "../src/lib/lesson/session";
import { createReadingSession } from "../src/lib/reading/session";
import { readingLesson } from "../src/lib/reading/questions";
import {
  emptyReadingStore,
  loadReadingStore,
  saveReadingStore,
} from "../src/lib/reading/storage";
import {
  planFor,
  startReading,
  updateReading,
  readingDayStats,
} from "../src/lib/reading/store";
import { readingXp, READING_BASE_XP } from "../src/lib/reading/xp";
import { addWordToWordbook } from "../src/lib/vocabulary/store";
import {
  emptyVocabularyStore,
  loadVocabularyStore,
  saveVocabularyStore,
} from "../src/lib/vocabulary/storage";

const DAY = "2026-09-18";
const NEXT_DAY = "2026-09-19";
const NOW = "2026-09-18T10:00:00.000+08:00";
const NOW_NEXT = "2026-09-19T10:00:00.000+08:00";
assert.equal(todayInShanghai(new Date(NOW)), DAY);

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

function wrongOption(questionId: string, answerId: string) {
  const article = mockReadingArticles.find((a) =>
    a.questions.some((q) => q.id === questionId),
  )!;
  const q = article.questions.find((x) => x.id === questionId)!;
  return q.options.find((o) => o.id !== answerId)!.id;
}

function select(store: ReturnType<typeof emptyReadingStore>, id: string, optionId: string) {
  return updateReading(
    store,
    id,
    { type: "lesson", action: { type: "select", optionId } },
    NOW,
  );
}
function check(store: ReturnType<typeof emptyReadingStore>, id: string) {
  return updateReading(store, id, { type: "lesson", action: { type: "check" } }, NOW);
}
function next(store: ReturnType<typeof emptyReadingStore>, id: string, now = NOW) {
  return updateReading(
    store,
    id,
    { type: "lesson", action: { type: "continue", now, today: todayInShanghai(new Date(now)) } },
    now,
  );
}
function answer(store: ReturnType<typeof emptyReadingStore>, id: string, optionId: string) {
  const s = select(store, id, optionId);
  return check(s, id);
}
/** 用给定策略答完一篇文章（全部正确/全部错误），返回更新后的 store。 */
function finish(
  store: ReturnType<typeof emptyReadingStore>,
  id: string,
  mode: "all-correct" | "all-wrong",
  now = NOW,
) {
  let s = store;
  if (s.sessions[id].phase === "reading")
    s = updateReading(s, id, { type: "start_quiz" }, now);
  const session = s.sessions[id];
  const definition = readingLesson(readingArticleById(session.articleId)!);
  let guard = 0;
  while (s.sessions[id].lesson.phase !== "complete" && guard++ < 60) {
    const lesson = s.sessions[id].lesson;
    if (lesson.phase === "review_intro" || lesson.phase === "feedback") {
      s = next(s, id, now);
      continue;
    }
    if (lesson.phase === "answering" || lesson.phase === "retry") {
      const q = currentQuestion(lesson, definition)!;
      const optionId =
        mode === "all-correct"
          ? q.answerId
          : wrongOption(q.id.replace(/^rq:/, ""), q.answerId);
      s = answer(s, id, optionId);
      continue;
    }
    break;
  }
  return s;
}

test("每日阅读任务：每天固定 3 篇，同一天结果稳定", () => {
  const store = emptyReadingStore();
  const plan = planFor(store, DAY);
  assert.equal(plan.articleIds.length, 3);
  assert.equal(new Set(plan.articleIds).size, 3);
  assert.deepEqual(planFor(store, DAY).articleIds, plan.articleIds);
  assert.equal(plan.completedArticleIds.length, 0);
  // 不同日期至少有一次轮换
  const another = planFor(store, "2026-09-20");
  assert.notDeepEqual(another.articleIds, plan.articleIds);
});

test("开始每日阅读：创建 reading 阶段 session，文章来自当日计划", () => {
  const store = emptyReadingStore();
  const { store: next, id } = startReading(store, "daily", DAY, NOW, "s1");
  assert.ok(id);
  const session = next.sessions[id!];
  assert.equal(session.phase, "reading");
  assert.equal(session.mode, "daily");
  assert.equal(session.planDate, DAY);
  assert.ok(planFor(store, DAY).articleIds.includes(session.articleId));
  assert.equal(session.readingCompleted, false);
  assert.equal(session.applied, false);
  assert.equal(session.lesson.phase, "answering");
  assert.equal(session.lesson.lessonId, `reading:${session.articleId}`);
  assert.ok(next.daily[DAY].activeSessionId === id);
});

test("未完成的每日阅读会恢复为同一个 session", () => {
  const store = emptyReadingStore();
  const first = startReading(store, "daily", DAY, NOW, "s1");
  const second = startReading(first.store, "daily", DAY, NOW, "s2");
  assert.equal(second.id, "s1");
  assert.equal(Object.keys(second.store.sessions).length, 1);
});

test("开始答题后进入 quiz 阶段", () => {
  const store = startReading(emptyReadingStore(), "daily", DAY, NOW, "s1").store;
  const next = updateReading(store, "s1", { type: "start_quiz" }, NOW);
  const session = next.sessions.s1;
  assert.equal(session.phase, "quiz");
  assert.equal(session.readingCompleted, true);
});

test("首轮答对：进入 feedback，continue 后推进到下一题", () => {
  let store = startReading(emptyReadingStore(), "daily", DAY, NOW, "s1").store;
  const session = store.sessions.s1;
  const article = readingArticleById(session.articleId)!;
  const q = article.questions[0];
  store = updateReading(store, "s1", { type: "start_quiz" }, NOW);
  store = answer(store, "s1", q.answerId);
  assert.equal(store.sessions.s1.lesson.phase, "feedback");
  assert.equal(store.sessions.s1.lesson.records[`rq:${q.id}`].initialResult, "first_try_correct");
  store = next(store, "s1");
  assert.equal(store.sessions.s1.lesson.index, 1);
  assert.equal(store.sessions.s1.lesson.phase, "answering");
});

test("第一次答错进入 retry，第二次答对得 second_try_correct", () => {
  let store = startReading(emptyReadingStore(), "daily", DAY, NOW, "s1").store;
  const session = store.sessions.s1;
  const article = readingArticleById(session.articleId)!;
  const q = article.questions[0];
  store = updateReading(store, "s1", { type: "start_quiz" }, NOW);
  store = answer(store, "s1", wrongOption(q.id, q.answerId));
  assert.equal(store.sessions.s1.lesson.phase, "retry");
  store = answer(store, "s1", q.answerId);
  assert.equal(store.sessions.s1.lesson.records[`rq:${q.id}`].initialResult, "second_try_correct");
  assert.equal(store.sessions.s1.lesson.phase, "feedback");
});

test("两次答错进入复测队列，结尾出现巩固复测", () => {
  let store = startReading(emptyReadingStore(), "daily", DAY, NOW, "s1").store;
  const session = store.sessions.s1;
  const article = readingArticleById(session.articleId)!;
  const q = article.questions[0];
  const wrong = wrongOption(q.id, q.answerId);
  store = updateReading(store, "s1", { type: "start_quiz" }, NOW);
  store = answer(store, "s1", wrong);
  store = answer(store, "s1", wrong);
  assert.ok(store.sessions.s1.lesson.retestQueue.includes(`rq:${q.id}`));
  // 答完其余题后进入 review_intro
  const definition = readingLesson(article);
  let guard = 0;
  while (
    store.sessions.s1.lesson.phase !== "review_intro" &&
    guard++ < 30
  ) {
    const lesson = store.sessions.s1.lesson;
    if (lesson.phase === "feedback") {
      store = next(store, "s1");
      continue;
    }
    const qi = currentQuestion(lesson, definition)!;
    store = answer(store, "s1", qi.answerId);
  }
  assert.equal(store.sessions.s1.lesson.phase, "review_intro");
  store = next(store, "s1");
  assert.equal(store.sessions.s1.lesson.round, "retest");
  // 复测答对后完成
  store = answer(store, "s1", q.answerId);
  store = next(store, "s1");
  assert.equal(store.sessions.s1.lesson.phase, "complete");
});

test("完成文章：phase complete、applied、记录完成时间", () => {
  const started = startReading(emptyReadingStore(), "daily", DAY, NOW, "s1");
  const store = finish(started.store, "s1", "all-correct");
  const session = store.sessions.s1;
  assert.equal(session.phase, "complete");
  assert.equal(session.applied, true);
  assert.ok(session.completedAt);
  assert.equal(typeof session.rewardXp, "number");
  assert.ok(store.daily[DAY].completedArticleIds.includes(session.articleId));
});

test("完成三篇后今日任务完成，进度 3/3", () => {
  let store = emptyReadingStore();
  for (const id of ["s1", "s2", "s3"]) {
    const started = startReading(store, "daily", DAY, NOW, id);
    store = finish(started.store, id, "all-correct");
  }
  const plan = planFor(store, DAY);
  assert.equal(plan.completedArticleIds.length, 3);
  const s = startReading(store, "daily", DAY, NOW, "s4");
  assert.equal(s.id, undefined);
});

test("额外阅读：今日任务未完成时不可开始，完成后从剩余文章选择", () => {
  let store = emptyReadingStore();
  const blocked = startReading(store, "extra", DAY, NOW, "x1");
  assert.equal(blocked.id, undefined);
  for (const id of ["s1", "s2", "s3"]) {
    const started = startReading(store, "daily", DAY, NOW, id);
    store = finish(started.store, id, "all-correct");
  }
  const extra = startReading(store, "extra", DAY, NOW, "x1");
  assert.ok(extra.id);
  const plan = planFor(extra.store, DAY);
  assert.ok(!plan.articleIds.includes(extra.store.sessions.x1.articleId));
});

test("额外阅读统计按完成日归属", () => {
  let store = emptyReadingStore();
  for (const id of ["s1", "s2", "s3"]) {
    const started = startReading(store, "daily", DAY, NOW, id);
    store = finish(started.store, id, "all-correct");
  }
  const extra = startReading(store, "extra", DAY, NOW, "x1");
  store = finish(extra.store, "x1", "all-correct");
  assert.equal(readingDayStats(store, DAY).extra, 1);
  assert.equal(readingDayStats(store, NEXT_DAY).extra, 0);
});

test("XP：首次完成 = 基础分 + 表现分", () => {
  const started = startReading(emptyReadingStore(), "daily", DAY, NOW, "s1");
  const store = finish(started.store, "s1", "all-correct");
  const articleId = store.sessions.s1.articleId;
  const article = readingArticleById(articleId)!;
  const perf = article.questions.length * 2;
  assert.equal(store.sessions.s1.rewardXp, READING_BASE_XP + perf);
  assert.ok(store.xpLedger[`reading:first:${articleId}`]);
  assert.ok(store.xpLedger[`reading:day:${DAY}:${articleId}`]);
});

test("XP：同一天重复同一篇得 0，不刷分", () => {
  let store = emptyReadingStore();
  for (const id of ["s1", "s2", "s3"]) {
    const r = startReading(store, "daily", DAY, NOW, id);
    store = finish(r.store, id, "all-correct");
  }
  // 3 篇额外把剩余文章读完，之后无新文章可选
  for (const id of ["x1", "x2", "x3"]) {
    const r = startReading(store, "extra", DAY, NOW, id);
    store = finish(r.store, id, "all-correct");
  }
  const firstArticle = store.sessions.x1.articleId;
  const before = store.xpLedger[`reading:day:${DAY}:${firstArticle}`];
  assert.ok(before > 0);
  const repeat = startReading(store, "extra", DAY, NOW, "x4");
  assert.ok(repeat.id);
  const repeatedId = repeat.store.sessions.x4.articleId;
  const repeatedBefore = store.xpLedger[`reading:day:${DAY}:${repeatedId}`];
  assert.ok(repeatedBefore > 0);
  store = finish(repeat.store, "x4", "all-correct");
  assert.equal(store.sessions.x4.rewardXp, 0);
  assert.equal(store.xpLedger[`reading:day:${DAY}:${repeatedId}`], repeatedBefore);
  assert.equal(
    store.xpLedger[`reading:day:${DAY}:${firstArticle}`],
    before,
  );
});

test("XP：跨日重复获得较少 XP（仅表现分，无基础分）", () => {
  let store = emptyReadingStore();
  const started = startReading(store, "daily", DAY, NOW, "s1");
  store = finish(started.store, "s1", "all-correct");
  const articleId = store.sessions.s1.articleId;
  const article = readingArticleById(articleId)!;
  const perf = article.questions.length * 2;
  // 另一天对同一篇文章重复练习：复用第一天的答题记录，验证只给表现分
  const session2 = {
    ...createReadingSession("x1", "extra", NEXT_DAY, article, NOW_NEXT),
    phase: "complete" as const,
    readingCompleted: true,
    lesson: store.sessions.s1.lesson,
  };
  const reward = readingXp(session2, store.xpLedger, NOW_NEXT);
  assert.equal(reward.xp, perf);
  assert.equal(reward.ledger[`reading:day:${NEXT_DAY}:${articleId}`], perf);
  assert.equal(reward.ledger[`reading:first:${articleId}`], READING_BASE_XP);
});

test("阅读收藏写入统一生词本：source=reading 且去重", () => {
  const word = readingWordById("rw_screen")!;
  assert.ok(word);
  assert.equal(word.source, "reading");
  const store = emptyVocabularyStore();
  const first = addWordToWordbook(store, word, NOW);
  assert.equal(first.added, true);
  assert.equal(first.store.states[word.id].addedToWordbook, true);
  assert.equal(first.store.states[word.id].source, "reading");
  const second = addWordToWordbook(first.store, word, NOW);
  assert.equal(second.added, false);
  assert.equal(Object.keys(second.store.states).length, 1);
});

test("阅读生词可通过统一 wordById 检索，且能随词汇存储持久化", () => {
  const word = readingWordById(`rw_transparency`)!;
  assert.ok(wordById(word.id)?.id === word.id);
  const storage = memory();
  let store = emptyVocabularyStore();
  store = addWordToWordbook(store, word, NOW).store;
  assert.ok(saveVocabularyStore(storage, store));
  const loaded = loadVocabularyStore(storage);
  assert.ok(loaded.store.states[word.id]);
  assert.equal(loaded.store.states[word.id].source, "reading");
  assert.equal(loaded.store.states[word.id].addedToWordbook, true);
  assert.equal(loaded.issue, undefined);
});

test("阅读存储：save/load 往返一致（schemaVersion=1）", () => {
  const storage = memory();
  let store = emptyReadingStore();
  const started = startReading(store, "daily", DAY, NOW, "s1");
  store = finish(started.store, "s1", "all-correct");
  assert.ok(saveReadingStore(storage, store));
  const raw = JSON.parse(storage.getItem("cet-daily:v1:reading")!);
  assert.equal(raw.schemaVersion, 1);
  const loaded = loadReadingStore(storage);
  assert.equal(loaded.issue, undefined);
  assert.equal(loaded.store.sessions.s1.phase, "complete");
  assert.deepEqual(loaded.store.daily, store.daily);
  assert.deepEqual(loaded.store.xpLedger, store.xpLedger);
});

test("阅读存储：坏记录被隔离，有效记录保留", () => {
  const storage = memory();
  let store = emptyReadingStore();
  const started = startReading(store, "daily", DAY, NOW, "s1");
  store = finish(started.store, "s1", "all-correct");
  const second = startReading(store, "daily", DAY, NOW, "s2");
  storage.setItem(
    "cet-daily:v1:reading",
    JSON.stringify({
      ...second.store,
      sessions: {
        ...second.store.sessions,
        s2: { ...second.store.sessions.s2, articleId: "nope", schemaVersion: 99 },
      },
    }),
  );
  const loaded = loadReadingStore(storage);
  assert.ok(loaded.issue);
  assert.ok(loaded.store.sessions.s1);
  assert.ok(!loaded.store.sessions.s2);
});

test("跨日完成：每日任务归属计划日，不污染新一天任务", () => {
  let store = emptyReadingStore();
  const started = startReading(store, "daily", DAY, NOW, "s1");
  // 隔天完成
  store = finish(started.store, "s1", "all-correct", NOW_NEXT);
  assert.ok(store.daily[DAY].completedArticleIds.includes(store.sessions.s1.articleId));
  assert.equal(readingDayStats(store, NEXT_DAY).extra, 0);
  // 次日任务仍可从零开始
  const nextDay = startReading(store, "daily", NEXT_DAY, NOW_NEXT, "s2");
  assert.ok(nextDay.id);
  assert.equal(nextDay.store.daily[NEXT_DAY].completedArticleIds.length, 0);
});

test("数据质量：文章 250~450 词、3~5 题、查词条目真实出现在原文", () => {
  assert.ok(mockReadingArticles.length >= 5 && mockReadingArticles.length <= 8);
  for (const article of mockReadingArticles) {
    const words = article.passage.split(/\s+/);
    assert.ok(words.length >= 250 && words.length <= 450, `${article.id}: ${words.length}`);
    assert.ok(article.questions.length >= 3 && article.questions.length <= 5);
    assert.ok(Object.keys(article.vocabulary).length >= 5);
    const lower = article.passage.toLowerCase();
    for (const [key, entry] of Object.entries(article.vocabulary)) {
      assert.ok(lower.includes(key), `${article.id}: 原文缺少词 ${key}`);
      assert.ok(readingWordById(`rw_${key}`), `${article.id}: rw_${key} 未收录`);
      assert.ok(entry.phonetic && entry.meaning && entry.sentence);
    }
    for (const q of article.questions) {
      assert.ok(q.options.some((o) => o.id === q.answerId));
      assert.ok(new Set(q.options.map((o) => o.id)).size === q.options.length);
      assert.ok(q.shortExplanation && q.detailedExplanation && q.hint);
    }
  }
});

test("通用答题校验兼容阅读题：review 模式无 reward 可通过校验", () => {
  const storage = memory();
  let store = emptyReadingStore();
  const started = startReading(store, "daily", DAY, NOW, "s1");
  store = finish(started.store, "s1", "all-correct");
  assert.ok(saveReadingStore(storage, store));
  const loaded = loadReadingStore(storage);
  assert.equal(loaded.issue, undefined);
  // 进行中的 quiz 也应通过校验并恢复
  let quizStore = emptyReadingStore();
  const r = startReading(quizStore, "daily", DAY, NOW, "s2");
  quizStore = updateReading(r.store, "s2", { type: "start_quiz" }, NOW);
  const article = readingArticleById(quizStore.sessions.s2.articleId)!;
  quizStore = answer(quizStore, "s2", article.questions[0].answerId);
  assert.ok(saveReadingStore(storage, quizStore));
  const recovered = loadReadingStore(storage);
  assert.equal(recovered.issue, undefined);
  assert.equal(recovered.store.sessions.s2.phase, "quiz");
  assert.equal(recovered.store.sessions.s2.lesson.phase, "feedback");
});

test("生词收藏计入本篇生词统计，且重复收藏不重复计数", () => {
  let store = emptyReadingStore();
  const started = startReading(store, "daily", DAY, NOW, "s1");
  const article = readingArticleById(started.store.sessions.s1.articleId)!;
  const key = Object.keys(article.vocabulary)[0];
  store = updateReading(started.store, "s1", { type: "collect_word", wordId: `rw_${key}` }, NOW);
  store = updateReading(store, "s1", { type: "collect_word", wordId: `rw_${key}` }, NOW);
  assert.equal(store.sessions.s1.collectedWordIds.length, 1);
});
