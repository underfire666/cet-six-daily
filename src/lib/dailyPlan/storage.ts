import type {
  DailyPlan,
  DailyPlanStore,
  PlanModule,
  SimpleWeight,
  StudyPreferences,
} from "@/types/dailyPlan";
import { DEFAULT_PREFERENCES } from "./config";
import type { KeyStorage } from "@/lib/lesson/storage";

export const DAILY_PLAN_KEY = "cet-daily:v1:daily-plan";

export const emptyDailyPlanStore = (): DailyPlanStore => ({
  schemaVersion: 1,
  plans: {},
  preferences: { ...DEFAULT_PREFERENCES },
  completionLedger: {},
  customizedDates: [],
});

const obj = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const str = (v: unknown): v is string => typeof v === "string";
const num = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v);
const bool = (v: unknown): v is boolean => typeof v === "boolean";
const dateRe = /^\d{4}-\d{2}-\d{2}$/;

function validTask(v: unknown): v is DailyPlan["tasks"][number] {
  if (!obj(v)) return false;
  return (
    str(v.id) &&
    ["vocabulary", "reading", "listening", "translation", "writing"].includes(
      String(v.module),
    ) &&
    str(v.target) &&
    num(v.estimatedMinutes) &&
    num(v.order) &&
    ["low", "normal", "high"].includes(String(v.priority)) &&
    ["system", "user", "rescheduled"].includes(String(v.source))
  );
}

function validPlan(v: unknown): v is DailyPlan {
  if (!obj(v)) return false;
  return (
    str(v.date) &&
    dateRe.test(v.date) &&
    ["foundation", "improvement", "sprint"].includes(String(v.phase)) &&
    num(v.estimatedMinutes) &&
    Array.isArray(v.tasks) &&
    v.tasks.every(validTask) &&
    (v.preferences === undefined || validPref(v.preferences)) &&
    ["empty", "in_progress", "completed", "adjusted"].includes(String(v.status)) &&
    str(v.generatedAt) &&
    bool(v.adjusted) &&
    v.planVersion === 1
  );
}

function validPref(v: unknown): v is StudyPreferences {
  if (!obj(v)) return false;
  const simple = v.simple;
  const advanced = v.advanced;
  if (!obj(simple) || !obj(advanced)) return false;
  const validSimple = (x: unknown): x is SimpleWeight =>
    x === "focus" || x === "normal" || x === "sparse";
  const modules: PlanModule[] = ["vocabulary", "reading", "listening", "translation", "writing"];
  return (
    str(v.examDate) &&
    dateRe.test(v.examDate) &&
    ["light", "standard", "intense"].includes(String(v.intensity)) &&
    ["simple", "advanced"].includes(String(v.mode)) &&
    modules.every((k) => validSimple(simple[k])) &&
    modules.every((k) => num(advanced[k])) &&
    v.planVersion === 1
  );
}

export function loadDailyPlanStore(
  storage: KeyStorage | undefined,
): { store: DailyPlanStore; persistent: boolean; issue?: string } {
  const unavailable = {
    store: emptyDailyPlanStore(),
    persistent: false,
    issue: "浏览器无法读取学习计划存储，本次计划进度不会保存。",
  };
  if (!storage) return unavailable;
  let raw: string | null;
  try {
    raw = storage.getItem(DAILY_PLAN_KEY);
  } catch {
    return unavailable;
  }
  if (!raw) return { store: emptyDailyPlanStore(), persistent: true };
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return {
      store: emptyDailyPlanStore(),
      persistent: true,
      issue: "学习计划文件已损坏，已重新开始。",
    };
  }
  if (!obj(value) || value.schemaVersion !== 1) {
    return {
      store: emptyDailyPlanStore(),
      persistent: true,
      issue: "学习计划版本不兼容，已重新开始。",
    };
  }
  const store = emptyDailyPlanStore();
  let issue: string | undefined;
  if (validPref(value.preferences)) store.preferences = value.preferences;
  if (obj(value.plans))
    for (const [date, plan] of Object.entries(value.plans)) {
      if (validPlan(plan)) store.plans[date] = plan;
      else issue = issue ?? "部分学习计划无法读取，已保留其他有效计划。";
    }
  if (obj(value.completionLedger))
    for (const [k, xp] of Object.entries(value.completionLedger)) {
      if (str(k) && num(xp) && xp >= 0) store.completionLedger[k] = xp;
    }
  if (Array.isArray(value.customizedDates))
    store.customizedDates = value.customizedDates.filter(
      (d): d is string => str(d) && dateRe.test(d),
    );
  return { store, persistent: true, ...(issue ? { issue } : {}) };
}

export function saveDailyPlanStore(
  storage: KeyStorage | undefined,
  store: DailyPlanStore,
): boolean {
  try {
    if (!storage) return false;
    storage.setItem(DAILY_PLAN_KEY, JSON.stringify(store));
    return true;
  } catch {
    return false;
  }
}
