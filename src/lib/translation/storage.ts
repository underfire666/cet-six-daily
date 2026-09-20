import { translationTaskById } from "@/data/mockTranslation";
import { validDate } from "@/lib/dates";
import type { KeyStorage } from "@/lib/lesson/storage";
import type {
  TranslationDailyProgress,
  TranslationHistoryEntry,
  TranslationSession,
  TranslationStore,
} from "@/types/translation";

export const TRANSLATION_KEY = "cet-daily:v1:translation";

export const emptyTranslationStore = (): TranslationStore => ({
  schemaVersion: 1,
  daily: {},
  sessions: {},
  history: [],
  xpLedger: {},
});

const obj = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const timestamp = (v: unknown): v is string =>
  typeof v === "string" && !Number.isNaN(Date.parse(v));
const count = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v);

function validDaily(v: unknown): v is TranslationDailyProgress {
  if (
    !obj(v) ||
    typeof v.date !== "string" ||
    !validDate(v.date) ||
    !Array.isArray(v.taskIds) ||
    v.taskIds.length === 0 ||
    v.taskIds.some((id) => typeof id !== "string" || !translationTaskById(id)) ||
    new Set(v.taskIds).size !== v.taskIds.length ||
    !Array.isArray(v.completedTaskIds)
  )
    return false;
  const ids = v.taskIds;
  return (
    v.completedTaskIds.every((id) => typeof id === "string" && ids.includes(id)) &&
    (v.activeSessionId === undefined || typeof v.activeSessionId === "string")
  );
}

function validFeedback(v: unknown): v is TranslationSession["feedback"] {
  if (v === undefined) return true;
  if (!obj(v)) return false;
  return (
    count(v.score) &&
    count(v.maxScore) &&
    typeof v.summary === "string" &&
    Array.isArray(v.issues) &&
    Array.isArray(v.details) &&
    v.provider === "mock" &&
    timestamp(v.createdAt)
  );
}

function validSession(v: unknown): v is TranslationSession {
  if (
    !obj(v) ||
    v.schemaVersion !== 1 ||
    typeof v.id !== "string" ||
    !["daily", "extra"].includes(String(v.mode)) ||
    typeof v.planDate !== "string" ||
    !validDate(v.planDate) ||
    typeof v.taskId !== "string" ||
    !translationTaskById(v.taskId) ||
    !["drafting", "reviewing", "complete"].includes(String(v.phase)) ||
    typeof v.draft !== "string" ||
    typeof v.startedAt !== "string" ||
    !timestamp(v.startedAt) ||
    typeof v.applied !== "boolean" ||
    !validFeedback(v.feedback)
  )
    return false;
  if (v.submittedText !== undefined && typeof v.submittedText !== "string")
    return false;
  if (v.submittedAt !== undefined && !timestamp(v.submittedAt)) return false;
  if (v.completedAt !== undefined && !timestamp(v.completedAt)) return false;
  if (v.phase === "complete")
    return (
      !!v.applied &&
      count(v.rewardXp) &&
      !!v.feedback &&
      !!v.submittedText &&
      !!v.submittedAt &&
      !!v.completedAt
    );
  if (v.applied) return false;
  return true;
}

function validHistory(v: unknown): v is TranslationHistoryEntry {
  return (
    obj(v) &&
    typeof v.taskId === "string" &&
    !!translationTaskById(v.taskId) &&
    typeof v.submittedText === "string" &&
    validFeedback(v.feedback) &&
    !!v.feedback &&
    count(v.score) &&
    timestamp(v.createdAt)
  );
}

export function loadTranslationStore(storage: KeyStorage | undefined): {
  store: TranslationStore;
  persistent: boolean;
  issue?: string;
} {
  const unavailable = {
    store: emptyTranslationStore(),
    persistent: false,
    issue: "浏览器无法读取本地存储，本次翻译进度将不会被保存。",
  };
  if (!storage) return unavailable;
  let raw: string | null;
  try {
    raw = storage.getItem(TRANSLATION_KEY);
  } catch {
    return unavailable;
  }
  if (!raw) return { store: emptyTranslationStore(), persistent: true };
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return {
      store: emptyTranslationStore(),
      persistent: true,
      issue: "翻译进度文件已损坏，已为你重新开始。",
    };
  }
  if (!obj(value) || value.schemaVersion !== 1) {
    return {
      store: emptyTranslationStore(),
      persistent: true,
      issue: "翻译进度版本不兼容，已为你重新开始。",
    };
  }
  const store = emptyTranslationStore();
  let issue: string | undefined;
  if (obj(value.daily))
    for (const [date, daily] of Object.entries(value.daily)) {
      if (validDaily(daily)) store.daily[date] = daily;
      else issue = issue ?? "部分翻译记录无法读取，已保留其他有效记录。";
    }
  if (obj(value.sessions))
    for (const [id, session] of Object.entries(value.sessions)) {
      if (validSession(session)) store.sessions[id] = session;
      else issue = issue ?? "部分翻译记录无法读取，已保留其他有效记录。";
    }
  if (Array.isArray(value.history))
    for (const entry of value.history) {
      if (validHistory(entry)) store.history.push(entry);
      else issue = issue ?? "部分翻译历史无法读取，已保留其他有效记录。";
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
      else issue = issue ?? "部分翻译积分记录无法读取，已保留其他有效记录。";
    }
  return { store, persistent: true, ...(issue ? { issue } : {}) };
}

export function saveTranslationStore(
  storage: KeyStorage | undefined,
  store: TranslationStore,
): boolean {
  try {
    if (!storage) return false;
    storage.setItem(TRANSLATION_KEY, JSON.stringify(store));
    return true;
  } catch {
    return false;
  }
}
