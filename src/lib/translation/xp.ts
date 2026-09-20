import { todayInShanghai } from "@/lib/dates";
import type { TranslationSession } from "@/types/translation";

export const TRANSLATION_BASE_XP = 12;

/**
 * 翻译 XP：首次完成一篇 = 基础分 + 表现分；跨日重复 = 仅表现分；
 * 同一天重复同一篇 = 0（防刷分）。
 */
export function translationXp(
  session: TranslationSession,
  ledger: Record<string, number>,
  now: string,
): { xp: number; ledger: Record<string, number> } {
  const next = { ...ledger };
  const day = todayInShanghai(new Date(now));
  const firstKey = `translation:first:${session.taskId}`;
  const dayKey = `translation:day:${day}:${session.taskId}`;
  if (next[dayKey] !== undefined) return { xp: 0, ledger: next };
  const score = session.feedback?.score ?? 0;
  const maxScore = session.feedback?.maxScore ?? 15;
  // 表现分 0–3：按得分占比换算
  const performance = Math.round((score / maxScore) * 3);
  const isFirst = next[firstKey] === undefined;
  const xp = isFirst ? TRANSLATION_BASE_XP + performance : performance;
  if (isFirst) next[firstKey] = TRANSLATION_BASE_XP;
  next[dayKey] = xp;
  return { xp, ledger: next };
}
