import { mockListeningMaterials } from "@/data/mockListening";
import { todayInShanghai } from "@/lib/dates";
import type {
  ListeningDailyProgress,
  ListeningSessionMode,
  ListeningStore,
} from "@/types/listening";
import { createListeningSession, reduceListeningSession } from "./session";
import { listeningXp } from "./xp";
import type { ListeningAction } from "./session";

export const DAILY_LISTENING_COUNT = 3;

export function listeningResumeSessions(store: ListeningStore, today: string) {
  const pending = Object.values(store.sessions).filter(
    (s) => s.phase !== "complete",
  );
  return {
    active: pending.find((s) => s.mode === "daily" && s.planDate === today),
    previousDaily: pending.find(
      (s) => s.mode === "daily" && s.planDate !== today,
    ),
    extraActive: pending.find((s) => s.mode === "extra"),
  };
}

/** 按日期确定性生成每日听力任务（同一天刷新结果不变）。 */
export function pickDailyListening(
  date: string,
  count = DAILY_LISTENING_COUNT,
): string[] {
  const total = mockListeningMaterials.length;
  if (!total) return [];
  const dayNumber = Math.floor(Date.parse(`${date}T00:00:00Z`) / 86_400_000);
  const seed = ((dayNumber % total) + total) % total;
  const ids: string[] = [];
  for (let i = 0; i < count; i++)
    ids.push(mockListeningMaterials[(seed + i) % total].id);
  return ids;
}

export function planFor(
  store: ListeningStore,
  date: string,
): ListeningDailyProgress {
  const saved = store.daily[date];
  return {
    date,
    materialIds: saved?.materialIds ?? pickDailyListening(date),
    completedMaterialIds: saved?.completedMaterialIds ?? [],
    activeSessionId: saved?.activeSessionId,
  };
}

/** 额外听力候选：优先未计划、且今天未完成过的材料；不足时允许重复（按重复 XP 处理）。 */
function pickExtraMaterial(
  store: ListeningStore,
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
      .map((s) => s.materialId),
  );
  const fresh = mockListeningMaterials
    .map((m) => m.id)
    .find((id) => !planned.has(id) && !completedToday.has(id));
  if (fresh) return fresh;
  return mockListeningMaterials.map((m) => m.id).find((id) => !planned.has(id));
}

export function startListening(
  store: ListeningStore,
  mode: ListeningSessionMode,
  date: string,
  now: string,
  id: string,
): { store: ListeningStore; id?: string } {
  const active = Object.values(store.sessions).find(
    (s) =>
      s.phase !== "complete" &&
      (mode === "daily"
        ? s.mode === "daily" && s.planDate === date
        : s.mode === "extra"),
  );
  if (active) return { store, id: active.id };
  const progress = planFor(store, date);
  let materialId: string | undefined;
  if (mode === "daily") {
    materialId = progress.materialIds.find(
      (mid) => !progress.completedMaterialIds.includes(mid),
    );
  } else {
    if (progress.completedMaterialIds.length < progress.materialIds.length)
      return { store, id: undefined };
    materialId = pickExtraMaterial(store, date, progress.materialIds);
  }
  if (!materialId) return { store, id: undefined };
  const material = mockListeningMaterials.find((m) => m.id === materialId);
  if (!material) return { store, id: undefined };
  const session = createListeningSession(id, mode, date, material, now);
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
                materialIds: progress.materialIds,
                completedMaterialIds: progress.completedMaterialIds,
                activeSessionId: id,
              },
            }
          : store.daily,
    },
    id,
  };
}

export function updateListening(
  store: ListeningStore,
  id: string,
  action: ListeningAction,
  now: string,
): ListeningStore {
  const previous = store.sessions[id];
  if (!previous || previous.applied) return store;
  const session = reduceListeningSession(previous, action);
  if (session === previous) return store;
  let daily = store.daily;
  let xpLedger = store.xpLedger;
  if (session.phase === "complete") {
    const reward = listeningXp(session, xpLedger, now);
    xpLedger = reward.ledger;
    const completed = {
      ...session,
      rewardXp: reward.xp,
      applied: true,
      completedAt: now,
    };
    if (completed.mode === "daily") {
      const progress = planFor(store, completed.planDate);
      if (progress.materialIds.includes(completed.materialId)) {
        daily = {
          ...daily,
          [completed.planDate]: {
            ...progress,
            completedMaterialIds: [
              ...new Set([
                ...progress.completedMaterialIds,
                completed.materialId,
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

export function listeningDayStats(store: ListeningStore, date: string) {
  const completed = Object.values(store.sessions).filter(
    (s) =>
      s.applied &&
      s.completedAt &&
      todayInShanghai(new Date(s.completedAt)) === date,
  );
  return {
    extra: completed.filter((s) => s.mode === "extra").length,
    xp: Object.entries(store.xpLedger)
      .filter(([key]) => key.startsWith(`listening:day:${date}:`))
      .reduce((n, [, xp]) => n + xp, 0),
  };
}
