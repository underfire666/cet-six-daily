"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { todayInShanghai } from "@/lib/dates";
import {
  planFor,
  listeningDayStats,
  startListening,
  updateListening,
  listeningResumeSessions,
} from "@/lib/listening/store";
import {
  emptyListeningStore,
  loadListeningStore,
  saveListeningStore,
} from "@/lib/listening/storage";
import type { ListeningAction } from "@/lib/listening/session";
import type { ListeningSessionMode, ListeningStore } from "@/types/listening";
import { useLearning } from "../LearningProvider";
import { useToday } from "../StudyProvider";
import { getScopedStorage } from "@/lib/storage/scoped";
import { subscribeRemoteHydrate } from "@/lib/storage/hydration-events";
import { enqueueSession } from "@/lib/sync/adapters";

const Context = createContext<ReturnType<typeof useListeningState> | null>(
  null,
);

function useListeningState() {
  const today = useToday();
  const learning = useLearning();
  const [store, setStore] = useState(emptyListeningStore);
  const latest = useRef(store);
  const storage = useRef<Storage | undefined>(undefined);
  const [ready, setReady] = useState(false),
    [notice, setNotice] = useState("");
  const [, forceRender] = useState(0);
  const commit = useCallback((next: ListeningStore) => {
    latest.current = next;
    setStore(next);
    if (!saveListeningStore(storage.current, next))
      setNotice("浏览器暂时无法保存听力进度，关闭或刷新后记录可能丢失。");
  }, []);
  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      try {
        storage.current = getScopedStorage() as Storage | undefined;
      } catch {}
      const loaded = loadListeningStore(storage.current);
      latest.current = loaded.store;
      setStore(loaded.store);
      if (loaded.issue) setNotice(loaded.issue);
      setReady(true);
    });
    const tick = () => forceRender((n) => n + 1);
    const timer = setInterval(tick, 30000);
    window.addEventListener("focus", tick);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener("focus", tick);
    };
  }, []);
  useEffect(() => subscribeRemoteHydrate(["listening"], () => {
    const loaded = loadListeningStore(storage.current);
    latest.current = loaded.store;
    setStore(loaded.store);
    if (loaded.issue) setNotice(loaded.issue);
  }), []);
  const award = learning.awardXp;
  useEffect(() => {
    if (ready && learning.ready)
      for (const session of Object.values(store.sessions))
        if (session.applied && session.rewardXp !== undefined)
          award(`listening:${session.id}`, session.rewardXp);
  }, [store.sessions, ready, learning.ready, award]);
  const start = useCallback(
    (mode: ListeningSessionMode) => {
      if (!storage.current && !ready) return;
      const now = new Date().toISOString();
      const result = startListening(
        latest.current,
        mode,
        todayInShanghai(new Date(now)),
        now,
        crypto.randomUUID(),
      );
      if (result.store !== latest.current) commit(result.store);
      return result.id;
    },
    [commit, ready],
  );
  const dispatch = useCallback(
    (id: string, action: ListeningAction) => {
      const previous = latest.current.sessions[id];
      const next = updateListening(
        latest.current,
        id,
        action,
        new Date().toISOString(),
      );
      if (next !== latest.current) {
        commit(next);
        const completed = next.sessions[id];
        if (!previous?.applied && completed?.applied && completed.completedAt) {
          enqueueSession({ sessionId: id, module: "listening", activityId: completed.materialId,
            planDate: completed.planDate, startedAt: completed.startedAt, completedAt: completed.completedAt,
            status: "completed", payload: completed as unknown as Record<string, unknown> });
        }
      }
    },
    [commit],
  );
  const plan = planFor(store, today);
  return {
    ready,
    notice,
    store,
    plan,
    progress: plan,
    dailyComplete: plan.materialIds.length > 0 && plan.completedMaterialIds.length === plan.materialIds.length,
    ...listeningResumeSessions(store, today),
    dayStats: listeningDayStats(store, today),
    start,
    dispatch,
  };
}

export function ListeningProvider({ children }: { children: React.ReactNode }) {
  return (
    <Context.Provider value={useListeningState()}>{children}</Context.Provider>
  );
}

export function useListening() {
  const value = useContext(Context);
  if (!value) throw new Error("ListeningProvider required");
  return value;
}
