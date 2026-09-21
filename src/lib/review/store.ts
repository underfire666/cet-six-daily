import type {
  ReviewItem,
  ReviewSession,
  ReviewStore,
} from "@/types/review";

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
  typeof v === "number" && Number.isFinite(v);
const bool = (v: unknown): v is boolean => typeof v === "boolean";

function validItem(v: unknown): v is ReviewItem {
  if (!obj(v)) return false;
  return (
    str(v.id) &&
    (v.contentType === "question" || v.contentType === "word") &&
    ["vocabulary", "reading", "listening"].includes(String(v.sourceModule)) &&
    str(v.sourceActivityId) &&
    str(v.questionId) &&
    str(v.createdAt) &&
    str(v.updatedAt) &&
    str(v.nextReviewAt) &&
    ["new", "weak", "reviewing", "mastered"].includes(String(v.masteryStatus)) &&
    num(v.reviewCount) &&
    num(v.correctStreak) &&
    num(v.wrongCount) &&
    num(v.priority) &&
    bool(v.favorite) &&
    bool(v.removed) &&
    Array.isArray(v.history) &&
    v.schemaVersion === 1
  );
}

function validSession(v: unknown): v is ReviewSession {
  if (!obj(v)) return false;
  return (
    str(v.id) &&
    str(v.date) &&
    ["daily", "manual", "end_of_day", "word"].includes(String(v.mode)) &&
    Array.isArray(v.itemIds) &&
    num(v.currentIndex) &&
    obj(v.answers) &&
    str(v.startedAt)
  );
}

export function loadReviewStore(
  storage: Storage | undefined,
): { store: ReviewStore; issue?: string } {
  if (!storage) return { store: emptyReviewStore() };
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
      if (validItem(item)) store.items[id] = item;
      else issue = issue ?? "部分错题数据已隔离";
    }
  if (obj(value.sessions))
    for (const [id, s] of Object.entries(value.sessions)) {
      if (validSession(s)) store.sessions[id] = s;
    }
  if (obj(value.xpLedger))
    for (const [k, xp] of Object.entries(value.xpLedger)) {
      if (str(k) && num(xp)) store.xpLedger[k] = xp;
    }
  return { store, ...(issue ? { issue } : {}) };
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
