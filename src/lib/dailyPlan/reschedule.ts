import { addDays } from "@/lib/dates";
import type {
  DailyPlan,
  DailyTask,
  StudyPreferences,
} from "@/types/dailyPlan";
import { DAILY_LOAD_CAP, RESCHEDULE_WINDOW, makeTask } from "./config";
import { generatePlan } from "./generator";

interface RescheduleInput {
  plans: Record<string, DailyPlan>;
  today: string;
  examDate: string;
  pref: StudyPreferences;
  /** 各专项今日完成快照（用于判断 plan 是否真的完成） */
  isPlanCompleted: (date: string, plan: DailyPlan) => boolean;
}

/**
 * 扫描历史 plan，把未完成的任务顺延到未来 1..RESCHEDULE_WINDOW 天。
 * 纯函数：返回新的 plans map（不修改输入）。
 */
export function rescheduleMissedTasks({
  plans,
  today,
  examDate,
  pref,
  isPlanCompleted,
}: RescheduleInput): Record<string, DailyPlan> {
  const next: Record<string, DailyPlan> = { ...plans };

  // 找今天之前未完成的 plan，收集需要顺延的任务
  const missed: { fromDate: string; tasks: DailyTask[] }[] = [];
  for (const [date, plan] of Object.entries(plans)) {
    if (date >= today) continue;
    if (isPlanCompleted(date, plan)) continue;
    // 已调整过的不再重复顺延
    if (plan.adjusted) continue;
    const active = plan.tasks.filter((t) => !t.removed);
    // 简化：未完成的整个 plan 的 active 任务都顺延（除 vocabulary 这种每天必学的，直接放弃）
    const carry = active.filter((t) => t.module !== "vocabulary");
    if (carry.length === 0) continue;
    missed.push({ fromDate: date, tasks: carry });
    // 标记原 plan 为 adjusted
    next[date] = {
      ...plan,
      status: "adjusted",
      adjusted: true,
      adjustmentReason: "missed_task",
    };
  }

  if (missed.length === 0) return next;

  // 把任务按优先级分发到未来几天
  // 简单规则：每天最多加 1 个 rescheduled 任务，受 DAILY_LOAD_CAP 限制
  const queue = missed
    .flatMap((m) => m.tasks.map((t) => ({ ...t, fromDate: m.fromDate })))
    .sort((a, b) => {
      const rank = { high: 0, normal: 1, low: 2 };
      return rank[a.priority] - rank[b.priority];
    });

  for (const task of queue) {
    // 找最近一天（含今天），加进去不超 cap
    let placed = false;
    for (let offset = 0; offset <= RESCHEDULE_WINDOW && !placed; offset++) {
      const target = addDays(today, offset);
      if (target > examDate) continue;
      // 已 customized 的日期不改
      // （customizedDates 由调用方在生成时处理）
      const existing = next[target];
      const existingMinutes = existing
        ? existing.tasks.reduce((n, t) => n + t.estimatedMinutes, 0)
        : 0;
      if (existingMinutes + task.estimatedMinutes > DAILY_LOAD_CAP) continue;

      const newTask = makeTask(task.module, existing?.tasks.length ?? 0, {
        source: "rescheduled",
        rescheduledFrom: task.fromDate,
        priority: task.priority,
        target: task.target,
        estimatedMinutes: task.estimatedMinutes,
      });

      if (existing) {
        next[target] = {
          ...existing,
          tasks: [...existing.tasks, newTask],
          adjusted: true,
          adjustmentReason: "missed_task",
          status: existing.status === "completed" ? "completed" : existing.status,
        };
      } else {
        next[target] = generatePlan(target, examDate, pref, [
          { fromDate: task.fromDate, task: newTask },
        ]);
      }
      placed = true;
    }
    // 放不下就放弃（低优先级任务被 drop，符合 §十九）
  }

  return next;
}

/** 月历状态：根据 plan 是否完成、是否调整 */
export type CalendarDayStatus =
  | "completed"
  | "today"
  | "in_progress"
  | "adjusted"
  | "locked"
  | "available"
  | "missed";

export function calendarStatus(
  date: string,
  today: string,
  plan: DailyPlan | undefined,
): CalendarDayStatus {
  if (date > today) return "locked";
  if (date === today) {
    if (!plan) return "today";
    if (plan.status === "completed") return "completed";
    if (plan.adjusted) return "adjusted";
    return "today";
  }
  // 过去
  if (!plan) return "missed";
  if (plan.status === "completed") return "completed";
  if (plan.adjusted) return "adjusted";
  return "missed";
}
