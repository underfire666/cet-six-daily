/**
 * V11 StudyStats 纯函数：输入各 store 的原始数据，输出统计。
 * 不碰 LocalStorage、不碰 React，便于 V12 换后端时复用。
 */
import { addDays, dayDifference } from "@/lib/dates";

export interface ObjectiveRecord {
  initialResult?: "correct" | "wrong" | "first_try_correct" | "second_try_correct" | "ai_hint_correct" | "unmastered";
  retest?: { correct?: boolean }[];
  initial?: { correct?: boolean }[];
}

export interface StudyStats {
  studyDays: number;
  totalDurationSeconds: number;
  totalXp: number;
  streak: number;
  level: number;
  levelTitle: string;
  objectiveCorrect: number;
  objectiveAttempts: number;
  /** 无答题时为 null，显示"暂无"而不是 0% */
  overallAccuracy: number | null;
  wrongCount: number;
  wordbookCount: number;
  dueReviewCount: number;
  weekly: {
    studyDays: number;
    xp: number;
    durationSeconds: number;
  };
  last7: { date: string; studied: boolean }[];
}

/**
 * 统计一份 records 里的客观题作答。按 attempt 计：initial 数组每次 + retest 数组每次。
 * initialResult 仅作为历史数据的兜底（数组缺失时计 1 次），不重复计数——
 * 首轮双错（initialResult="wrong"）时 initial 数组已有 2 条，不再额外 +1。
 */
export function summarizeObjective(records: Record<string, ObjectiveRecord>): { correct: number; attempts: number } {
  let correct = 0;
  let attempts = 0;
  for (const r of Object.values(records)) {
    const initialAttempts = r.initial?.length ?? 0;
    const retestAttempts = r.retest?.length ?? 0;
    if (initialAttempts === 0 && retestAttempts === 0) {
      // 历史数据只有 initialResult 而无 attempt 数组：按结果计 1 次，不伪造多条。
      if (r.initialResult === "correct" || r.initialResult === "first_try_correct" || r.initialResult === "second_try_correct" || r.initialResult === "ai_hint_correct") {
        attempts++;
        correct++;
      } else if (r.initialResult === "wrong") {
        attempts++;
      }
      continue;
    }
    for (const a of r.initial ?? []) {
      attempts++;
      if (a.correct) correct++;
    }
    for (const a of r.retest ?? []) {
      attempts++;
      if (a.correct) correct++;
    }
  }
  return { correct, attempts };
}

/**
 * 统计 Review 会话作答（V9 ReviewSession.answers：每项为一次明确 correct/incorrect 的作答）。
 */
export function summarizeReviewAnswers(
  answers: Record<string, { correct?: boolean; result?: string }>,
): { correct: number; attempts: number } {
  let correct = 0;
  let attempts = 0;
  for (const a of Object.values(answers)) {
    if (typeof a?.correct !== "boolean") continue;
    attempts++;
    if (a.correct) correct++;
  }
  return { correct, attempts };
}

/**
 * 聚合真实 Session Duration（秒）：completedAt - startedAt。
 * 只接受合法 ISO 时间戳；缺失 / NaN / 负数 / Infinity / 超过 24 小时（异常极大值）一律忽略。
 */
export function summarizeDurations(
  sessions: { startedAt?: string; completedAt?: string }[],
): number {
  const DAY_MS = 86_400_000;
  let total = 0;
  for (const s of sessions) {
    if (!s?.startedAt || !s?.completedAt) continue;
    const start = Date.parse(s.startedAt);
    const end = Date.parse(s.completedAt);
    if (!Number.isFinite(start) || !Number.isFinite(end)) continue;
    const ms = end - start;
    if (ms <= 0 || ms > DAY_MS) continue;
    total += ms;
  }
  return Math.round(total / 1000);
}

/** 周一为一周起点。 */
export function weekStart(today: string): string {
  const d = new Date(today + "T00:00:00Z");
  const dow = d.getUTCDay() === 0 ? 7 : d.getUTCDay(); // 日历日期不受设备时区影响
  return addDays(today, -(dow - 1));
}

export function last7Days(today: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
}

/** 已完成 session：startedAt/completedAt 用于时长，day 为完成日（YYYY-MM-DD）用于本周归属。 */
export interface CompletedSession {
  startedAt?: string;
  completedAt?: string;
  day?: string;
  rewardXp?: number;
}

interface Inputs {
  /** 历史每日关卡完成日；专项完成日从 completedSessions 合并。 */
  completedDays: Set<string>;
  totalXp: number;
  streak: number;
  level: number;
  levelTitle: string;
  /** 各专项 records + review answers 合并 */
  objective: { correct: number; attempts: number };
  wrongCount: number;
  wordbookCount: number;
  dueReviewCount: number;
  /** 当日 XP ledger（date -> xp），用于本周 XP */
  xpByDay: Record<string, number>;
  /** 已完成 session（含 startedAt/completedAt/day），用于真实时长聚合 */
  completedSessions: CompletedSession[];
  today: string;
}

export function computeStudyStats(i: Inputs): StudyStats {
  const completedDays = new Set([...i.completedDays, ...i.completedSessions.flatMap(s => s.day ? [s.day] : [])]);
  const studyDays = completedDays.size;
  const week = weekStart(i.today);
  const inWeek = (d: string) => {
    const fromWeek = dayDifference(week, d);
    return fromWeek >= 0 && dayDifference(d, i.today) >= 0 && fromWeek <= 6;
  };
  const weeklyDays = [...completedDays].filter(inWeek);
  const weeklyXp = Object.entries(i.xpByDay)
    .filter(([d]) => inWeek(d))
    .reduce((n, [, xp]) => n + xp, 0) + i.completedSessions.reduce((n, s) => n + (s.day && inWeek(s.day) ? s.rewardXp ?? 0 : 0), 0);
  const weeklyDuration = summarizeDurations(
    i.completedSessions.filter((s) => s.day && inWeek(s.day)),
  );
  const last7 = last7Days(i.today).map((date) => ({ date, studied: completedDays.has(date) }));

  return {
    studyDays,
    totalDurationSeconds: summarizeDurations(i.completedSessions),
    totalXp: i.totalXp,
    streak: i.streak,
    level: i.level,
    levelTitle: i.levelTitle,
    objectiveCorrect: i.objective.correct,
    objectiveAttempts: i.objective.attempts,
    overallAccuracy: i.objective.attempts === 0 ? null : Math.round((i.objective.correct / i.objective.attempts) * 100),
    wrongCount: i.wrongCount,
    wordbookCount: i.wordbookCount,
    dueReviewCount: i.dueReviewCount,
    weekly: {
      studyDays: weeklyDays.length,
      xp: weeklyXp,
      durationSeconds: weeklyDuration,
    },
    last7,
  };
}

/** 格式化时长：<60min 显示分钟，否则 X小时XX分。 */
export function formatDuration(totalSeconds: number): string {
  const totalMinutes = Math.round(totalSeconds / 60);
  if (totalMinutes < 60) return `${totalMinutes} 分钟`;
  const h = Math.floor(totalMinutes / 60);
  const m = Math.round(totalMinutes % 60);
  return `${h}小时${m > 0 ? `${m}分` : ""}`;
}
