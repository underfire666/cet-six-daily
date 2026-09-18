import test from "node:test";
import assert from "node:assert/strict";
import { mockVocabulary, wordById } from "../src/data/mockVocabulary";
import { vocabularyQuestion } from "../src/lib/vocabulary/questions";
import {
  newVocabularyState,
  markSelfReport,
  applyVocabularyResult,
} from "../src/lib/vocabulary/mastery";
import {
  getWordsDueForReview,
  scheduleReview,
} from "../src/lib/vocabulary/reviewScheduler";
import {
  emptyVocabularyStore,
  loadVocabularyStore,
  saveVocabularyStore,
  VOCABULARY_KEY,
} from "../src/lib/vocabulary/storage";
import {
  startVocabulary,
  updateVocabulary,
  planFor,
  batchProgress,
  vocabularyDayStats,
} from "../src/lib/vocabulary/store";
import type {
  VocabularyStore,
  VocabularyQuestionType,
} from "../src/types/vocabulary";
import type { AnswerRecord } from "../src/types/session";
import { currentQuestion, sessionProgress } from "../src/lib/lesson/session";
const day = "2026-09-17",
  now = `${day}T02:00:00.000Z`;
const word = mockVocabulary[0];
const correct: AnswerRecord = {
  initial: [{ optionId: word.id, correct: true, hinted: false }],
  retest: [],
  hintUsed: false,
  initialResult: "first_try_correct",
};
const when = (days: number) =>
  new Date(Date.parse(now) + days * 86_400_000).toISOString();
function memory() {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    key(i: number) {
      return [...data.keys()][i] ?? null;
    },
    getItem(k: string) {
      return data.get(k) ?? null;
    },
    setItem(k: string, v: string) {
      data.set(k, v);
    },
    removeItem(k: string) {
      data.delete(k);
    },
  };
}
function begin(store = emptyVocabularyStore(), id = "learn") {
  return startVocabulary(store, "learn", day, now, id).store;
}
function submit(store: VocabularyStore, id: string, right: boolean) {
  const s = store.sessions[id],
    q = currentQuestion(s.lesson, s.definition)!;
  const optionId = right
    ? q.answerId
    : q.options.find((o) => o.id !== q.answerId)!.id;
  store = updateVocabulary(
    store,
    id,
    { type: "lesson", action: { type: "select", optionId } },
    now,
  );
  return updateVocabulary(
    store,
    id,
    { type: "lesson", action: { type: "check" } },
    now,
  );
}
function finish(store: VocabularyStore, id: string, right = true) {
  let steps = 0;
  while (store.sessions[id].phase !== "complete") {
    assert.ok(++steps < 100);
    const s = store.sessions[id];
    if (s.phase === "card")
      store = updateVocabulary(
        store,
        id,
        { type: "self_report", value: "known" },
        now,
      );
    else if (["feedback", "review_intro"].includes(s.lesson.phase))
      store = updateVocabulary(
        store,
        id,
        { type: "lesson", action: { type: "continue", now, today: day } },
        now,
      );
    else store = submit(store, id, right);
  }
  return store;
}
test("30 words supply three valid curated question types with unique options and cloze gaps", () => {
  assert.equal(mockVocabulary.length, 30);
  for (const w of mockVocabulary)
    for (const type of [
      "en_to_zh",
      "zh_to_en",
      "sentence_blank",
    ] as VocabularyQuestionType[]) {
      const q = vocabularyQuestion(w, mockVocabulary, type);
      assert.equal(q.options.length, 4);
      assert.equal(new Set(q.options.map((o) => o.id)).size, 4);
      assert.ok(q.options.find((o) => o.id === q.answerId));
      if (q.type === "fill_blank") {
        assert.ok(q.sentence.includes("_____"));
        assert.ok(!new RegExp(`\\b${w.word}\\b`, "i").test(q.sentence));
      }
    }
});
test("unknown changes mastery but not wordbook; other cards separate it from consolidation", () => {
  const store = begin();
  const s = store.sessions.learn;
  assert.equal(s.phase, "card");
  const next = updateVocabulary(
    store,
    "learn",
    { type: "self_report", value: "unknown" },
    now,
  );
  assert.equal(next.states[word.id].masteryStatus, "weak");
  assert.equal(next.states[word.id].addedToWordbook, false);
  assert.equal(next.sessions.learn.phase, "card");
  assert.equal(next.sessions.learn.cardIndex, 1);
  assert.deepEqual(next.sessions.learn.lesson.records, {});
});
test("recognition and one correct answer never imply mastery; immediate repeats cannot promote mastery", () => {
  let state = markSelfReport(newVocabularyState(word, now), false, now);
  state = applyVocabularyResult(state, correct, "en_to_zh", now, false);
  assert.equal(state.masteryStatus, "learning");
  assert.equal(state.consecutiveCorrect, 0);
  const due = state.nextReviewAt;
  for (let i = 0; i < 8; i++)
    state = applyVocabularyResult(state, correct, "zh_to_en", now, true);
  assert.equal(state.masteryStatus, "learning");
  assert.equal(state.consecutiveCorrect, 0);
  assert.equal(state.nextReviewAt, due);
});
test("three spaced, different-type review successes master a word; errors weaken it again", () => {
  let state = applyVocabularyResult(
    newVocabularyState(word, now),
    correct,
    "en_to_zh",
    now,
    false,
  );
  for (const [days, type] of [
    [1, "en_to_zh"],
    [4, "zh_to_en"],
    [11, "sentence_blank"],
  ] as const)
    state = applyVocabularyResult(state, correct, type, when(days), true);
  assert.equal(state.masteryStatus, "mastered");
  assert.equal(state.nextReviewAt, when(41));
  assert.ok(state.needsReview);
  const wrong: AnswerRecord = {
    initial: [
      { optionId: "x", correct: false, hinted: false },
      { optionId: "x", correct: false, hinted: false },
    ],
    retest: [{ optionId: word.id, correct: true, hinted: false }],
    hintUsed: false,
    initialResult: "wrong",
    retestResult: "first_try_correct",
  };
  state = applyVocabularyResult(state, wrong, "en_to_zh", when(42), true);
  assert.equal(state.masteryStatus, "weak");
  assert.equal(state.wrongCount, 2);
  assert.equal(state.consecutiveCorrect, 0);
  assert.equal(state.independentTypes.length, 0);
});
test("due boundary includes exact time and mastered words return after longer interval", () => {
  const state = {
    ...newVocabularyState(word, now),
    masteryStatus: "weak" as const,
    needsReview: true,
  };
  const nextReviewAt = scheduleReview(state, now);
  const states = { [word.id]: { ...state, nextReviewAt } };
  assert.equal(nextReviewAt, "2026-09-17T06:00:00.000Z");
  assert.equal(
    getWordsDueForReview(states, "2026-09-17T05:59:59.999Z").length,
    0,
  );
  assert.equal(getWordsDueForReview(states, nextReviewAt).length, 1);
});
test("a correct due review advances a weak word without prematurely promoting mastery", () => {
  const initial = applyVocabularyResult(
    markSelfReport(newVocabularyState(word, now), true, now),
    correct,
    "en_to_zh",
    now,
    false,
  );
  const next = applyVocabularyResult(
    initial,
    correct,
    "zh_to_en",
    initial.nextReviewAt!,
    true,
  );
  assert.equal(next.masteryStatus, "weak");
  assert.equal(next.consecutiveCorrect, 0);
  assert.equal(next.nextReviewAt, "2026-09-17T10:00:00.000Z");
  assert.equal(
    getWordsDueForReview({ [word.id]: next }, initial.nextReviewAt!).length,
    0,
  );
  assert.equal(
    getWordsDueForReview({ [word.id]: next }, "2026-09-17T18:00:00+08:00")
      .length,
    1,
  );
});

test("all-wrong vocabulary uses V2 retry and one retest, progress never reverses", () => {
  let store = begin();
  let progress = 0,
    checks = 0;
  while (store.sessions.learn.phase !== "complete") {
    const s = store.sessions.learn;
    if (s.phase === "card")
      store = updateVocabulary(
        store,
        "learn",
        { type: "self_report", value: "unknown" },
        now,
      );
    else if (["feedback", "review_intro"].includes(s.lesson.phase))
      store = updateVocabulary(
        store,
        "learn",
        { type: "lesson", action: { type: "continue", now, today: day } },
        now,
      );
    else {
      store = submit(store, "learn", false);
      checks++;
    }
    const next = store.sessions.learn;
    const value = sessionProgress(next.lesson, next.definition);
    assert.ok(value >= progress);
    progress = value;
  }
  assert.equal(checks, 15);
  assert.equal(progress, 100);
  for (const r of Object.values(store.sessions.learn.lesson.records))
    assert.equal(r.retestResult, "unmastered");
});
test("word learning rewards once; same-day extra practice gives zero; later reviews give less", () => {
  const store = finish(begin(), "learn");
  assert.equal(store.sessions.learn.rewardXp, 10);
  assert.equal(store.daily[day].completedWordIds.length, 5);
  assert.deepEqual(
    updateVocabulary(
      store,
      "learn",
      { type: "lesson", action: { type: "continue", now, today: day } },
      now,
    ),
    store,
  );
  let review = startVocabulary(
    store,
    "single_review",
    day,
    now,
    "again",
    word.id,
  ).store;
  review = finish(review, "again");
  assert.equal(review.sessions.again.rewardXp, 0);
  const started = startVocabulary(
    review,
    "single_review",
    "2026-09-18",
    when(1),
    "later",
    word.id,
  );
  let later = started.store;
  later = submit(later, "later", true);
  later = updateVocabulary(
    later,
    "later",
    {
      type: "lesson",
      action: { type: "continue", now: when(1), today: "2026-09-18" },
    },
    when(1),
  );
  assert.equal(later.sessions.later.rewardXp, 1);
});
test("daily plans prioritize new words, keep twenty slots and allow a new day beside unfinished work", () => {
  let store = begin();
  assert.equal(
    startVocabulary(store, "learn", "2026-09-18", when(1), "new").id,
    "new",
  );
  store = finish(store, "learn");
  const tomorrow = planFor(store, "2026-09-18");
  assert.ok(!tomorrow.wordIds.includes(word.id));
  const all = {
    ...store,
    states: Object.fromEntries(
      mockVocabulary.map((w) => [
        w.id,
        { ...newVocabularyState(w, now), masteryStatus: "learning" as const },
      ]),
    ),
  };
  assert.equal(planFor(all, "2026-09-19").wordIds.length, 20);
  assert.equal(
    startVocabulary(all, "due_review", day, now, "due").id,
    undefined,
  );
});
test("cards, choices, retry, feedback and completion survive storage; invalid session isolated", () => {
  let store = begin();
  const io = memory();
  for (let i = 0; i < 5; i++) {
    saveVocabularyStore(io, store);
    assert.deepEqual(loadVocabularyStore(io).store, store);
    store = updateVocabulary(
      store,
      "learn",
      { type: "self_report", value: "known" },
      now,
    );
  }
  store = submit(store, "learn", false);
  saveVocabularyStore(io, store);
  assert.deepEqual(loadVocabularyStore(io).store, store);
  store = finish(store, "learn");
  saveVocabularyStore(io, store);
  assert.deepEqual(loadVocabularyStore(io).store, store);
  const corrupted = JSON.parse(io.getItem(VOCABULARY_KEY)!);
  corrupted.sessions.bad = {
    ...corrupted.sessions.learn,
    id: "bad",
    cardIndex: 999,
  };
  io.setItem(VOCABULARY_KEY, JSON.stringify(corrupted));
  const loaded = loadVocabularyStore(io);
  assert.ok(loaded.issue);
  assert.ok(loaded.store.sessions.learn);
  assert.equal(loaded.store.sessions.bad, undefined);
  assert.deepEqual(loaded.store.states, store.states);
  assert.equal(loadVocabularyStore(undefined).persistent, false);
  assert.equal(saveVocabularyStore(undefined, store), false);
});
test("frozen question definition survives changes to mastery made in other sessions", () => {
  const store = begin();
  const definition = structuredClone(store.sessions.learn.definition);
  store.states[word.id] = { ...newVocabularyState(word, now), reviewCount: 5 };
  assert.deepEqual(store.sessions.learn.definition, definition);
  assert.ok(wordById(word.id));
});

function completeDaily() {
  let store = emptyVocabularyStore();
  for (let i = 0; i < 4; i++) {
    const id = `daily${i}`;
    store = finish(startVocabulary(store, "learn", day, now, id).store, id);
  }
  return store;
}

test("extra 10 then 20 keeps daily at twenty, counts thirty, and cannot farm XP", () => {
  let store = completeDaily();
  const daily = structuredClone(store.daily[day]);
  for (const target of [10, 20]) {
    for (let group = 0; group < target / 5; group++) {
      const id = `extra${target}-${group}`;
      store = startVocabulary(
        store,
        "extra",
        day,
        now,
        id,
        undefined,
        target,
      ).store;
      assert.equal(store.sessions[id].phase, "card");
      assert.equal(new Set(store.sessions[id].wordIds).size, 5);
      store = finish(store, id);
      const io = memory();
      saveVocabularyStore(io, store);
      assert.deepEqual(loadVocabularyStore(io).store, store);
    }
    assert.deepEqual(store.daily[day], daily);
  }
  assert.equal(vocabularyDayStats(store, day).extra, 30);
  assert.equal(vocabularyDayStats(store, day).xp, 60);
  assert.equal(planFor(store, "2026-09-18").wordIds.length, 20);
  assert.equal(planFor(store, "2026-09-18").completedWordIds.length, 0);
  assert.equal(
    Object.values(store.states).some((s) => s.masteryStatus === "mastered"),
    false,
  );
  const batch = Object.values(store.batches)[1];
  assert.equal(batchProgress(store, batch.id).completed, 20);
  assert.equal(batchProgress(store, batch.id).xp, 0);
});

test("custom counts are validated, generated lazily, and a partial extra group resumes", () => {
  assert.equal(
    startVocabulary(
      emptyVocabularyStore(),
      "extra",
      day,
      now,
      "early",
      undefined,
      10,
    ).id,
    undefined,
  );
  const initial = completeDaily();
  for (const quantity of [0, -1, 1.5, NaN, Infinity])
    assert.equal(
      startVocabulary(
        initial,
        "extra",
        day,
        now,
        "invalid",
        undefined,
        quantity,
      ).id,
      undefined,
    );
  assert.equal(
    startVocabulary(initial, "extra", day, now, "large", undefined, 100000)
      .store.sessions.large.wordIds.length,
    5,
  );
  let store = startVocabulary(
    initial,
    "extra",
    day,
    now,
    "seven",
    undefined,
    7,
  ).store;
  store = updateVocabulary(
    store,
    "seven",
    { type: "self_report", value: "unknown" },
    now,
  );
  const io = memory();
  saveVocabularyStore(io, store);
  store = loadVocabularyStore(io).store;
  assert.equal(
    startVocabulary(
      store,
      "extra",
      "2026-09-18",
      when(1),
      "duplicate",
      undefined,
      20,
    ).id,
    "seven",
  );
  assert.equal(store.sessions.seven.cardIndex, 1);
  store = finish(store, "seven");
  store = startVocabulary(store, "extra", day, now, "last").store;
  assert.equal(store.sessions.last.wordIds.length, 2);
  store = finish(store, "last");
  assert.equal(vocabularyDayStats(store, day).extra, 7);
});

test("V3 migration preserves incomplete sessions, wordbook and rewards; corrupt batches are isolated", () => {
  const io = memory();
  const store = begin();
  store.states[word.id] = {
    ...newVocabularyState(word, now),
    addedToWordbook: true,
  };
  const legacy: Record<string, unknown> = { ...store, schemaVersion: 1 };
  delete legacy.batches;
  io.setItem(VOCABULARY_KEY, JSON.stringify(legacy));
  const loaded = loadVocabularyStore(io);
  assert.equal(loaded.issue, undefined);
  assert.equal(loaded.store.schemaVersion, 2);
  assert.deepEqual(loaded.store.sessions, store.sessions);
  assert.equal(loaded.store.states[word.id].addedToWordbook, true);
  const extra = startVocabulary(
    completeDaily(),
    "extra",
    day,
    now,
    "bad",
    undefined,
    10,
  ).store;
  const batch = Object.values(extra.batches)[0];
  batch.sessionIds.push("missing");
  saveVocabularyStore(io, extra);
  const recovered = loadVocabularyStore(io);
  assert.ok(recovered.issue);
  assert.equal(recovered.store.sessions.bad, undefined);
  assert.equal(recovered.store.daily[day].completedWordIds.length, 20);
});

test("extra completions use Shanghai completion date and do not consume tomorrow's daily quota", () => {
  let store = startVocabulary(
    completeDaily(),
    "extra",
    day,
    now,
    "midnight",
    undefined,
    5,
  ).store;
  for (let i = 0; i < 5; i++)
    store = updateVocabulary(
      store,
      "midnight",
      { type: "self_report", value: "known" },
      now,
    );
  for (let i = 0; i < 5; i++) {
    store = submit(store, "midnight", true);
    store = updateVocabulary(
      store,
      "midnight",
      {
        type: "lesson",
        action: { type: "continue", now: when(1), today: "2026-09-18" },
      },
      when(1),
    );
  }
  assert.equal(vocabularyDayStats(store, day).extra, 0);
  assert.equal(vocabularyDayStats(store, "2026-09-18").extra, 5);
  assert.equal(vocabularyDayStats(store, "2026-09-18").xp, 10);
  const next = startVocabulary(
    store,
    "learn",
    "2026-09-18",
    when(1),
    "tomorrow",
  ).store;
  assert.equal(next.daily["2026-09-18"].wordIds.length, 20);
  assert.equal(next.daily["2026-09-18"].completedWordIds.length, 0);
});
