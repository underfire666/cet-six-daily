import { todayInShanghai } from "@/lib/dates";
import type { ReadingSession } from "@/types/reading";

export const READING_BASE_XP = 15;

/**
 * 阅读 XP：首次完成一篇文章 = 基础分 + 答题表现分；重复完成（其他天）= 仅表现分；
 * 同一天重复完成同一篇 = 0（防止刷分）。账本 key 与词汇 XP 体系保持一致风格。
 */
export function readingXp(
  session: ReadingSession,
  ledger: Record<string, number>,
  now: string,
): { xp: number; ledger: Record<string, number> } {
  const next = { ...ledger };
  const day = todayInShanghai(new Date(now));
  const firstKey = `reading:first:${session.articleId}`;
  const dayKey = `reading:day:${day}:${session.articleId}`;
  if (next[dayKey] !== undefined) return { xp: 0, ledger: next };
  const performance = Object.values(session.lesson.records).reduce(
    (sum, record) => {
      if (record.initialResult === "first_try_correct") return sum + 2;
      if (
        record.initialResult === "second_try_correct" ||
        record.initialResult === "ai_hint_correct"
      )
        return sum + 1;
      return sum;
    },
    0,
  );
  const isFirst = next[firstKey] === undefined;
  const xp = isFirst ? READING_BASE_XP + performance : performance;
  if (isFirst) next[firstKey] = READING_BASE_XP;
  next[dayKey] = xp;
  return { xp, ledger: next };
}
