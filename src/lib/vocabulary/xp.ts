import { todayInShanghai } from "@/lib/dates";
import type { VocabularySession } from "@/types/vocabulary";
export function vocabularyXp(
  session: VocabularySession,
  ledger: Record<string, number>,
  now: string,
) {
  const next = { ...ledger };
  let xp = 0;
  const day = todayInShanghai(new Date(now));
  for (const wordId of session.wordIds) {
    const first = `first:${wordId}`,
      daily = `day:${day}:${wordId}`;
    if (next[daily] !== undefined) continue;
    const points = next[first] === undefined ? 2 : 1;
    next[first] ??= 2;
    next[daily] = points;
    xp += points;
  }
  return { xp, ledger: next };
}
