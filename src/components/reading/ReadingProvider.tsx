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
  readingDayStats,
  startReading,
  updateReading,
} from "@/lib/reading/store";
import {
  emptyReadingStore,
  loadReadingStore,
  saveReadingStore,
} from "@/lib/reading/storage";
import type { ReadingAction } from "@/lib/reading/session";
import type { ReadingSessionMode, ReadingStore } from "@/types/reading";
import { useLearning } from "../LearningProvider";
import { useToday } from "../StudyProvider";
import { getScopedStorage } from "@/lib/storage/scoped";

const Context = createContext<ReturnType<typeof useReadingState> | null>(null);

function useReadingState() {
  const today = useToday();
  const learning = useLearning();
  const [store, setStore] = useState<ReadingStore>(emptyReadingStore);
  const latest = useRef(store);
  const storage = useRef<Storage | undefined>(undefined);
  const [ready, setReady] = useState(false),
    [notice, setNotice] = useState("");
  const [, forceRender] = useState(0);
  const commit = useCallback((next: ReadingStore) => {
    latest.current = next;
    setStore(next);
    if (!saveReadingStore(storage.current, next))
      setNotice("浏览器暂时无法保存阅读进度，关闭或刷新后记录可能丢失。");
  }, []);
  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      try {
        storage.current = getScopedStorage() as Storage | undefined;
      } catch {}
      const loaded = loadReadingStore(storage.current);
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
  const award = learning.awardXp;
  useEffect(() => {
    if (ready && learning.ready)
      for (const session of Object.values(store.sessions))
        if (session.applied && session.rewardXp !== undefined)
          award(`reading:${session.id}`, session.rewardXp);
  }, [store.sessions, ready, learning.ready, award]);
  const start = useCallback(
    (mode: ReadingSessionMode) => {
      if (!storage.current && !ready) return;
      const now = new Date().toISOString();
      const result = startReading(
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
    (id: string, action: ReadingAction) => {
      const next = updateReading(
        latest.current,
        id,
        action,
        new Date().toISOString(),
      );
      if (next !== latest.current) commit(next);
    },
    [commit],
  );
  const plan = planFor(store, today);
  const inProgress = Object.values(store.sessions).filter(
    (s) => s.phase !== "complete",
  );
  const active =
    inProgress.find((s) => s.mode === "daily" && s.planDate === today) ??
    inProgress[0];
  return {
    ready,
    notice,
    store,
    plan,
    progress: plan,
    dailyComplete:
      plan.articleIds.length > 0 && plan.completedArticleIds.length === plan.articleIds.length,
    active,
    previousDaily: inProgress.find(
      (s) => s.mode === "daily" && s.planDate !== today,
    ),
    dayStats: readingDayStats(store, today),
    start,
    dispatch,
  };
}
export function ReadingProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Context.Provider value={useReadingState()}>{children}</Context.Provider>
  );
}
export function useReading() {
  const value = useContext(Context);
  if (!value) throw new Error("ReadingProvider required");
  return value;
}
