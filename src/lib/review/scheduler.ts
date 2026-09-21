import type {
  ReviewItem,
  ReviewMastery,
  ReviewResult,
  ReviewSession,
  ReviewSourceModule,
} from "@/types/review";
import {
  DAILY_REVIEW_CAP,
  MASTERED_STREAK,
  PRIORITY_RANK,
  calculateNextMastery,
  calculateNextReviewDate,
} from "./config";
import { dayDifference } from "@/lib/dates";

/** 同一 questionId+sourceActivityId 唯一 */
export function reviewItemId(
  sourceModule: ReviewSourceModule,
  sourceActivityId: string,
  questionId: string,
): string {
  return `${sourceModule}:${sourceActivityId}:${questionId}`;
}

/** 记录一次错误（幂等：同一题不重复收录） */
export function recordWrong(
  items: Record<string, ReviewItem>,
  sourceModule: ReviewSourceModule,
  sourceActivityId: string,
  questionId: string,
  now: string,
  result: "wrong" | "unmastered" | "second_try_correct",
): Record<string, ReviewItem> {
  const id = reviewItemId(sourceModule, sourceActivityId, questionId);
  const existing = items[id];
  const { status, priority } = calculateNextMastery(
    existing?.masteryStatus ?? "new",
    result,
    existing?.correctStreak ?? 0,
  );
  const nextReviewAt = calculateNextReviewDate(
    existing?.masteryStatus ?? "new",
    result,
    existing?.correctStreak ?? 0,
    now,
  );
  const history = [
    ...(existing?.history ?? []),
    {
      reviewedAt: now,
      result,
      previousStatus: existing?.masteryStatus ?? "new",
      newStatus: status,
      nextReviewAt,
      source: "specialty" as const,
    },
  ];
  const item: ReviewItem = {
    id,
    contentType: "question",
    sourceModule,
    sourceActivityId,
    questionId,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    lastReviewedAt: now,
    nextReviewAt,
    masteryStatus: status,
    reviewCount: (existing?.reviewCount ?? 0) + 1,
    correctStreak:
      result === "second_try_correct" ? (existing?.correctStreak ?? 0) + 1 : 0,
    wrongCount:
      result === "second_try_correct"
        ? existing?.wrongCount ?? 0
        : (existing?.wrongCount ?? 0) + 1,
    priority,
    favorite: existing?.favorite ?? false,
    removed: false, // 再次答错重新激活
    history,
    schemaVersion: 1,
  };
  return { ...items, [id]: item };
}

/** 复习一次后的更新 */
export function applyReviewResult(
  items: Record<string, ReviewItem>,
  itemId: string,
  correct: boolean,
  now: string,
  source: ReviewSession["source"],
): Record<string, ReviewItem> {
  const existing = items[itemId];
  if (!existing) return items;
  const result: ReviewResult = correct ? "review_correct" : "wrong";
  const correctStreak = correct
    ? existing.correctStreak + 1
    : 0;
  const { status, priority } = calculateNextMastery(
    existing.masteryStatus,
    result,
    correctStreak,
  );
  const nextReviewAt = calculateNextReviewDate(
    existing.masteryStatus,
    result,
    correctStreak,
    now,
  );
  const history = [
    ...existing.history,
    {
      reviewedAt: now,
      result,
      previousStatus: existing.masteryStatus,
      newStatus: status,
      nextReviewAt,
      source,
    },
  ];
  const updated: ReviewItem = {
    ...existing,
    updatedAt: now,
    lastReviewedAt: now,
    nextReviewAt,
    masteryStatus: status,
    reviewCount: existing.reviewCount + 1,
    correctStreak,
    wrongCount: correct ? existing.wrongCount : existing.wrongCount + 1,
    priority,
    history,
  };
  return { ...items, [itemId]: updated };
}

/** 今天到期的 items（未 removed，nextReviewAt <= today） */
export function getDueReviews(
  items: Record<string, ReviewItem>,
  today: string,
): ReviewItem[] {
  return Object.values(items)
    .filter((i) => !i.removed && i.nextReviewAt <= today && i.masteryStatus !== "mastered")
    .sort(compareByPriority);
}

function compareByPriority(a: ReviewItem, b: ReviewItem): number {
  // unmastered(weak) 优先；逾期越久越优先
  const pa = PRIORITY_RANK[a.masteryStatus];
  const pb = PRIORITY_RANK[b.masteryStatus];
  if (pa !== pb) return pa - pb;
  const overdueA = dayDifference(a.nextReviewAt, today);
  const overdueB = dayDifference(b.nextReviewAt, today);
  if (overdueA !== overdueB) return overdueB - overdueA;
  return a.createdAt.localeCompare(b.createdAt);
}

let today = ""; // 闭包用
function _setToday(d: string) { today = d; }

/** 从到期 items 里按 cap 选今天复习的一批 */
export function selectDailyReviews(
  items: Record<string, ReviewItem>,
  today: string,
  intensity: "light" | "standard" | "intense",
): ReviewItem[] {
  _setToday(today);
  const due = getDueReviews(items, today);
  const cap = DAILY_REVIEW_CAP[intensity];
  return due.slice(0, cap);
}

/** 手动复习：用户自选一组（未掌握/收藏），不限 cap */
export function selectManualReviews(
  items: Record<string, ReviewItem>,
  filter: "unmastered" | "favorite" | "due",
  today: string,
): ReviewItem[] {
  const list = Object.values(items).filter((i) => !i.removed);
  if (filter === "unmastered")
    return list.filter((i) => i.masteryStatus === "weak");
  if (filter === "favorite") return list.filter((i) => i.favorite);
  return getDueReviews(items, today);
}

/** 创建复习 session（持久化 itemIds，刷新可恢复） */
export function createReviewSession(
  items: ReviewItem[],
  date: string,
  mode: ReviewSession["mode"],
  source: ReviewSession["source"],
): ReviewSession {
  return {
    id: `rs-${Date.now().toString(36)}`,
    date,
    mode,
    itemIds: items.map((i) => i.id),
    currentIndex: 0,
    answers: {},
    startedAt: new Date().toISOString(),
    source,
    applied: false,
    rewardXp: items.length > 0 ? Math.min(items.length * 2, 20) : 0,
  };
}

/** 完成 session：把 answers 应用到 items，返回新 items + 是否首次发 XP */
export function finishReviewSession(
  items: Record<string, ReviewItem>,
  session: ReviewSession,
  now: string,
): { items: Record<string, ReviewItem>; xpByItem: Record<string, number> } {
  let next = items;
  const xpByItem: Record<string, number> = {};
  for (const [itemId, answer] of Object.entries(session.answers)) {
    next = applyReviewResult(next, itemId, answer.correct, now, session.source);
    xpByItem[itemId] = answer.correct ? 2 : 0;
  }
  return { items: next, xpByItem };
}
