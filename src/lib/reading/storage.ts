import { readingArticleById, readingWordById } from "@/content/learning";


import { validDate } from "@/lib/dates";
import { validSession, type KeyStorage } from "@/lib/lesson/storage";
import { readingLesson } from "./questions";
import type {
  ReadingDailyProgress,
  ReadingSession,
  ReadingStore,
} from "@/types/reading";

export const READING_KEY = "cet-daily:v1:reading";

export const emptyReadingStore = (): ReadingStore => ({
  schemaVersion: 1,
  daily: {},
  sessions: {},
  xpLedger: {},
});

const obj = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const timestamp = (v: unknown): v is string =>
  typeof v === "string" && !Number.isNaN(Date.parse(v));
const count = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v);

function validDaily(v: unknown): v is ReadingDailyProgress {
  if (
    !obj(v) ||
    typeof v.date !== "string" ||
    !validDate(v.date) ||
    !Array.isArray(v.articleIds) ||
    v.articleIds.length === 0 ||
    v.articleIds.some((id) => typeof id !== "string" || !readingArticleById(id)) ||
    new Set(v.articleIds).size !== v.articleIds.length ||
    !Array.isArray(v.completedArticleIds)
  )
    return false;
  const ids = v.articleIds;
  return (
    v.completedArticleIds.every(
      (id) => typeof id === "string" && ids.includes(id),
    ) &&
    (v.activeSessionId === undefined || typeof v.activeSessionId === "string")
  );
}

function validReadingSession(v: unknown): v is ReadingSession {
  if (
    !obj(v) ||
    v.schemaVersion !== 1 ||
    typeof v.id !== "string" ||
    !["daily", "extra"].includes(String(v.mode)) ||
    typeof v.planDate !== "string" ||
    !validDate(v.planDate) ||
    typeof v.articleId !== "string" ||
    !readingArticleById(v.articleId) ||
    !["reading", "quiz", "complete"].includes(String(v.phase)) ||
    typeof v.readingCompleted !== "boolean" ||
    typeof v.startedAt !== "string" ||
    !timestamp(v.startedAt) ||
    typeof v.applied !== "boolean" ||
    !Array.isArray(v.collectedWordIds) ||
    v.collectedWordIds.some(
      (id) => typeof id !== "string" || !readingWordById(id),
    )
  )
    return false;
  if (v.completedAt !== undefined && !timestamp(v.completedAt)) return false;
  const article = readingArticleById(v.articleId);
  if (!article) return false;
  if (!validSession(v.lesson, readingLesson(article), false)) return false;
  if (v.lesson.id !== v.id) return false;
  if (v.phase === "complete")
    return v.lesson.phase === "complete" && v.applied && count(v.rewardXp);
  if (v.applied || v.lesson.phase === "complete") return false;
  if (v.phase === "reading") {
    if (v.readingCompleted || v.lesson.index !== 0 || v.lesson.phase !== "answering")
      return false;
    return Object.keys(v.lesson.records).length === 0;
  }
  return v.readingCompleted === true;
}

export function loadReadingStore(storage: KeyStorage | undefined): {
  store: ReadingStore;
  persistent: boolean;
  issue?: string;
} {
  const unavailable = {
    store: emptyReadingStore(),
    persistent: false,
    issue: "浏览器无法读取本地存储，本次进度将不会被保存。",
  };
  if (!storage) return unavailable;
  let raw: string | null;
  try {
    raw = storage.getItem(READING_KEY);
  } catch {
    return unavailable;
  }
  if (!raw) return { store: emptyReadingStore(), persistent: true };
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return {
      store: emptyReadingStore(),
      persistent: true,
      issue: "阅读进度文件已损坏，已为你重新开始。",
    };
  }
  if (!obj(value) || value.schemaVersion !== 1) {
    return {
      store: emptyReadingStore(),
      persistent: true,
      issue: "阅读进度版本不兼容，已为你重新开始。",
    };
  }
  const store = emptyReadingStore();
  let issue: string | undefined;
  if (obj(value.daily))
    for (const [date, daily] of Object.entries(value.daily)) {
      if (validDaily(daily)) store.daily[date] = daily;
      else issue = issue ?? "部分阅读记录无法读取，已保留其他有效记录。";
    }
  if (obj(value.sessions))
    for (const [id, session] of Object.entries(value.sessions)) {
      if (validReadingSession(session)) store.sessions[id] = session;
      else issue = issue ?? "部分阅读记录无法读取，已保留其他有效记录。";
    }
  for (const [date, daily] of Object.entries(store.daily)) {
    const sessionId = daily.activeSessionId;
    if (sessionId && !store.sessions[sessionId])
      store.daily[date] = { ...daily, activeSessionId: undefined };
  }
  if (obj(value.xpLedger))
    for (const [key, xp] of Object.entries(value.xpLedger)) {
      if (typeof key === "string" && count(xp) && xp >= 0)
        store.xpLedger[key] = xp;
      else issue = issue ?? "部分阅读积分记录无法读取，已保留其他有效记录。";
    }
  return { store, persistent: true, ...(issue ? { issue } : {}) };
}

export function saveReadingStore(
  storage: KeyStorage | undefined,
  store: ReadingStore,
): boolean {
  try {
    if (!storage) return false;
    storage.setItem(READING_KEY, JSON.stringify(store));
    return true;
  } catch {
    return false;
  }
}
