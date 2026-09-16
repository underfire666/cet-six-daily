import test from "node:test";
import assert from "node:assert/strict";
import { mockLesson } from "../src/data/mockLesson";
import {
  createSession,
  currentQuestion,
  firstSubmissionAccuracy,
  reduceSession,
  sessionProgress,
} from "../src/lib/lesson/session";
import {
  calendarLesson,
  createProfile,
  finishSession,
  streakFor,
  userFor,
} from "../src/lib/lesson/profile";
import {
  createStudyStorage,
  PREFIX,
  validSession,
  type KeyStorage,
} from "../src/lib/lesson/storage";
import type { LessonSession } from "../src/types/session";
const day = "2026-09-16",
  now = `${day}T10:00:00Z`;
const fresh = (id = "test") => createSession(day, "daily", mockLesson, id, now);
function answer(s: LessonSession, correct: boolean) {
  const q = currentQuestion(s, mockLesson)!;
  const optionId = correct
    ? q.answerId
    : q.options.find((o) => o.id !== q.answerId)!.id;
  return reduceSession(
    reduceSession(s, { type: "select", optionId }, mockLesson),
    { type: "check" },
    mockLesson,
  );
}
const next = (s: LessonSession, today = day) =>
  reduceSession(s, { type: "continue", now, today }, mockLesson);
function complete(s = fresh(), today = day) {
  while (s.phase !== "complete")
    s =
      s.phase === "feedback" || s.phase === "review_intro"
        ? next(s, today)
        : answer(s, true);
  return s;
}
class MemoryStorage implements KeyStorage {
  data = new Map<string, string>();
  get length() {
    return this.data.size;
  }
  key(i: number) {
    return [...this.data.keys()][i] ?? null;
  }
  getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.data.set(k, v);
  }
  removeItem(k: string) {
    this.data.delete(k);
  }
}
test("first mistake hides terminal result and does not permit an empty second submission", () => {
  const s = answer(fresh(), false);
  assert.equal(s.phase, "retry");
  assert.equal(s.selected, null);
  assert.equal(s.records["v-sustain"].initialResult, undefined);
  assert.deepEqual(reduceSession(s, { type: "check" }, mockLesson), s);
  assert.deepEqual(next(s), s);
  assert.equal(
    answer(s, true).records["v-sustain"].initialResult,
    "second_try_correct",
  );
});
test("hint result takes priority and survives a reload", () => {
  let s = reduceSession(fresh(), { type: "hint" }, mockLesson);
  s = JSON.parse(JSON.stringify(s));
  assert.ok(validSession(s));
  s = answer(s, true);
  assert.equal(s.records["v-sustain"].initialResult, "ai_hint_correct");
  assert.equal(firstSubmissionAccuracy(s, mockLesson), 11);
});
test("all-wrong session finishes after exactly one retest per question; progress never reverses", () => {
  let s = fresh(),
    previous = 0,
    checks = 0,
    intros = 0;
  while (s.phase !== "complete") {
    assert.ok(validSession(s));
    if (s.phase === "review_intro") {
      intros++;
      s = next(s);
    } else if (s.phase === "feedback") s = next(s);
    else {
      s = answer(s, false);
      checks++;
    }
    const progress = sessionProgress(s, mockLesson);
    assert.ok(progress >= previous);
    previous = progress;
    assert.ok(checks <= 27);
  }
  assert.equal(checks, 27);
  assert.equal(intros, 1);
  assert.equal(previous, 100);
  assert.equal(s.retestQueue.length, 9);
  assert.equal(firstSubmissionAccuracy(s, mockLesson), 0);
  for (const r of Object.values(s.records)) {
    assert.equal(r.initialResult, "wrong");
    assert.equal(r.retestResult, "unmastered");
    assert.equal(r.retest.length, 1);
  }
  assert.deepEqual(answer(s, true), s);
});
test("final original question gets a transition before retest; initial and retest records stay separate", () => {
  let s = fresh();
  for (let i = 0; i < 8; i++) s = next(answer(s, true));
  s = answer(answer(s, false), false);
  assert.equal(sessionProgress(s, mockLesson), 94);
  s = next(s);
  assert.equal(s.phase, "review_intro");
  s = next(s);
  assert.equal(currentQuestion(s, mockLesson)!.id, "r-breaks");
  s = answer(s, true);
  assert.equal(s.records["r-breaks"].initialResult, "wrong");
  assert.equal(s.records["r-breaks"].retestResult, "first_try_correct");
  assert.equal(sessionProgress(s, mockLesson), 100);
  assert.equal(firstSubmissionAccuracy(s, mockLesson), 89);
  assert.equal(next(s).phase, "complete");
});
test("every reachable session phase round-trips through storage", () => {
  let s = fresh();
  const storage = new MemoryStorage();
  const issues: string[] = [];
  const io = createStudyStorage(storage, (m) => issues.push(m));
  io.load(day);
  while (s.phase !== "complete") {
    io.saveSession(s);
    const loaded = io.load(day).sessions[`${day}:daily`];
    assert.deepEqual(loaded, s);
    s =
      s.phase === "feedback" || s.phase === "review_intro"
        ? next(s)
        : answer(s, false);
  }
  s = finishSession(createProfile(day), s).session;
  io.saveSession(s);
  assert.deepEqual(io.load(day).sessions[`${day}:daily`], s);
  assert.deepEqual(issues, []);
});
test("reward is granted once, same-day further practice and reviews grant none", () => {
  const first = finishSession(createProfile(day), complete());
  assert.equal(first.session.reward?.xp, 45);
  assert.equal(first.session.reward?.streak, 8);
  assert.equal(userFor(first.profile, day).xp, 1285);
  assert.deepEqual(finishSession(first.profile, first.session), first);
  const again = finishSession(first.profile, complete(fresh("again")));
  assert.equal(again.session.reward?.xp, 0);
  const review = finishSession(
    first.profile,
    complete({ ...fresh("review"), mode: "review" }),
  );
  assert.equal(review.session.reward?.xp, 0);
  const other = finishSession(
    first.profile,
    complete({ ...fresh("other"), date: "2026-09-17" }),
  );
  assert.equal(other.session.reward?.xp, 0);
});
test("cross-midnight completion rewards actual date; seeded history stays frozen and unfinished past resumes", () => {
  const profile = createProfile(day);
  const session = complete(fresh(), "2026-09-17");
  const result = finishSession(profile, session);
  assert.ok(result.profile.rewardsByDay["2026-09-17"]);
  assert.equal(result.session.reward?.streak, 1);
  assert.equal(streakFor(profile, "2026-09-18"), 0);
  assert.equal(
    calendarLesson(day, "2026-09-17", profile, {}).status,
    "available",
  );
  assert.equal(
    calendarLesson(day, "2026-09-17", profile, { [`${day}:daily`]: fresh() })
      .inProgress,
    true,
  );
  assert.equal(calendarLesson("2026-09-17", day, profile, {}).status, "locked");
  assert.equal(
    calendarLesson("2026-09-15", "2026-09-18", profile, {}).status,
    "completed",
  );
});
test("corrupt/version-mismatched session resets only itself; storage denial falls back to memory", () => {
  const storage = new MemoryStorage();
  const issues: string[] = [];
  const io = createStudyStorage(storage, (m) => issues.push(m));
  io.load(day);
  io.saveSession(fresh());
  io.saveSession({ ...fresh("other"), date: "2026-09-17" });
  storage.setItem(
    `${PREFIX}session:${day}:daily`,
    JSON.stringify({ ...fresh(), lessonVersion: 999 }),
  );
  const loaded = io.load(day);
  assert.equal(loaded.sessions[`${day}:daily`], undefined);
  assert.ok(loaded.sessions["2026-09-17:daily"]);
  assert.equal(issues.length, 1);
  assert.equal(validSession({ ...fresh(), index: 100 }), false);
  assert.equal(validSession({ ...fresh(), phase: "complete" }), false);
  assert.equal(validSession({ ...fresh(), phase: "feedback" }), false);
  assert.equal(validSession({ ...fresh(), phase: "retry" }), false);
  assert.equal(validSession({ ...fresh(), index: 1 }), false);
  const denied = createStudyStorage(
    {
      ...storage,
      get length(): number {
        throw new Error("denied");
      },
      key() {
        throw new Error("denied");
      },
      getItem() {
        throw new Error("denied");
      },
      setItem() {
        throw new Error("denied");
      },
      removeItem() {},
    },
    (m) => issues.push(m),
  );
  denied.load(day);
  denied.saveSession(fresh());
  assert.deepEqual(denied.load(day).sessions[`${day}:daily`], fresh());
});
