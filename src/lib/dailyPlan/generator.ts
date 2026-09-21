import { addDays, dayDifference } from "@/lib/dates";
import type {
  DailyPlan,
  DailyTask,
  PlanModule,
  StudyPreferences,
} from "@/types/dailyPlan";
import {
  DAILY_LOAD_CAP,
  INTENSITY_MINUTES,
  MODULE_MINUTES,
  moduleWeights,
  phaseFactor,
  studyPhase,
  makeTask,
} from "./config";

/** 确定性伪随机：用 date 做种子，同一天结果稳定 */
function seedFromDate(date: string): number {
  let h = 0;
  for (const ch of date) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return Math.abs(h);
}

/** 词汇每天必出现；其余模块按权重 + 种子轮换 */
function pickModules(
  date: string,
  pref: StudyPreferences,
  phase: ReturnType<typeof studyPhase>,
): PlanModule[] {
  const weights = moduleWeights(pref);
  // 词汇每天必学
  const pool: PlanModule[] = ["reading", "listening", "translation", "writing"];
  const seed = seedFromDate(date);

  // 按权重随机选 2 个（sprint 期选 3 个）
  const targetExtra = phase === "sprint" ? 2 : 1;
  const chosen = new Set<PlanModule>();
  let cursor = seed;
  const weighted = pool
    .map((m) => ({ m, w: weights[m] }))
    .sort((a, b) => {
      // 确定性排序：权重高的优先，但用 seed 打破同权重平局
      const diff = b.w - a.w;
      if (diff !== 0) return diff;
      return (seed + a.m.length) % 7 - (seed + b.m.length) % 7;
    });
  for (const { m } of weighted) {
    if (chosen.size >= targetExtra) break;
    chosen.add(m);
    cursor = (cursor * 1103515245 + 12345) & 0x7fffffff;
  }
  // 保底：至少选 1 个
  if (chosen.size === 0) chosen.add(weighted[0].m);
  return ["vocabulary", ...chosen];
}

export function estimatePlanMinutes(
  modules: PlanModule[],
  pref: StudyPreferences,
  phase: ReturnType<typeof studyPhase>,
): number {
  const base = modules.reduce((n, m) => n + MODULE_MINUTES[m], 0);
  const factor = phaseFactor(phase);
  return Math.round(base * factor);
}

/**
 * 生成某天的 DailyPlan（纯函数，确定性）。
 * @param date 目标日
 * @param pref 用户偏好
 * @param rescheduledTasks 从过去顺延来的任务（{fromDate, task}）
 */
export function generatePlan(
  date: string,
  examDate: string,
  pref: StudyPreferences,
  rescheduledTasks: { fromDate: string; task: DailyTask }[] = [],
): DailyPlan {
  const daysUntilExam = dayDifference(date, examDate);
  const phase = studyPhase(daysUntilExam);
  const modules = pickModules(date, pref, phase);

  let tasks: DailyTask[] = modules.map((m, i) => makeTask(m, i));

  // 加入顺延任务
  for (const { fromDate, task } of rescheduledTasks) {
    tasks.push({
      ...task,
      id: `${task.id}->${date}`,
      source: "rescheduled",
      rescheduledFrom: fromDate,
      priority: task.priority === "high" ? "high" : "normal",
      order: tasks.length,
    });
  }

  // 负荷控制：超过 DAILY_LOAD_CAP 时，按优先级低的顺延任务砍掉
  const [minM, maxM] = INTENSITY_MINUTES[pref.intensity];
  const targetMin = Math.round(((minM + maxM) / 2) * phaseFactor(phase));
  let total = tasks.reduce((n, t) => n + t.estimatedMinutes, 0);
  if (total > DAILY_LOAD_CAP) {
    // 砍 rescheduled 且 low/normal 的任务
    tasks = tasks.filter((t) => {
      if (total <= DAILY_LOAD_CAP) return true;
      if (t.source === "rescheduled" && t.priority !== "high") {
        total -= t.estimatedMinutes;
        return false;
      }
      return true;
    });
  }

  // 按 order 排序
  tasks = tasks
    .map((t, i) => ({ ...t, order: i }))
    .sort((a, b) => a.order - b.order);

  const estimatedMinutes = tasks.reduce((n, t) => n + t.estimatedMinutes, 0);
  const adjusted = rescheduledTasks.length > 0;

  return {
    date,
    phase,
    estimatedMinutes: Math.min(estimatedMinutes, Math.max(DAILY_LOAD_CAP, targetMin)),
    tasks,
    status: adjusted ? "adjusted" : "empty",
    generatedAt: new Date(`${date}T00:00:00Z`).toISOString(),
    adjusted,
    adjustmentReason: adjusted ? "missed_task" : undefined,
    planVersion: 1,
  };
}

/** 判断某天是否已完成（根据专项 Adapter 快照） */
export function planStatus(
  plan: DailyPlan,
  completion: Record<PlanModule, { completed: boolean }>,
): "completed" | "in_progress" | "empty" {
  const active = plan.tasks.filter((t) => !t.removed);
  if (active.length === 0) return "empty";
  const done = active.filter((t) => completion[t.module]?.completed).length;
  if (done === active.length) return "completed";
  if (done > 0) return "in_progress";
  return "empty";
}

/** 未来 N 天预览（不持久化，不用于完成判断） */
export function previewFuturePlans(
  today: string,
  days: number,
  examDate: string,
  pref: StudyPreferences,
): { date: string; plan: DailyPlan }[] {
  const out: { date: string; plan: DailyPlan }[] = [];
  for (let i = 1; i <= days; i++) {
    const d = addDays(today, i);
    out.push({ date: d, plan: generatePlan(d, examDate, pref) });
  }
  return out;
}
