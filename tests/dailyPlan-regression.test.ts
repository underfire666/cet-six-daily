import test from "node:test";
import assert from "node:assert/strict";
import { generatePlan, planStatus, taskCompleted, type PlanCompletion } from "../src/lib/dailyPlan/generator";
import { DEFAULT_PREFERENCES, INTENSITY_MINUTES } from "../src/lib/dailyPlan/config";
import { applyPreferences } from "../src/lib/dailyPlan/preferences";
import { emptyDailyPlanStore, loadDailyPlanStore, saveDailyPlanStore } from "../src/lib/dailyPlan/storage";
import type { StudyPreferences } from "../src/types/dailyPlan";

const date = "2026-09-21";
const pref = DEFAULT_PREFERENCES;
const empty = (): PlanCompletion => Object.fromEntries(["vocabulary", "reading", "listening", "translation", "writing"].map(m => [m, { completed: false, done: 0 }])) as PlanCompletion;

test("V8: intensity changes actual work and stays in the advertised time range", () => {
  const counts = [];
  for (const intensity of ["light", "standard", "intense"] as const) {
    for (const focus of ["reading", "writing", "translation", "listening"] as const) {
      const plan = generatePlan(date, pref.examDate, { ...pref, intensity, simple: { ...pref.simple, [focus]: "focus" } });
      const [min, max] = INTENSITY_MINUTES[intensity];
      assert.ok(plan.estimatedMinutes >= min && plan.estimatedMinutes <= max);
      assert.equal(plan.estimatedMinutes, plan.tasks.reduce((n,t) => n + t.estimatedMinutes, 0));
    }
    counts.push(generatePlan(date, pref.examDate, { ...pref, intensity }).tasks.length);
  }
  assert.deepEqual(counts, [2,3,4]);
});

test("V8: one reading/listening item meets its displayed goal, not the full specialist quota", () => {
  const plan = generatePlan(date, pref.examDate, pref);
  const snapshot = empty();
  snapshot.vocabulary.done = 20;
  snapshot.reading.done = 1;
  snapshot.listening.done = 1;
  assert.equal(planStatus(plan, snapshot), "completed");
  const reading = plan.tasks.find(t => t.module === "reading")!;
  plan.tasks.push({ ...reading, id: "carried-reading", source: "rescheduled" });
  assert.equal(taskCompleted(plan, plan.tasks.at(-1)!, snapshot), false);
  snapshot.reading.done = 2;
  assert.equal(planStatus(plan, snapshot), "completed");
});

test("V8: today-only edits change today's plan, persist its settings, and leave future preferences intact", () => {
  const store = emptyDailyPlanStore();
  store.plans[date] = generatePlan(date, pref.examDate, pref);
  store.plans["2026-09-22"] = generatePlan("2026-09-22", pref.examDate, pref);
  const override: StudyPreferences = { ...pref, intensity: "intense", simple: { ...pref.simple, writing: "focus" } };
  const next = applyPreferences(store, date, override, false, empty());
  assert.equal(next.plans[date].tasks.length, 4);
  assert.deepEqual(next.preferences, store.preferences);
  assert.deepEqual(next.plans["2026-09-22"], store.plans["2026-09-22"]);
  let raw = "";
  const storage = { length: 1, key: () => "cet-daily:v1:daily-plan", removeItem: () => { raw = ""; }, getItem: () => raw, setItem: (_key: string, value: string) => { raw = value; } };
  assert.equal(saveDailyPlanStore(storage, next), true);
  assert.deepEqual(loadDailyPlanStore(storage).store.plans[date].preferences, override);
});

test("V8: global save updates today and future, preserving history and completed work", () => {
  const store = emptyDailyPlanStore();
  for (const d of ["2026-09-20", date, "2026-09-22"]) store.plans[d] = generatePlan(d, pref.examDate, pref);
  const snapshot = empty();
  snapshot.reading.done = 1;
  const next = applyPreferences(store, date, { ...pref, intensity: "light", simple: { ...pref.simple, writing: "focus" } }, true, snapshot);
  assert.deepEqual(next.plans["2026-09-20"], store.plans["2026-09-20"]);
  assert.equal(next.preferences.intensity, "light");
  assert.equal(next.plans["2026-09-22"].tasks.length, 2);
  assert.ok(next.plans[date].tasks.some(t => t.module === "reading" && taskCompleted(next.plans[date], t, snapshot)));
  store.plans[date].status = "completed";
  assert.deepEqual(applyPreferences(store,date,{...pref,intensity:"intense"},true,snapshot).plans[date],store.plans[date]);
});

test("V8: generation preserves task identities and removed tasks do not count as complete", () => {
  const plan = generatePlan(date, pref.examDate, pref);
  assert.deepEqual(plan, generatePlan(date, pref.examDate, pref));
  const snapshot = empty();
  snapshot.vocabulary.done = 20;
  plan.tasks[0].removed = true;
  assert.equal(taskCompleted(plan, plan.tasks[0], snapshot), false);
  assert.equal(planStatus(plan, snapshot), "empty");
});
