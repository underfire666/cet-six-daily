import { mockReadingArticles } from "@/data/mockReading";
import { todayInShanghai } from "@/lib/dates";
import type {
  ReadingDailyProgress,
  ReadingSessionMode,
  ReadingStore,
} from "@/types/reading";
import { createReadingSession, reduceReadingSession } from "./session";
import { readingXp } from "./xp";
import type { ReadingAction } from "./session";

export const DAILY_ARTICLE_COUNT = 3;

/** 按日期确定性生成每日阅读任务（同一天刷新结果不变）。 */
export function pickDailyArticles(
  date: string,
  count = DAILY_ARTICLE_COUNT,
): string[] {
  const total = mockReadingArticles.length;
  if (!total) return [];
  const dayNumber = Math.floor(Date.parse(`${date}T00:00:00Z`) / 86_400_000);
  const seed = ((dayNumber % total) + total) % total;
  const ids: string[] = [];
  for (let i = 0; i < count; i++)
    ids.push(mockReadingArticles[(seed + i) % total].id);
  return ids;
}

export function planFor(
  store: ReadingStore,
  date: string,
): ReadingDailyProgress {
  const saved = store.daily[date];
  return {
    date,
    articleIds: saved?.articleIds ?? pickDailyArticles(date),
    completedArticleIds: saved?.completedArticleIds ?? [],
    activeSessionId: saved?.activeSessionId,
  };
}

/** 额外阅读候选：优先未计划、且今天未完成过的文章；不足时允许重复（按重复 XP 处理）。 */
function pickExtraArticle(
  store: ReadingStore,
  date: string,
  plannedIds: string[],
): string | undefined {
  const planned = new Set(plannedIds);
  const completedToday = new Set(
    Object.values(store.sessions)
      .filter(
        (s) =>
          s.applied &&
          s.completedAt &&
          todayInShanghai(new Date(s.completedAt)) === date,
      )
      .map((s) => s.articleId),
  );
  const fresh = mockReadingArticles
    .map((a) => a.id)
    .find((id) => !planned.has(id) && !completedToday.has(id));
  if (fresh) return fresh;
  return mockReadingArticles.map((a) => a.id).find((id) => !planned.has(id));
}

export function startReading(
  store: ReadingStore,
  mode: ReadingSessionMode,
  date: string,
  now: string,
  id: string,
): { store: ReadingStore; id?: string } {
  const active = Object.values(store.sessions).find(
    (s) =>
      s.phase !== "complete" &&
      (mode === "daily"
        ? s.mode === "daily" && s.planDate === date
        : s.mode === "extra"),
  );
  if (active) return { store, id: active.id };
  const progress = planFor(store, date);
  let articleId: string | undefined;
  if (mode === "daily") {
    articleId = progress.articleIds.find(
      (aid) => !progress.completedArticleIds.includes(aid),
    );
  } else {
    if (progress.completedArticleIds.length < progress.articleIds.length)
      return { store, id: undefined };
    articleId = pickExtraArticle(store, date, progress.articleIds);
  }
  if (!articleId) return { store, id: undefined };
  const article = mockReadingArticles.find((a) => a.id === articleId);
  if (!article) return { store, id: undefined };
  const session = createReadingSession(id, mode, date, article, now);
  return {
    store: {
      ...store,
      sessions: { ...store.sessions, [id]: session },
      daily:
        mode === "daily"
          ? {
              ...store.daily,
              [date]: {
                ...progress,
                articleIds: progress.articleIds,
                completedArticleIds: progress.completedArticleIds,
                activeSessionId: id,
              },
            }
          : store.daily,
    },
    id,
  };
}

export function updateReading(
  store: ReadingStore,
  id: string,
  action: ReadingAction,
  now: string,
): ReadingStore {
  const previous = store.sessions[id];
  if (!previous || previous.applied) return store;
  const session = reduceReadingSession(previous, action);
  if (session === previous) return store;
  let daily = store.daily;
  let xpLedger = store.xpLedger;
  if (session.phase === "complete") {
    const reward = readingXp(session, xpLedger, now);
    xpLedger = reward.ledger;
    const completed = {
      ...session,
      rewardXp: reward.xp,
      applied: true,
      completedAt: now,
    };
    if (completed.mode === "daily") {
      const progress = planFor(store, completed.planDate);
      if (progress.articleIds.includes(completed.articleId)) {
        daily = {
          ...daily,
          [completed.planDate]: {
            ...progress,
            completedArticleIds: [
              ...new Set([
                ...progress.completedArticleIds,
                completed.articleId,
              ]),
            ],
          },
        };
      }
    }
    return {
      ...store,
      daily,
      xpLedger,
      sessions: { ...store.sessions, [id]: completed },
    };
  }
  return { ...store, sessions: { ...store.sessions, [id]: session } };
}

export function readingDayStats(store: ReadingStore, date: string) {
  const completed = Object.values(store.sessions).filter(
    (s) =>
      s.applied &&
      s.completedAt &&
      todayInShanghai(new Date(s.completedAt)) === date,
  );
  return {
    extra: completed.filter((s) => s.mode === "extra").length,
    xp: Object.entries(store.xpLedger)
      .filter(([key]) => key.startsWith(`reading:day:${date}:`))
      .reduce((n, [, xp]) => n + xp, 0),
  };
}
