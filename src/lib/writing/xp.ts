import { todayInShanghai } from "@/lib/dates";
import type { WritingSession } from "@/types/writing";

export const WRITING_BASE_XP = 12;

/** 写作 XP 规则同翻译：首次 = 基础 + 表现分；跨日重复 = 表现分；同日重复 = 0。 */
export function writingXp(
  session: WritingSession,
  ledger: Record<string, number>,
  now: string,
): { xp: number; ledger: Record<string, number> } {
  const next = { ...ledger };
  const day = todayInShanghai(new Date(now));
  const firstKey = `writing:first:${session.taskId}`;
  const dayKey = `writing:day:${day}:${session.taskId}`;
  if (next[dayKey] !== undefined) return { xp: 0, ledger: next };
  const score = session.feedback?.score ?? 0;
  const maxScore = session.feedback?.maxScore ?? 15;
  const performance = Math.round((score / maxScore) * 3);
  const isFirst = next[firstKey] === undefined;
  const xp = isFirst ? WRITING_BASE_XP + performance : performance;
  if (isFirst) next[firstKey] = WRITING_BASE_XP;
  next[dayKey] = xp;
  return { xp, ledger: next };
}
