import type { DailyPlanStore, StudyPreferences } from "@/types/dailyPlan";
import { generatePlan, planStatus, taskCompleted, type PlanCompletion } from "./generator";

export function applyPreferences(store: DailyPlanStore, today: string, pref: StudyPreferences, syncFuture: boolean, completion: PlanCompletion): DailyPlanStore {
  const plans = { ...store.plans };
  const current = plans[today];
  // 已完成的计划保留原任务，避免设置变更撤销完成或重复发奖。
  if (current?.status !== "completed") {
    const generated = generatePlan(today, pref.examDate, pref);
    const retained = current?.tasks.filter(t => !t.removed && (t.source === "rescheduled" || taskCompleted(current, t, completion))) ?? [];
    generated.tasks = [...retained, ...generated.tasks.filter(t => !retained.some(old => old.module === t.module && old.source !== "rescheduled"))].map((t, order) => ({ ...t, order }));
    generated.estimatedMinutes = generated.tasks.reduce((sum, t) => sum + t.estimatedMinutes, 0);
    generated.preferences = pref;
    generated.adjusted = true;
    generated.adjustmentReason = "preference_change";
    generated.status = planStatus(generated, completion);
    plans[today] = generated;
  }
  if (syncFuture) {
    for (const date of Object.keys(plans)) {
      if (date <= today || plans[date].status === "completed" || store.customizedDates.includes(date)) continue;
      const carried = plans[date].tasks.filter(t => t.source === "rescheduled").map(task => ({fromDate: task.rescheduledFrom!, task}));
      plans[date] = generatePlan(date, pref.examDate, pref, carried);
    }
  }
  return { ...store, plans, preferences: syncFuture ? pref : store.preferences, customizedDates: [...new Set([...store.customizedDates, today])] };
}
