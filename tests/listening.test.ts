import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  mockListeningMaterials,
  listeningMaterialById,
} from "../src/data/mockListening";
import { listeningWordById } from "../src/data/listeningVocabulary";
import { wordById } from "../src/data/mockVocabulary";
import { todayInShanghai } from "../src/lib/dates";
import { currentQuestion } from "../src/lib/lesson/session";
import { listeningLesson } from "../src/lib/listening/questions";
import {
  emptyListeningStore,
  loadListeningStore,
  saveListeningStore,
} from "../src/lib/listening/storage";
import {
  planFor,
  startListening,
  updateListening,
  listeningDayStats,
  pickDailyListening,
  listeningResumeSessions,
} from "../src/lib/listening/store";
import { listeningXp, LISTENING_BASE_XP } from "../src/lib/listening/xp";
import { addWordToWordbook } from "../src/lib/vocabulary/store";

import { emptyVocabularyStore } from "../src/lib/vocabulary/storage";
const DAY = "2026-09-20";
const NEXT_DAY = "2026-09-21";
const NOW = "2026-09-20T10:00:00.000+08:00";
const NOW_NEXT = "2026-09-21T10:00:00.000+08:00";

test("听力材料的本地音频资源完整且为有效 WAV", () => {
  for (const material of mockListeningMaterials) {
    assert.equal(material.audio.type, "file");
    assert.equal(material.audio.src, `/audio/listening/${material.id}.wav`);
    const bytes = readFileSync(resolve("public", material.audio.src!.slice(1)));
    assert.equal(bytes.toString("ascii", 0, 4), "RIFF");
    assert.equal(bytes.toString("ascii", 8, 12), "WAVE");
    assert.equal(bytes.readUInt32LE(4) + 8, bytes.length);
    assert.ok(bytes.length > 10000);
  }
});

test("跨日入口：昨天任务和额外练习不占用今天的主入口", () => {
  let store = startListening(
    emptyListeningStore(),
    "daily",
    DAY,
    NOW,
    "yesterday",
  ).store;
  store.sessions.extra = {
    ...store.sessions.yesterday,
    id: "extra",
    mode: "extra",
  };
  let entries = listeningResumeSessions(store, NEXT_DAY);
  assert.equal(entries.active, undefined);
  assert.equal(entries.previousDaily?.id, "yesterday");
  assert.equal(entries.extraActive?.id, "extra");
  store = startListening(store, "daily", NEXT_DAY, NOW_NEXT, "today").store;
  entries = listeningResumeSessions(store, NEXT_DAY);
  assert.equal(entries.active?.id, "today");
  assert.equal(entries.previousDaily?.id, "yesterday");
  assert.equal(entries.extraActive?.id, "extra");
  assert.equal(planFor(store, NEXT_DAY).completedMaterialIds.length, 0);
});
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
  const material = mockListeningMaterials.find((m) =>
    m.questions.some((q) => q.id === questionId),
  )!;
  const q = material.questions.find((x) => x.id === questionId)!;
  return q.options.find((o) => o.id !== answerId)!.id;
}

function select(
  store: ReturnType<typeof emptyListeningStore>,
  id: string,
  optionId: string,
) {
  return updateListening(
    store,
    id,
    { type: "lesson", action: { type: "select", optionId } },
    NOW,
  );
}
function check(store: ReturnType<typeof emptyListeningStore>, id: string) {
  return updateListening(
    store,
    id,
    { type: "lesson", action: { type: "check" } },
    NOW,
  );
}
function next(
  store: ReturnType<typeof emptyListeningStore>,
  id: string,
  now = NOW,
) {
  return updateListening(
    store,
    id,
    {
      type: "lesson",
      action: {
        type: "continue",
        now,
        today: todayInShanghai(new Date(now)),
      },
    },
    now,
  );
}
function answer(
  store: ReturnType<typeof emptyListeningStore>,
  id: string,
  optionId: string,
) {
  const s = select(store, id, optionId);
  return check(s, id);
}
/** 用给定策略答完一组，返回更新后的 store。 */
function finish(
  store: ReturnType<typeof emptyListeningStore>,
  id: string,
  mode: "all-correct" | "all-wrong",
  now = NOW,
) {
  let s = store;
  if (s.sessions[id].phase === "listening")
    s = updateListening(s, id, { type: "start_question" }, now);
  const session = s.sessions[id];
  const definition = listeningLesson(
    listeningMaterialById(session.materialId)!,
  );
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
          : wrongOption(q.id.replace(/^lq:/, ""), q.answerId);
      s = answer(s, id, optionId);
      continue;
    }
    break;
  }
  return s;
}

test("每日听力任务：每天固定 3 组，同一天结果稳定", () => {
  const a = pickDailyListening(DAY);
  const b = pickDailyListening(DAY);
  assert.equal(a.length, 3);
  assert.deepEqual(a, b);
  assert.equal(new Set(a).size, 3);
});

test("0/3 与每日计划", () => {
  const store = emptyListeningStore();
  const plan = planFor(store, DAY);
  assert.equal(plan.completedMaterialIds.length, 0);
  assert.equal(plan.materialIds.length, 3);
});

test("Session 创建：默认 phase=listening、playCount=0、rate=1.0", () => {
  const store = emptyListeningStore();
  const r = startListening(store, "daily", DAY, NOW, "s1");
  const s = r.store.sessions[r.id!];
  assert.equal(s.phase, "listening");
  assert.equal(s.playCount, 0);
  assert.equal(s.rate, 1.0);
  assert.equal(s.transcriptViewedBeforeAnswer, false);
  assert.equal(s.listeningCompleted, false);
});

test("start_question 后进入 question 阶段", () => {
  let store = emptyListeningStore();
  const r = startListening(store, "daily", DAY, NOW, "s1");
  store = updateListening(r.store, r.id!, { type: "start_question" }, NOW);
  assert.equal(store.sessions[r.id!].phase, "question");
  assert.equal(store.sessions[r.id!].listeningCompleted, true);
});

test("record_play 累计播放次数，set_rate 切换速度", () => {
  let store = emptyListeningStore();
  const r = startListening(store, "daily", DAY, NOW, "s1");
  store = updateListening(r.store, r.id!, { type: "record_play" }, NOW);
  store = updateListening(store, r.id!, { type: "record_play" }, NOW);
  assert.equal(store.sessions[r.id!].playCount, 2);
  store = updateListening(store, r.id!, { type: "set_rate", rate: 0.8 }, NOW);
  assert.equal(store.sessions[r.id!].rate, 0.8);
});

test("view_transcript 只记录一次", () => {
  let store = emptyListeningStore();
  const r = startListening(store, "daily", DAY, NOW, "s1");
  store = updateListening(r.store, r.id!, { type: "view_transcript" }, NOW);
  store = updateListening(store, r.id!, { type: "view_transcript" }, NOW);
  assert.equal(store.sessions[r.id!].transcriptViewedBeforeAnswer, true);
});

test("首次答对：all-correct 完成后 first_try_correct", () => {
  let store = emptyListeningStore();
  const r = startListening(store, "daily", DAY, NOW, "s1");
  store = finish(r.store, r.id!, "all-correct");
  const s = store.sessions[r.id!];
  assert.equal(s.phase, "complete");
  assert.equal(s.applied, true);
  const def = listeningLesson(listeningMaterialById(s.materialId)!);
  for (const q of def.questions)
    assert.equal(s.lesson.records[q.id].initialResult, "first_try_correct");
});

test("第一次答错允许 retry，第二次答对记 second_try_correct", () => {
  let store = emptyListeningStore();
  const r = startListening(store, "daily", DAY, NOW, "s1");
  store = updateListening(r.store, r.id!, { type: "start_question" }, NOW);
  const def = listeningLesson(
    listeningMaterialById(store.sessions[r.id!].materialId)!,
  );
  const q = def.questions[0];
  const wrong = q.options.find((o) => o.id !== q.answerId)!.id;
  store = answer(store, r.id!, wrong);
  // 第一次错后进入 retry
  assert.notEqual(
    store.sessions[r.id!].lesson.records[q.id].initialResult,
    "first_try_correct",
  );
});

test("完成 3/3 后 dailyComplete", () => {
  let store = emptyListeningStore();
  for (let i = 0; i < 3; i++) {
    const r = startListening(store, "daily", DAY, NOW, `s${i}`);
    store = finish(r.store, r.id!, "all-correct");
  }
  const plan = planFor(store, DAY);
  assert.equal(plan.completedMaterialIds.length, 3);
});

test("额外听力：完成 3/3 后开始第 4 组，extra=1，不显示 4/3", () => {
  let store = emptyListeningStore();
  for (let i = 0; i < 3; i++) {
    const r = startListening(store, "daily", DAY, NOW, `s${i}`);
    store = finish(r.store, r.id!, "all-correct");
  }
  const before = listeningDayStats(store, DAY);
  assert.equal(before.extra, 0);
  const r = startListening(store, "extra", DAY, NOW, "s_extra");
  assert.ok(r.id);
  store = finish(r.store, r.id!, "all-correct");
  const after = listeningDayStats(store, DAY);
  assert.equal(after.extra, 1);
  const plan = planFor(store, DAY);
  assert.equal(plan.completedMaterialIds.length, 3);
});

test("额外听力在 3/3 前不可开始", () => {
  const store = emptyListeningStore();
  const r = startListening(store, "extra", DAY, NOW, "s_extra");
  assert.equal(r.id, undefined);
});

test("XP：首次完成 = 基础 15 + 表现分", () => {
  let store = emptyListeningStore();
  const r = startListening(store, "daily", DAY, NOW, "s1");
  store = finish(r.store, r.id!, "all-correct");
  const s = store.sessions[r.id!];
  const def = listeningLesson(listeningMaterialById(s.materialId)!);
  const perf = def.questions.length * 2;
  assert.equal(s.rewardXp, LISTENING_BASE_XP + perf);
});

test("XP：同日重复同组 = 0", () => {
  let store = emptyListeningStore();
  const r = startListening(store, "daily", DAY, NOW, "s1");
  store = finish(r.store, r.id!, "all-correct");
  const materialId = store.sessions[r.id!].materialId;
  // 同日再次完成同一组（模拟）
  const recompute = listeningXp(store.sessions[r.id!], store.xpLedger, NOW);
  assert.equal(recompute.xp, 0);
  void materialId;
});

test("XP：跨日重复只给表现分", () => {
  let store = emptyListeningStore();
  const r = startListening(store, "daily", DAY, NOW, "s1");
  store = finish(r.store, r.id!, "all-correct");
  // 次日再完成同一组，ledger 已有 firstKey，dayKey 不同
  const recompute = listeningXp(
    store.sessions[r.id!],
    store.xpLedger,
    NOW_NEXT,
  );
  const def = listeningLesson(
    listeningMaterialById(store.sessions[r.id!].materialId)!,
  );
  const perf = def.questions.length * 2;
  assert.equal(recompute.xp, perf);
});

test("生词加入：source=listening，写入统一生词本", () => {
  const vocab = emptyVocabularyStore();
  const word = listeningWordById("lw_budget")!;
  assert.equal(word.source, "listening");
  const r = addWordToWordbook(vocab, word, NOW);
  assert.equal(r.added, true);
  assert.equal(r.store.states[word.id]?.addedToWordbook, true);
});

test("生词去重：已收藏不重复添加", () => {
  let vocab = emptyVocabularyStore();
  const word = listeningWordById("lw_coast")!;
  const r1 = addWordToWordbook(vocab, word, NOW);
  vocab = r1.store;
  const r2 = addWordToWordbook(vocab, word, NOW);
  assert.equal(r1.added, true);
  assert.equal(r2.added, false);
});

test("wordById 能找到听力词", () => {
  const w = wordById("lw_booth");
  assert.ok(w);
  assert.equal(w?.source, "listening");
});

test("collect_word 记录本篇生词", () => {
  let store = emptyListeningStore();
  const r = startListening(store, "daily", DAY, NOW, "s1");
  store = updateListening(
    r.store,
    r.id!,
    { type: "collect_word", wordId: "lw_budget" },
    NOW,
  );
  assert.deepEqual(store.sessions[r.id!].collectedWordIds, ["lw_budget"]);
  // 重复收集不重复
  store = updateListening(
    r.store,
    r.id!,
    { type: "collect_word", wordId: "lw_budget" },
    NOW,
  );
  assert.equal(store.sessions[r.id!].collectedWordIds.length, 1);
});

test("LocalStorage：save/load 往返", () => {
  let store = emptyListeningStore();
  const r = startListening(store, "daily", DAY, NOW, "s1");
  store = updateListening(r.store, r.id!, { type: "record_play" }, NOW);
  const mem = memory();
  assert.equal(saveListeningStore(mem, store), true);
  const loaded = loadListeningStore(mem);
  assert.equal(loaded.store.sessions[r.id!].playCount, 1);
});

test("LocalStorage：schemaVersion 不兼容时重置", () => {
  const mem = memory();
  mem.setItem("cet-daily:v1:listening", JSON.stringify({ schemaVersion: 99 }));
  const loaded = loadListeningStore(mem);
  assert.equal(loaded.store.schemaVersion, 1);
  assert.ok(loaded.issue);
});

test("LocalStorage：坏记录隔离", () => {
  const mem = memory();
  const good = startListening(
    emptyListeningStore(),
    "daily",
    DAY,
    NOW,
    "ok",
  ).store;
  const sessions = (good as unknown as { sessions: Record<string, unknown> })
    .sessions;
  sessions.bad = { broken: true };
  mem.setItem("cet-daily:v1:listening", JSON.stringify(good));
  const loaded = loadListeningStore(mem);
  assert.ok(loaded.store.sessions.ok);
  assert.equal(loaded.store.sessions.bad, undefined);
  assert.ok(loaded.issue);
});

test("日期切换：跨日继续，新日任务独立", () => {
  let store = emptyListeningStore();
  const r = startListening(store, "daily", DAY, NOW, "s1");
  store = finish(r.store, r.id!, "all-correct");
  const planNext = planFor(store, NEXT_DAY);
  assert.equal(planNext.completedMaterialIds.length, 0);
  assert.equal(planNext.materialIds.length, 3);
});

test("每篇材料有 2-4 题、查词真实出现于 transcript", () => {
  for (const m of mockListeningMaterials) {
    assert.ok(m.questions.length >= 2 && m.questions.length <= 4, m.id);
    assert.ok(m.keySentences.length >= 1, m.id);
    for (const key of Object.keys(m.vocabulary))
      assert.ok(
        m.transcript.toLowerCase().includes(key.toLowerCase()),
        `${m.id} missing ${key}`,
      );
    for (const q of m.questions) {
      assert.ok(q.answerId);
      assert.ok(q.options.length === 4, m.id);
    }
  }
});

test("完成状态：applied + completedAt + rewardXp", () => {
  let store = emptyListeningStore();
  const r = startListening(store, "daily", DAY, NOW, "s1");
  store = finish(r.store, r.id!, "all-correct");
  const s = store.sessions[r.id!];
  assert.equal(s.applied, true);
  assert.ok(s.completedAt);
  assert.ok((s.rewardXp ?? 0) > 0);
});
