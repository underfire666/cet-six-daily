import { listeningMaterialById } from "@/data/mockListening";
import { listeningWordById } from "@/data/listeningVocabulary";
import { validDate } from "@/lib/dates";
import { validSession, type KeyStorage } from "@/lib/lesson/storage";
import { listeningLesson } from "./questions";
import type {
  ListeningDailyProgress,
  ListeningRate,
  ListeningSession,
  ListeningStore,
} from "@/types/listening";

export const LISTENING_KEY = "cet-daily:v1:listening";

export const emptyListeningStore = (): ListeningStore => ({
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

function validDaily(v: unknown): v is ListeningDailyProgress {
  if (
    !obj(v) ||
    typeof v.date !== "string" ||
    !validDate(v.date) ||
    !Array.isArray(v.materialIds) ||
    v.materialIds.length === 0 ||
    v.materialIds.some((id) => typeof id !== "string" || !listeningMaterialById(id)) ||
    new Set(v.materialIds).size !== v.materialIds.length ||
    !Array.isArray(v.completedMaterialIds)
  )
    return false;
  const ids = v.materialIds;
  return (
    v.completedMaterialIds.every(
      (id) => typeof id === "string" && ids.includes(id),
    ) &&
    (v.activeSessionId === undefined || typeof v.activeSessionId === "string")
  );
}

function validRate(v: unknown): v is ListeningRate {
  return v === 0.8 || v === 1.0;
}

function validListeningSession(v: unknown): v is ListeningSession {
  if (
    !obj(v) ||
    v.schemaVersion !== 1 ||
    typeof v.id !== "string" ||
    !["daily", "extra"].includes(String(v.mode)) ||
    typeof v.planDate !== "string" ||
    !validDate(v.planDate) ||
    typeof v.materialId !== "string" ||
    !listeningMaterialById(v.materialId) ||
    !["listening", "question", "complete"].includes(String(v.phase)) ||
    typeof v.listeningCompleted !== "boolean" ||
    typeof v.playCount !== "number" ||
    v.playCount < 0 ||
    !validRate(v.rate) ||
    typeof v.transcriptViewedBeforeAnswer !== "boolean" ||
    typeof v.startedAt !== "string" ||
    !timestamp(v.startedAt) ||
    typeof v.applied !== "boolean" ||
    !Array.isArray(v.collectedWordIds) ||
    v.collectedWordIds.some(
      (id) => typeof id !== "string" || !listeningWordById(id),
    )
  )
    return false;
  if (v.completedAt !== undefined && !timestamp(v.completedAt)) return false;
  const material = listeningMaterialById(v.materialId);
  if (!material) return false;
  if (!validSession(v.lesson, listeningLesson(material), false)) return false;
  if (v.lesson.id !== v.id) return false;
  if (v.phase === "complete")
    return (
      v.lesson.phase === "complete" && v.applied && count(v.rewardXp)
    );
  if (v.applied || v.lesson.phase === "complete") return false;
  if (v.phase === "listening") {
    if (
      v.listeningCompleted ||
      v.lesson.index !== 0 ||
      v.lesson.phase !== "answering"
    )
      return false;
    return Object.keys(v.lesson.records).length === 0;
  }
  return v.listeningCompleted === true;
}

export function loadListeningStore(storage: KeyStorage | undefined): {
  store: ListeningStore;
  persistent: boolean;
  issue?: string;
} {
  const unavailable = {
    store: emptyListeningStore(),
    persistent: false,
    issue: "浏览器无法读取本地存储，本次听力进度将不会被保存。",
  };
  if (!storage) return unavailable;
  let raw: string | null;
  try {
    raw = storage.getItem(LISTENING_KEY);
  } catch {
    return unavailable;
  }
  if (!raw) return { store: emptyListeningStore(), persistent: true };
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return {
      store: emptyListeningStore(),
      persistent: true,
      issue: "听力进度文件已损坏，已为你重新开始。",
    };
  }
  if (!obj(value) || value.schemaVersion !== 1) {
    return {
      store: emptyListeningStore(),
      persistent: true,
      issue: "听力进度版本不兼容，已为你重新开始。",
    };
  }
  const store = emptyListeningStore();
  let issue: string | undefined;
  if (obj(value.daily))
    for (const [date, daily] of Object.entries(value.daily)) {
      if (validDaily(daily)) store.daily[date] = daily;
      else issue = issue ?? "部分听力记录无法读取，已保留其他有效记录。";
    }
  if (obj(value.sessions))
    for (const [id, session] of Object.entries(value.sessions)) {
      if (validListeningSession(session)) store.sessions[id] = session;
      else issue = issue ?? "部分听力记录无法读取，已保留其他有效记录。";
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
      else issue = issue ?? "部分听力积分记录无法读取，已保留其他有效记录。";
    }
  return { store, persistent: true, ...(issue ? { issue } : {}) };
}

export function saveListeningStore(
  storage: KeyStorage | undefined,
  store: ListeningStore,
): boolean {
  try {
    if (!storage) return false;
    storage.setItem(LISTENING_KEY, JSON.stringify(store));
    return true;
  } catch {
    return false;
  }
}
