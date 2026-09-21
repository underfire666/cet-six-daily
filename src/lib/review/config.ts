import type { ReviewMastery, ReviewResult } from "@/types/review";
import { addDays, todayInShanghai, validDate } from "@/lib/dates";

/** 接受日历日期或带时区的时间戳，统一按上海日期排期。 */
export function reviewDate(value: string): string {
  if (validDate(value)) return value;
  if (!/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value) || !validDate(value.slice(0, 10)) || !Number.isFinite(Date.parse(value))) {
    throw new RangeError("Invalid review date");
  }
  return todayInShanghai(new Date(value));
}

// 复习间隔（天），全部配置化
export const INTERVALS = {
  unmastered: 1, // 未掌握：明天再来
  wrong: 1, // 二次仍错：第二天
  second_try_correct: 3, // 二次答对：2~3 天后
  review_correct: 3, // 复习答对一次：3 天
  correct_2: 7,
  correct_3: 14,
  correct_4: 30,
} as const;

export const DAILY_REVIEW_CAP: Record<"light" | "standard" | "intense", number> = {
  light: 5,
  standard: 8,
  intense: 12,
};

/** 复习占每日负荷的比例上限 */
export const REVIEW_LOAD_RATIO = 0.35;

/** 连续答对几次算 mastered */
export const MASTERED_STREAK = 3;

/** 各状态优先级（数字越小越优先） */
export const PRIORITY_RANK: Record<ReviewMastery, number> = {
  weak: 0,
  reviewing: 1,
  new: 2,
  mastered: 3,
};

export function calculateNextReviewDate(
  current: ReviewMastery,
  result: ReviewResult,
  correctStreak: number,
  today: string,
): string {
  // 答错：回到短间隔
  if (result === "wrong" || result === "unmastered") {
    return addDaysSafe(today, INTERVALS.unmastered);
  }
  // 复习答对：按连续正确次数拉长
  if (result === "review_correct") {
    if (correctStreak >= 4) return addDaysSafe(today, INTERVALS.correct_4);
    if (correctStreak >= 3) return addDaysSafe(today, INTERVALS.correct_3);
    if (correctStreak >= 2) return addDaysSafe(today, INTERVALS.correct_2);
    return addDaysSafe(today, INTERVALS.review_correct);
  }
  // 当天二次答对
  if (result === "second_try_correct") {
    return addDaysSafe(today, INTERVALS.second_try_correct);
  }
  return addDaysSafe(today, INTERVALS.wrong);
}

export function calculateNextMastery(
  current: ReviewMastery,
  result: ReviewResult,
  correctStreak: number,
): { status: ReviewMastery; priority: number } {
  if (result === "wrong" || result === "unmastered") {
    return { status: "weak", priority: PRIORITY_RANK.weak };
  }
  if (result === "second_try_correct") return { status: "reviewing", priority: PRIORITY_RANK.reviewing };
  if (result === "review_correct") {
    const next: ReviewMastery =
      correctStreak >= MASTERED_STREAK ? "mastered" : "reviewing";
    return { status: next, priority: PRIORITY_RANK[next] };
  }
  return { status: current, priority: PRIORITY_RANK[current] };
}

function addDaysSafe(date: string, n: number): string {
  return addDays(reviewDate(date), n);
}
