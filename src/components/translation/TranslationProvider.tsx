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
  translationDayStats,
  startTranslation,
  updateTranslation,
  translationResumeSessions,
  deleteTranslationHistory,
} from "@/lib/translation/store";
import {
  emptyTranslationStore,
  loadTranslationStore,
  saveTranslationStore,
} from "@/lib/translation/storage";
import type { TranslationAction } from "@/lib/translation/session";
import type { TranslationStore } from "@/types/translation";
import type { SubjectiveSessionMode } from "@/types/subjective";
import { useLearning } from "../LearningProvider";
import { useToday } from "../StudyProvider";

const Context = createContext<ReturnType<typeof useTranslationState> | null>(
  null,
);

function useTranslationState() {
  const today = useToday();
  const learning = useLearning();
  const [store, setStore] = useState(emptyTranslationStore);
  const latest = useRef(store);
  const storage = useRef<Storage | undefined>(undefined);
  const [ready, setReady] = useState(false),
    [notice, setNotice] = useState("");
  const [lastSaveOk, setLastSaveOk] = useState<boolean | null>(null);
  const [, forceRender] = useState(0);

  const commit = useCallback((next: TranslationStore) => {
    latest.current = next;
    setStore(next);
    if (saveTranslationStore(storage.current, next)) {
      setLastSaveOk(true);
    } else {
      setLastSaveOk(false);
      setNotice("浏览器暂时无法保存翻译进度，关闭或刷新后记录可能丢失。");
    }
  }, []);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      try {
        storage.current = window.localStorage;
      } catch {}
      const loaded = loadTranslationStore(storage.current);
      latest.current = loaded.store;
      setStore(loaded.store);
      if (!loaded.persistent) setLastSaveOk(false);
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
          award(`translation:${session.id}`, session.rewardXp);
  }, [store.sessions, ready, learning.ready, award]);

  const start = useCallback(
    (mode: SubjectiveSessionMode) => {
      if (!storage.current && !ready) return;
      const now = new Date().toISOString();
      const result = startTranslation(
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
    (id: string, action: TranslationAction) => {
      const next = updateTranslation(
        latest.current,
        id,
        action,
        new Date().toISOString(),
      );
      if (next !== latest.current) commit(next);
    },
    [commit],
  );

  const removeHistory = useCallback(
    (index: number) => commit(deleteTranslationHistory(latest.current, index)),
    [commit],
  );

  const plan = planFor(store, today);
  return {
    ready,
    notice,
    lastSaveOk,
    store,
    history: store.history,
    plan,
    progress: plan,
    dailyComplete:
      plan.completedTaskIds.length === plan.taskIds.length &&
      plan.taskIds.length > 0,
    ...translationResumeSessions(store, today),
    dayStats: translationDayStats(store, today),
    start,
    dispatch,
    removeHistory,
  };
}

export function TranslationProvider({ children }: { children: React.ReactNode }) {
  return (
    <Context.Provider value={useTranslationState()}>{children}</Context.Provider>
  );
}

export function useTranslation() {
  const value = useContext(Context);
  if (!value) throw new Error("TranslationProvider required");
  return value;
}
