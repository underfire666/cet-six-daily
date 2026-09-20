import { todayInShanghai } from "@/lib/dates";
import type { ListeningSession } from "@/types/listening";

export const LISTENING_BASE_XP = 15;

/**
 * 听力 XP：首次完成一组 = 基础分 + 答题表现分；其他天重复 = 仅表现分；
 * 同一天重复同一组 = 0（防刷分）。账本 key 与阅读 XP 体系保持一致风格。
 */
export function listeningXp(
  session: ListeningSession,
  ledger: Record<string, number>,
  now: string,
): { xp: number; ledger: Record<string, number> } {
  const next = { ...ledger };
  const day = todayInShanghai(new Date(now));
  const firstKey = `listening:first:${session.materialId}`;
  const dayKey = `listening:day:${day}:${session.materialId}`;
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
  const xp = isFirst ? LISTENING_BASE_XP + performance : performance;
  if (isFirst) next[firstKey] = LISTENING_BASE_XP;
  next[dayKey] = xp;
  return { xp, ledger: next };
}
