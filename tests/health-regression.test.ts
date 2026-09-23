import test from "node:test";
import assert from "node:assert/strict";
import { importReviewEvents } from "../src/lib/review/import";
import { emptyReviewStore, loadReviewStore, saveReviewStore } from "../src/lib/review/store";
import { applyReviewResult } from "../src/lib/review/scheduler";
import { computeStudyStats, weekStart } from "../src/lib/profile/stats";
import { loadProfile } from "../src/lib/profile/store";
import { createProfile, streakFor, totalXpFor, userFor } from "../src/lib/lesson/profile";

const now = "2026-09-23T08:00:00.000Z";
const session = { startedAt: "2026-09-22T08:00:00.000Z", articleId: "article", lesson: { records: {
  q: { initialResult: "wrong", initial: [{ correct: false, optionId: "B" }], retest: [{ correct: false, optionId: "C" }] },
} } };
const sources = [{ module: "reading" as const, sessions: { first: session } }];
test("cumulative XP does not wrap at level-up; completed plans contribute to streak", () => {
  const profile = createProfile("2026-09-23");
  profile.bonusXpEvents = { "reading:session": 1510, "daily-plan-complete:2026-09-22": 10, "daily-plan-complete:2026-09-23": 10 };
  assert.equal(totalXpFor(profile), 1530);
  assert.equal(userFor(profile, "2026-09-23").xp, 30);
  assert.equal(streakFor(profile, "2026-09-23"), 2);
});
function memory(raw = ""): Storage {
  return { length: 1, clear() { raw = ""; }, key() { return "key"; }, getItem() { return raw || null; }, setItem(_, value) { raw = value; }, removeItem() { raw = ""; } };
}

test("auto-import survives reload without resetting reviewed or removed questions", () => {
  const imported = importReviewEvents(emptyReviewStore(), sources, now);
  const id = Object.keys(imported.items)[0];
  assert.equal(imported.items[id].wrongCount, 1);
  imported.items = applyReviewResult(imported.items, id, true, now, "manual");
  imported.items[id].removed = true;
  const storage = memory();
  saveReviewStore(storage, imported);
  const loaded = loadReviewStore(storage).store;
  assert.strictEqual(importReviewEvents(loaded, sources, now), loaded);
  assert.equal(loaded.items[id].masteryStatus, "reviewing");
  assert.equal(loaded.items[id].removed, true);
  const next = importReviewEvents(loaded, [{ module: "reading", sessions: { second: session } }], now);
  assert.equal(next.items[id].removed, false);
  assert.equal(next.items[id].wrongCount, 2);
});

test("legacy import migration preserves existing review progress and imports missing questions", () => {
  const old = importReviewEvents(emptyReviewStore(), sources, now);
  delete old.importedEvents;
  const id = Object.keys(old.items)[0];
  old.items[id].masteryStatus = "mastered";
  const migrated = importReviewEvents(old, sources, now);
  assert.equal(migrated.items[id].masteryStatus, "mastered");
  assert.equal(migrated.items[id].wrongCount, 1);
  assert.strictEqual(importReviewEvents(migrated, sources, now), migrated);
  assert.equal(Object.keys(importReviewEvents({ ...old, items: {} }, sources, now).items).length, 1);
});

test("weekly stats combine specialist days and rewards without counting same day twice", () => {
  const stats = computeStudyStats({ completedDays: new Set(["2026-09-22"]), totalXp: 57, streak: 1, level: 1, levelTitle: "新手",
    objective: { correct: 0, attempts: 0 }, wrongCount: 0, wordbookCount: 0, dueReviewCount: 0,
    xpByDay: { "2026-09-23": 12 }, today: "2026-09-23",
    completedSessions: [{ day: "2026-09-22", rewardXp: 20 }, { day: "2026-09-23", rewardXp: 25 }, { day: "2026-09-20", rewardXp: 10 }],
  });
  assert.equal(stats.studyDays, 3);
  assert.equal(stats.weekly.studyDays, 2);
  assert.equal(stats.weekly.xp, 57);
  assert.equal(stats.last7.at(-1)?.studied, true);
});

test("Shanghai calendar week does not depend on device timezone", () => {
  const previous = process.env.TZ;
  try {
    for (const tz of ["UTC", "America/Los_Angeles", "Asia/Shanghai"]) {
      process.env.TZ = tz;
      assert.equal(weekStart("2026-09-21"), "2026-09-21");
      assert.equal(weekStart("2026-09-27"), "2026-09-21");
    }
  } finally {
    if (previous === undefined) delete process.env.TZ;
    else process.env.TZ = previous;
  }
});

test("malformed reminder preferences cannot become truthy switches", () => {
  const loaded = loadProfile(memory(JSON.stringify({ schemaVersion: 1, reminders: { evening: false, miss: "false", lastChance: null } })));
  assert.deepEqual(loaded.profile.reminders, { evening: false, miss: true, lastChance: true });
});
