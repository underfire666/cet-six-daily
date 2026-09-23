import test from "node:test";
import assert from "node:assert/strict";
import { defaultProfile, loadProfile, saveProfile, PROFILE_KEY } from "../src/lib/profile/store";

class MemoryStorage implements Storage {
  data = new Map<string, string>();
  get length() {
    return this.data.size;
  }
  clear() {
    this.data.clear();
  }
  getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  key(i: number) {
    return [...this.data.keys()][i] ?? null;
  }
  removeItem(k: string) {
    this.data.delete(k);
  }
  setItem(k: string, v: string) {
    this.data.set(k, v);
  }
}

test("loadProfile: empty storage returns default profile", () => {
  const { profile, issue } = loadProfile(new MemoryStorage());
  assert.equal(profile.targetScore, 500);
  assert.deepEqual(profile.reminders, { evening: true, miss: true, lastChance: true });
  assert.equal(issue, undefined);
});

test("loadProfile: corrupt JSON resets to default with issue, does not throw", () => {
  const s = new MemoryStorage();
  s.setItem(PROFILE_KEY, "{not valid json");
  const { profile, issue } = loadProfile(s);
  assert.equal(profile.targetScore, 500);
  assert.ok(issue && issue.includes("损坏"));
});

test("loadProfile: unknown schemaVersion resets to default with issue", () => {
  const s = new MemoryStorage();
  s.setItem(PROFILE_KEY, JSON.stringify({ schemaVersion: 99, targetScore: 600 }));
  const { profile, issue } = loadProfile(s);
  assert.equal(profile.targetScore, 500);
  assert.ok(issue && issue.includes("版本不兼容"));
});

test("loadProfile: legacy sound field is ignored (single settings source)", () => {
  // V11 修复前旧数据含 profile.sound —— 加载后不再保留该字段，且不影响 targetScore/reminders
  const s = new MemoryStorage();
  s.setItem(
    PROFILE_KEY,
    JSON.stringify({
      schemaVersion: 1,
      targetScore: 550,
      reminders: { evening: false, miss: true, lastChance: true },
      sound: { answerSound: false, haptic: false, celebration: false },
      createdAt: "2026-09-22T00:00:00.000Z",
    }),
  );
  const { profile, issue } = loadProfile(s);
  assert.equal(profile.targetScore, 550);
  assert.equal(profile.reminders.evening, false);
  assert.equal((profile as unknown as Record<string, unknown>).sound, undefined);
  assert.equal(issue, undefined);
});

test("loadProfile: invalid targetScore falls back to default, reminders merge safely", () => {
  const s = new MemoryStorage();
  s.setItem(
    PROFILE_KEY,
    JSON.stringify({
      schemaVersion: 1,
      targetScore: 999,
      reminders: { evening: false, bad: "x" },
    }),
  );
  const { profile } = loadProfile(s);
  assert.equal(profile.targetScore, 500);
  assert.equal(profile.reminders.evening, false);
  assert.equal(profile.reminders.miss, true);
  assert.equal(profile.reminders.lastChance, true);
});

test("saveProfile + loadProfile round-trips; updatedAt refreshed", () => {
  const s = new MemoryStorage();
  const p = { ...defaultProfile(), targetScore: 600 as const };
  assert.equal(saveProfile(s, p), true);
  const loaded = loadProfile(s).profile;
  assert.equal(loaded.targetScore, 600);
  assert.equal(loaded.updatedAt.length > 0, true);
});

test("saveProfile: storage denial returns false (no fake save)", () => {
  const denied = Object.assign(new MemoryStorage(), {
    setItem() {
      throw new Error("denied");
    },
  });
  assert.equal(saveProfile(denied, defaultProfile()), false);
});

test("loadProfile: storage unavailable returns default with issue", () => {
  const { profile, issue } = loadProfile(undefined);
  assert.equal(profile.targetScore, 500);
  assert.ok(issue && issue.includes("不可用"));
});
