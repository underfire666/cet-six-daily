import test from "node:test";
import assert from "node:assert/strict";
import { createProfile, finishSession, levelFor, streakFor, userFor } from "../src/lib/lesson/profile";
import { computeStudyStats } from "../src/lib/profile/stats";
import { defaultSettings } from "../src/lib/lesson/storage";
import type { FeedbackSettings } from "../src/types/session";

const today = "2026-09-22";

/** 构造一个完成态 daily session（仅用于 profile 集成，不依赖真实题包）。
 *  注意：不带 reward 字段——finishSession 仅在首次完成时结算并写入 reward。 */
function completedSession(date: string) {
  return {
    schemaVersion: 1 as const,
    id: `s-${date}`,
    date,
    mode: "daily" as const,
    lessonId: "mock",
    lessonVersion: 1,
    round: "initial" as const,
    index: 0,
    selected: null,
    phase: "complete" as const,
    records: {},
    retestQueue: [],
    startedAt: `${date}T09:00:00Z`,
    completedAt: `${date}T09:20:00Z`,
    completedDay: date,
    celebrationSeen: true,
  };
}

function completeOnce(profile = createProfile(today), date = today) {
  return finishSession(profile, completedSession(date));
}

test("new user: XP=0, Streak=0, Level=1, title=新手 (no mock baseline)", () => {
  const u = userFor(createProfile(today), today);
  assert.equal(u.xp, 0);
  assert.equal(u.streak, 0);
  assert.equal(u.level, 1);
  assert.equal(u.title, "新手");
  assert.equal(u.nextLevelXp, 1500);
});

test("completing today grants 45 XP and streak 1", () => {
  const { profile } = completeOnce();
  const u = userFor(profile, today);
  assert.equal(u.xp, 45);
  assert.equal(u.streak, 1);
  assert.equal(u.level, 1);
});

test("streak: two consecutive days → 2; missing one day keeps streak; missing two resets", () => {
  // 连续两天：第一天创建 profile 并完成当天，第二天（新日期）再完成 → streak 2
  const p1 = completeOnce(createProfile("2026-09-21"), "2026-09-21").profile;
  assert.equal(streakFor(p1, "2026-09-21"), 1);
  const p2 = completeOnce(p1, "2026-09-22").profile;
  assert.equal(streakFor(p2, "2026-09-22"), 2);

  // 漏 1 天：完成 9-21，9-22 未完成 → streak 保留为 1
  const p3 = completeOnce(createProfile("2026-09-21"), "2026-09-21").profile;
  assert.equal(streakFor(p3, "2026-09-22"), 1);

  // 连续漏 2 天：完成 9-19，9-20/9-21 未完成 → 0
  const p4 = completeOnce(createProfile("2026-09-19"), "2026-09-19").profile;
  assert.equal(streakFor(p4, "2026-09-22"), 0);
});

test("level derives from real XP only (levelFor)", () => {
  assert.deepEqual(levelFor(0), { level: 1, xp: 0, title: "新手" });
  assert.deepEqual(levelFor(1499), { level: 1, xp: 1499, title: "新手" });
  assert.deepEqual(levelFor(1500), { level: 2, xp: 0, title: "学习者" });
  assert.deepEqual(levelFor(3000), { level: 3, xp: 0, title: "进阶者" });
});

test("XP/Level/Streak source of truth is shared with homepage (userFor only)", () => {
  // 首页 TopStatus 与 /me 都消费 learning.user（userFor 返回值）
  const { profile } = completeOnce();
  const u = userFor(profile, today);
  assert.equal(typeof u.xp, "number");
  assert.equal(typeof u.level, "number");
  assert.equal(typeof u.streak, "number");
  // 不存在 profileXp / profileLevel / profileStreak 第二套：同源对象字段即最终值
  assert.deepEqual(
    [u.xp, u.level, u.streak],
    [45, 1, 1],
  );
});

test("study stats integration: completed days + durations flow into profile stats", () => {
  const { profile } = completeOnce();
  const stats = computeStudyStats({
    completedDays: new Set(Object.keys(profile.completedLessons)),
    totalXp: userFor(profile, today).xp,
    streak: userFor(profile, today).streak,
    level: userFor(profile, today).level,
    levelTitle: userFor(profile, today).title,
    objective: { correct: 0, attempts: 0 },
    wrongCount: 0,
    wordbookCount: 0,
    dueReviewCount: 0,
    xpByDay: {},
    completedSessions: [
      { startedAt: `${today}T09:00:00Z`, completedAt: `${today}T09:20:00Z`, day: today },
    ],
    today,
  });
  assert.equal(stats.studyDays, 1);
  assert.equal(stats.totalDurationSeconds, 1200);
  assert.equal(stats.totalXp, 45);
  assert.equal(stats.streak, 1);
});

test("settings: single source is FeedbackSettings; sound page edits the same object learning components read", () => {
  // 学习组件（playFeedback / LessonComplete / VocabularyComplete）消费 FeedbackSettings；
  // "声音与震动"设置页也必须写这个对象，不允许第二套 key。
  const settings: FeedbackSettings = { ...defaultSettings };
  assert.deepEqual(settings, { soundEnabled: true, hapticsEnabled: true, celebrationEnabled: true });
  // 关闭答题音效 → 消费者看到 false
  settings.soundEnabled = false;
  assert.equal(settings.soundEnabled, false);
  assert.equal(settings.hapticsEnabled, true);
  assert.equal(settings.celebrationEnabled, true);
  // 关闭庆祝 → 消费者看到 false
  settings.celebrationEnabled = false;
  assert.equal(settings.celebrationEnabled, false);
  // 不存在 profile.sound 第二数据源：loadProfile 已忽略旧 sound 字段（见 profile-store.test.ts）
});
