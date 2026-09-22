import test from "node:test";
import assert from "node:assert/strict";
import {
  computeStudyStats,
  formatDuration,
  last7Days,
  summarizeDurations,
  summarizeObjective,
  summarizeReviewAnswers,
  weekStart,
} from "../src/lib/profile/stats";

test("summarizeObjective: first-try correct counts 1 attempt / 1 correct", () => {
  const r = summarizeObjective({
    q1: { initial: [{ correct: true }], initialResult: "first_try_correct" },
  });
  assert.deepEqual(r, { correct: 1, attempts: 1 });
});

test("summarizeObjective: first wrong then second correct counts 2 attempts / 1 correct", () => {
  const r = summarizeObjective({
    q1: {
      initial: [{ correct: false }, { correct: true }],
      initialResult: "second_try_correct",
    },
  });
  assert.deepEqual(r, { correct: 1, attempts: 2 });
});

test("summarizeObjective: two wrong attempts are NOT double-counted (bug fix)", () => {
  // 首轮双错：initial 数组 2 条 + initialResult="wrong"，此前会误计 3 attempts
  const r = summarizeObjective({
    q1: {
      initial: [{ correct: false }, { correct: false }],
      initialResult: "wrong",
    },
  });
  assert.deepEqual(r, { correct: 0, attempts: 2 });
});

test("summarizeObjective: retest attempts counted once", () => {
  const r = summarizeObjective({
    q1: {
      initial: [{ correct: true }],
      retest: [{ correct: false }, { correct: false }],
    },
  });
  assert.deepEqual(r, { correct: 1, attempts: 3 });
});

test("summarizeObjective: legacy record with only initialResult (no arrays) counts once", () => {
  const r = summarizeObjective({
    q1: { initialResult: "correct" },
    q2: { initialResult: "wrong" },
  });
  assert.deepEqual(r, { correct: 1, attempts: 2 });
});

test("summarizeObjective: hint-correct counts as correct attempt", () => {
  const r = summarizeObjective({
    q1: { initial: [{ correct: true }], initialResult: "ai_hint_correct" },
  });
  assert.deepEqual(r, { correct: 1, attempts: 1 });
});

test("summarizeReviewAnswers: counts only explicit boolean correct", () => {
  const r = summarizeReviewAnswers({
    a: { correct: true, result: "review_correct" },
    b: { correct: false, result: "wrong" },
    c: { result: "review_correct" }, // 缺 correct → 忽略
    d: {},
  });
  assert.deepEqual(r, { correct: 1, attempts: 2 });
});

test("summarizeDurations: sums real completedAt-startedAt, ignores corrupt values", () => {
  const sec = 1000;
  const r = summarizeDurations([
    { startedAt: "2026-09-22T08:00:00.000Z", completedAt: "2026-09-22T08:05:30.000Z" }, // 330s
    { startedAt: "2026-09-22T09:00:00.000Z", completedAt: "2026-09-22T09:02:00.000Z" }, // 120s
    { startedAt: "2026-09-22T10:00:00.000Z" }, // 无 completedAt → 忽略
    { completedAt: "2026-09-22T11:00:00.000Z" }, // 无 startedAt → 忽略
    { startedAt: "not-a-date", completedAt: "2026-09-22T12:00:00.000Z" }, // NaN → 忽略
    { startedAt: "2026-09-22T13:00:00.000Z", completedAt: "2026-09-21T13:00:00.000Z" }, // 负数 → 忽略
    { startedAt: "2026-09-22T00:00:00.000Z", completedAt: "2026-09-24T00:00:00.000Z" }, // 48h 超大 → 忽略
    { startedAt: "2026-09-22T14:00:00.000Z", completedAt: "Infinity" }, // Infinity → 忽略
    { startedAt: "2026-09-22T15:00:00.000Z", completedAt: "2026-09-22T15:01:00.000Z" }, // 60s
    { startedAt: undefined, completedAt: undefined },
  ]);
  assert.equal(r, (330 + 120 + 60) * sec / 1000);
});

test("summarizeDurations: empty input is 0, no NaN", () => {
  assert.equal(summarizeDurations([]), 0);
  assert.equal(summarizeDurations([{ startedAt: "x", completedAt: "y" }]), 0);
});

test("weekStart: Monday start, Sunday maps to previous Monday", () => {
  assert.equal(weekStart("2026-09-21"), "2026-09-21"); // 周一
  assert.equal(weekStart("2026-09-25"), "2026-09-21"); // 周五
  assert.equal(weekStart("2026-09-27"), "2026-09-21"); // 周日 → 同周周一
});

test("last7Days: returns 7 consecutive days ending today", () => {
  const days = last7Days("2026-09-22");
  assert.equal(days.length, 7);
  assert.equal(days[6], "2026-09-22");
  assert.equal(days[0], "2026-09-16");
});

test("computeStudyStats: same-day multiple completions count 1 study day", () => {
  const s = computeStudyStats({
    completedDays: new Set(["2026-09-21", "2026-09-21", "2026-09-22"]),
    totalXp: 45,
    streak: 1,
    level: 1,
    levelTitle: "新手",
    objective: { correct: 1, attempts: 1 },
    wrongCount: 0,
    wordbookCount: 0,
    dueReviewCount: 0,
    xpByDay: {},
    completedSessions: [],
    today: "2026-09-22",
  });
  assert.equal(s.studyDays, 2);
  assert.equal(s.overallAccuracy, 100);
});

test("computeStudyStats: zero attempts → overallAccuracy null (暂无)", () => {
  const s = computeStudyStats({
    completedDays: new Set(),
    totalXp: 0,
    streak: 0,
    level: 1,
    levelTitle: "新手",
    objective: { correct: 0, attempts: 0 },
    wrongCount: 0,
    wordbookCount: 0,
    dueReviewCount: 0,
    xpByDay: {},
    completedSessions: [],
    today: "2026-09-22",
  });
  assert.equal(s.overallAccuracy, null);
});

test("computeStudyStats: weekly is Monday-Sunday in Shanghai dates", () => {
  const s = computeStudyStats({
    completedDays: new Set(["2026-09-20", "2026-09-21", "2026-09-26"]), // 周日(上周) 周一 周六(本周)
    totalXp: 0,
    streak: 0,
    level: 1,
    levelTitle: "新手",
    objective: { correct: 0, attempts: 0 },
    wrongCount: 0,
    wordbookCount: 0,
    dueReviewCount: 0,
    xpByDay: { "2026-09-21": 45, "2026-09-20": 10 }, // 周日 XP 不计入本周
    completedSessions: [],
    today: "2026-09-26",
  });
  assert.equal(s.weekly.studyDays, 2); // 周一 + 周六
  assert.equal(s.weekly.xp, 45); // 周日 10 XP 排除
});

test("computeStudyStats: weekly duration only includes sessions in current week", () => {
  const s = computeStudyStats({
    completedDays: new Set(),
    totalXp: 0,
    streak: 0,
    level: 1,
    levelTitle: "新手",
    objective: { correct: 0, attempts: 0 },
    wrongCount: 0,
    wordbookCount: 0,
    dueReviewCount: 0,
    xpByDay: {},
    completedSessions: [
      { startedAt: "2026-09-21T08:00:00.000Z", completedAt: "2026-09-21T08:02:00.000Z", day: "2026-09-21" }, // 本周 120s
      { startedAt: "2026-09-19T08:00:00.000Z", completedAt: "2026-09-19T08:03:00.000Z", day: "2026-09-19" }, // 上周 180s
    ],
    today: "2026-09-22",
  });
  assert.equal(s.totalDurationSeconds, 300);
  assert.equal(s.weekly.durationSeconds, 120);
});

test("formatDuration: minutes and hours", () => {
  assert.equal(formatDuration(0), "0 分钟");
  assert.equal(formatDuration(30 * 60), "30 分钟");
  assert.equal(formatDuration(90 * 60), "1小时30分");
  assert.equal(formatDuration(120 * 60), "2小时");
});
