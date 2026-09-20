import { mockWritingTasks } from "@/data/mockWriting";
import { todayInShanghai } from "@/lib/dates";
import type {
  WritingDailyProgress,
  WritingStore,
  WritingSession,
} from "@/types/writing";
import type { SubjectiveSessionMode } from "@/types/subjective";
import { createWritingSession, reduceWritingSession } from "./session";
import type { WritingAction } from "./session";
import { writingXp } from "./xp";

export const DAILY_WRITING_COUNT = 1;

export function writingResumeSessions(store: WritingStore, today: string) {
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

export function pickDailyWriting(
  date: string,
  count = DAILY_WRITING_COUNT,
): string[] {
  const total = mockWritingTasks.length;
  if (!total) return [];
  const dayNumber = Math.floor(Date.parse(`${date}T00:00:00Z`) / 86_400_000);
  const seed = ((dayNumber % total) + total) % total;
  const ids: string[] = [];
  for (let i = 0; i < count; i++)
    ids.push(mockWritingTasks[(seed + i) % total].id);
  return ids;
}

export function planWritingFor(store: WritingStore, date: string): WritingDailyProgress {
  const saved = store.daily[date];
  return {
    date,
    taskIds: saved?.taskIds ?? pickDailyWriting(date),
    completedTaskIds: saved?.completedTaskIds ?? [],
    activeSessionId: saved?.activeSessionId,
  };
}

function pickExtraTask(store: WritingStore, plannedIds: string[]): string {
  const planned = new Set(plannedIds);
  const completed = new Set(
    Object.values(store.sessions)
      .filter((s) => s.applied)
      .map((s) => s.taskId),
  );
  const fresh = mockWritingTasks
    .map((t) => t.id)
    .find((id) => !planned.has(id) && !completed.has(id));
  if (fresh) return fresh;
  return mockWritingTasks[
    Math.floor(Math.random() * mockWritingTasks.length)
  ].id;
}

export function startWriting(
  store: WritingStore,
  mode: SubjectiveSessionMode,
  date: string,
  now: string,
  id: string,
): { store: WritingStore; id?: string } {
  const active = Object.values(store.sessions).find(
    (s) =>
      s.phase !== "complete" &&
      (mode === "daily"
        ? s.mode === "daily" && s.planDate === date
        : s.mode === "extra"),
  );
  if (active) return { store, id: active.id };
  const progress = planWritingFor(store, date);
  let taskId: string | undefined;
  if (mode === "daily") {
    taskId = progress.taskIds.find(
      (tid) => !progress.completedTaskIds.includes(tid),
    );
  } else {
    if (progress.completedTaskIds.length < progress.taskIds.length)
      return { store, id: undefined };
    taskId = pickExtraTask(store, progress.taskIds);
  }
  if (!taskId) return { store, id: undefined };
  const task = mockWritingTasks.find((t) => t.id === taskId);
  if (!task) return { store, id: undefined };
  const session = createWritingSession(id, mode, date, task, now);
  return {
    store: {
      ...store,
      sessions: { ...store.sessions, [id]: session },
      daily:
        mode === "daily"
          ? { ...store.daily, [date]: { ...progress, activeSessionId: id } }
          : store.daily,
    },
    id,
  };
}

export function updateWriting(
  store: WritingStore,
  id: string,
  action: WritingAction,
  now: string,
): WritingStore {
  const previous = store.sessions[id];
  if (!previous || previous.applied) return store;
  const task = mockWritingTasks.find((t) => t.id === previous.taskId);
  if (!task) return store;
  const session = reduceWritingSession(previous, action, task);
  if (session === previous) return store;

  let next: WritingStore = {
    ...store,
    sessions: { ...store.sessions, [id]: session },
  };

  if (session.phase === "complete") {
    const reward = writingXp(session, store.xpLedger, now);
    const completed: WritingSession = {
      ...session,
      rewardXp: reward.xp,
      applied: true,
      completedAt: now,
    };
    next = {
      ...next,
      xpLedger: reward.ledger,
      sessions: { ...next.sessions, [id]: completed },
      history: [
        ...store.history,
        {
          taskId: completed.taskId,
          submittedText: completed.submittedText ?? "",
          feedback: completed.feedback!,
          score: completed.feedback!.score,
          wordCount: completed.wordCount ?? 0,
          createdAt: now,
        },
      ],
    };
    if (completed.mode === "daily") {
      const progress = planWritingFor(store, completed.planDate);
      if (progress.taskIds.includes(completed.taskId)) {
        next = {
          ...next,
          daily: {
            ...next.daily,
            [completed.planDate]: {
              ...progress,
              completedTaskIds: [
                ...new Set([...progress.completedTaskIds, completed.taskId]),
              ],
            },
          },
        };
      }
    }
  }
  return next;
}

export function writingDayStats(store: WritingStore, date: string) {
  const completed = Object.values(store.sessions).filter(
    (s) =>
      s.applied &&
      s.completedAt &&
      todayInShanghai(new Date(s.completedAt)) === date,
  );
  return {
    extra: completed.filter((s) => s.mode === "extra").length,
    xp: Object.entries(store.xpLedger)
      .filter(([key]) => key.startsWith(`writing:day:${date}:`))
      .reduce((n, [, xp]) => n + xp, 0),
  };
}

export function deleteWritingHistory(
  store: WritingStore,
  index: number,
): WritingStore {
  return { ...store, history: store.history.filter((_, i) => i !== index) };
}
