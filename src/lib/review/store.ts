import type {
  ReviewItem,
  ReviewSession,
  ReviewStore,
} from "@/types/review";
import { validDate } from "@/lib/dates";
import { reviewDate } from "./config";
import { finishReviewSession } from "./scheduler";

export const REVIEW_KEY = "cet-daily:v1:review";

export const emptyReviewStore = (): ReviewStore => ({
  schemaVersion: 1,
  items: {},
  sessions: {},
  xpLedger: {},
});

const obj = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const str = (v: unknown): v is string => typeof v === "string";
const num = (v: unknown): v is number =>
  typeof v === "number" && Number.isSafeInteger(v) && v >= 0;
const bool = (v: unknown): v is boolean => typeof v === "boolean";
const date = (v: unknown): v is string => str(v) && validDate(v);
const time = (v: unknown): v is string => {
  if (!str(v)) return false;
  try { reviewDate(v); return true; } catch { return false; }
};
const statuses = ["new", "weak", "reviewing", "mastered"];
const sources = ["daily_plan", "manual", "end_of_day", "specialty", "word"];
const results = ["first_try_correct", "second_try_correct", "wrong", "unmastered", "review_correct"];
function validHistory(v: unknown): boolean {
  return obj(v) && time(v.reviewedAt) && results.includes(String(v.result)) && statuses.includes(String(v.previousStatus)) && statuses.includes(String(v.newStatus)) && date(v.nextReviewAt) && sources.includes(String(v.source));
}

function validItem(v: unknown): v is ReviewItem {
  if (!obj(v)) return false;
  return (
    str(v.id) && v.id.length > 0 &&
    (v.contentType === "question" || v.contentType === "word") &&
    ["vocabulary", "reading", "listening"].includes(String(v.sourceModule)) &&
    str(v.sourceActivityId) &&
    str(v.questionId) &&
    time(v.createdAt) &&
    time(v.updatedAt) &&
    (v.lastReviewedAt === undefined || time(v.lastReviewedAt)) &&
    date(v.nextReviewAt) &&
    ["new", "weak", "reviewing", "mastered"].includes(String(v.masteryStatus)) &&
    num(v.reviewCount) &&
    num(v.correctStreak) &&
    num(v.wrongCount) &&
    num(v.priority) &&
    bool(v.favorite) &&
    bool(v.removed) &&
    Array.isArray(v.history) &&
    v.history.every(validHistory) &&
    (v.sources === undefined || (Array.isArray(v.sources) && v.sources.every(s => ["vocabulary", "reading", "listening"].includes(String(s))))) &&
    v.schemaVersion === 1
  );
}

function validSession(v: unknown): v is ReviewSession {
  if (!obj(v)) return false;
  if (!(
    str(v.id) &&
    date(v.date) &&
    ["daily", "manual", "end_of_day", "word"].includes(String(v.mode)) &&
    Array.isArray(v.itemIds) &&
    v.itemIds.every(id => str(id) && id.length > 0) &&
    new Set(v.itemIds).size === v.itemIds.length &&
    num(v.currentIndex) &&
    v.currentIndex <= v.itemIds.length &&
    obj(v.answers) &&
    time(v.startedAt) &&
    sources.includes(String(v.source)) &&
    bool(v.applied) && num(v.rewardXp) && v.rewardXp <= 20 &&
    (v.completedAt === undefined || time(v.completedAt))
  )) return false;
  const ids = v.itemIds as string[];
  const index = v.currentIndex as number;
  const answers = v.answers as Record<string, unknown>;
  if (Object.keys(answers).length !== index || ids.slice(0, index).some(id => !Object.hasOwn(answers, id))) return false;
  for (const [id, answer] of Object.entries(answers)) {
    if (!ids.includes(id) || !obj(answer) || !bool(answer.correct) || answer.result !== (answer.correct ? "review_correct" : "wrong")) return false;
  }
  return v.applied ? index === ids.length && ids.length > 0 && time(v.completedAt) : v.completedAt === undefined && v.rewardXp === 0;
}

export function loadReviewStore(
  storage: Storage | undefined,
): { store: ReviewStore; issue?: string } {
  if (!storage) return { store: emptyReviewStore(), issue: "复习存储不可用，本次进度不会保存" };
  let raw: string | null;
  try {
    raw = storage.getItem(REVIEW_KEY);
  } catch {
    return { store: emptyReviewStore(), issue: "复习存储不可用" };
  }
  if (!raw) return { store: emptyReviewStore() };
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return { store: emptyReviewStore(), issue: "复习数据已重置" };
  }
  if (!obj(value) || value.schemaVersion !== 1) {
    return { store: emptyReviewStore(), issue: "复习版本不兼容，已重置" };
  }
  const store = emptyReviewStore();
  let issue: string | undefined;
  if (obj(value.items))
    for (const [id, item] of Object.entries(value.items)) {
      if (validItem(item) && item.id === id) store.items[id] = item;
      else issue = issue ?? "部分错题数据已隔离";
    }
  if (obj(value.sessions))
    for (const [id, s] of Object.entries(value.sessions)) {
      if (validSession(s) && s.id === id && s.itemIds.every(itemId => Object.hasOwn(store.items, itemId))) store.sessions[id] = s;
      else issue = issue ?? "部分复习会话已隔离，其他记录已保留";
    }
  if (obj(value.xpLedger))
    for (const [k, xp] of Object.entries(value.xpLedger)) {
      if (/^review:\d{4}-\d{2}-\d{2}:.+$/.test(k) && validDate(k.slice(7,17)) && num(xp) && xp <= 2) store.xpLedger[k] = xp;
    }
  return { store, ...(issue ? { issue } : {}) };
}

/** 一次性提交题目状态、完成会话与奖励账本，重复调用不再结算。 */
export function completeReview(store: ReviewStore, sessionId: string, now: string): ReviewStore {
  const session = store.sessions[sessionId];
  if (!session) return store;
  const result = finishReviewSession(store.items, session, now, store.xpLedger);
  if (result.session === session) return store;
  return { ...store, items: result.items, sessions: { ...store.sessions, [sessionId]: result.session }, xpLedger: result.xpLedger };
}

export function saveReviewStore(
  storage: Storage | undefined,
  store: ReviewStore,
): boolean {
  try {
    if (!storage) return false;
    storage.setItem(REVIEW_KEY, JSON.stringify(store));
    return true;
  } catch {
    return false;
  }
}
