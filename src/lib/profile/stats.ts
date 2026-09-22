/**
 * V11 StudyStats 纯函数：输入各 store 的原始数据，输出统计。
 * 不碰 LocalStorage、不碰 React，便于 V12 换后端时复用。
 */
import { addDays, dayDifference, todayInShanghai } from "@/lib/dates";

export interface ObjectiveRecord {
  initialResult?: "correct" | "wrong";
  retest?: { correct?: boolean }[];
  initial?: { correct?: boolean }[];
}

export interface StudyStats {
  studyDays: number;
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
    completedTasks: number;
  };
  last7: { date: string; studied: boolean }[];
}

/** 统计一份 records 里的客观题作答。按 attempt 计：initial 1 次 + 每次 retest 各 1 次。 */
export function summarizeObjective(records: Record<string, ObjectiveRecord>): { correct: number; attempts: number } {
  let correct = 0;
  let attempts = 0;
  for (const r of Object.values(records)) {
    if (r.initialResult === "correct") {
      attempts++;
      correct++;
    } else if (r.initialResult === "wrong") {
      attempts++;
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

/** 周一为一周起点。 */
export function weekStart(today: string): string {
  const d = new Date(today + "T00:00:00+08:00");
  const dow = d.getDay() === 0 ? 7 : d.getDay(); // 周日=7
  return addDays(today, -(dow - 1));
}

export function last7Days(today: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
}

interface Inputs {
  /** V2 daily 完成的日期集合（profile.completedLessons keys） */
  completedDays: Set<string>;
  totalXp: number;
  streak: number;
  level: number;
  levelTitle: string;
  /** 各专项 records 合并 */
  objective: { correct: number; attempts: number };
  wrongCount: number;
  wordbookCount: number;
  dueReviewCount: number;
  /** 当日 XP ledger（date -> xp），用于本周 XP */
  xpByDay: Record<string, number>;
  today: string;
}

export function computeStudyStats(i: Inputs): StudyStats {
  const studyDays = i.completedDays.size;
  const week = weekStart(i.today);
  const weeklyDays = [...i.completedDays].filter((d) => dayDifference(week, d) >= 0 && dayDifference(d, i.today) >= 0 && dayDifference(week, d) <= 6);
  const weeklyXp = Object.entries(i.xpByDay)
    .filter(([d]) => dayDifference(week, d) >= 0 && dayDifference(d, i.today) >= 0 && dayDifference(week, d) <= 6)
    .reduce((n, [, xp]) => n + xp, 0);
  const last7 = last7Days(i.today).map((date) => ({ date, studied: i.completedDays.has(date) }));

  return {
    studyDays,
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
      completedTasks: weeklyDays.length,
    },
    last7,
  };
}

/** 格式化时长：<60min 显示分钟，否则 X小时XX分。V11 无可靠 session duration，总时长字段由调用方决定。 */
export function formatDuration(totalMinutes: number): string {
  if (totalMinutes < 60) return `${Math.round(totalMinutes)} 分钟`;
  const h = Math.floor(totalMinutes / 60);
  const m = Math.round(totalMinutes % 60);
  return `${h}小时${m > 0 ? `${m}分` : ""}`;
}
