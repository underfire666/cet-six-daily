import { addDays, dayDifference } from "@/lib/dates";
import type {
  DailyPlan,
  DailyTask,
  PlanModule,
  StudyPreferences,
} from "@/types/dailyPlan";
import {
  DAILY_LOAD_CAP,
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
): PlanModule[] {
  const weights = moduleWeights(pref);
  // 词汇每天必学
  const pool: PlanModule[] = ["reading", "listening", "translation", "writing"];
  const seed = seedFromDate(date);

  // 时长档位决定任务量，专项重点决定优先选择哪些模块。
  const targetExtra = pref.intensity === "light" ? 1 : pref.intensity === "standard" ? 2 : 3;
  const chosen = new Set<PlanModule>();
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
  const modules = pickModules(date, pref);

  let tasks: DailyTask[] = modules.map((m, i) => makeTask(m, i, { id: `${date}:${m}` }));
  if (pref.intensity === "light") {
    tasks[0] = { ...tasks[0], target: "10 个", estimatedMinutes: 4 };
  }

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
    estimatedMinutes,
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
  completion: PlanCompletion,
): "completed" | "in_progress" | "empty" {
  const active = plan.tasks.filter((t) => !t.removed);
  if (active.length === 0) return "empty";
  const done = active.filter((t) => taskCompleted(plan, t, completion)).length;
  if (done === active.length) return "completed";
  if (done > 0) return "in_progress";
  return "empty";
}

export type PlanCompletion = Record<PlanModule, { completed: boolean; done?: number }>;

/** 同模块多项任务按顺序分配完成数量，不能用一次学习抵扣两项。 */
export function taskCompleted(plan: DailyPlan, task: DailyTask, completion: PlanCompletion): boolean {
  if (task.removed) return false;
  const progress = completion[task.module];
  if (progress.done === undefined) return progress.completed;
  let required = 0;
  for (const item of plan.tasks) {
    if (!item.removed && item.module === task.module) required += Number.parseInt(item.target, 10) || 1;
    if (item.id === task.id) break;
  }
  return progress.done >= required;
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
