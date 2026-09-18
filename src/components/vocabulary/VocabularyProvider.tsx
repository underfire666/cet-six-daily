"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { wordById, vocabularySettings } from "@/data/mockVocabulary";
import { todayInShanghai } from "@/lib/dates";
import { newVocabularyState } from "@/lib/vocabulary/mastery";
import { getWordsDueForReview } from "@/lib/vocabulary/reviewScheduler";
import {
  planFor,
  startVocabulary,
  updateVocabulary,
  batchProgress,
  vocabularyDayStats,
  addWordToWordbook,
} from "@/lib/vocabulary/store";
import {
  emptyVocabularyStore,
  loadVocabularyStore,
  saveVocabularyStore,
} from "@/lib/vocabulary/storage";
import type { VocabularyAction } from "@/lib/vocabulary/session";
import type {
  VocabularySessionMode,
  VocabularyStore,
  Word,
} from "@/types/vocabulary";
import { useLearning } from "../LearningProvider";
import { useToday } from "../StudyProvider";
const Context = createContext<ReturnType<typeof useVocabularyState> | null>(
  null,
);
function useVocabularyState() {
  const today = useToday();
  const learning = useLearning();
  const [store, setStore] = useState<VocabularyStore>(emptyVocabularyStore);
  const latest = useRef(store);
  const storage = useRef<Storage | undefined>(undefined);
  const [ready, setReady] = useState(false),
    [notice, setNotice] = useState("");
  const [now, setNow] = useState("");
  const commit = useCallback((next: VocabularyStore) => {
    latest.current = next;
    setStore(next);
    if (!saveVocabularyStore(storage.current, next))
      setNotice("浏览器暂时无法保存词汇进度，关闭或刷新后记录可能丢失。");
  }, []);
  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      try {
        storage.current = window.localStorage;
      } catch {}
      const loaded = loadVocabularyStore(storage.current);
      latest.current = loaded.store;
      setStore(loaded.store);
      if (loaded.issue) setNotice(loaded.issue);
      setReady(true);
    });
    const tick = () => setNow(new Date().toISOString());
    tick();
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
          award(`vocabulary:${session.id}`, session.rewardXp);
  }, [store.sessions, ready, learning.ready, award]);
  const start = useCallback(
    (mode: VocabularySessionMode, wordId?: string, extraTarget?: number) => {
      if (!storage.current && !ready) return;
      const now = new Date().toISOString();
      const result = startVocabulary(
        latest.current,
        mode,
        todayInShanghai(new Date(now)),
        now,
        crypto.randomUUID(),
        wordId,
        extraTarget,
      );
      if (result.store !== latest.current) commit(result.store);
      return result.id;
    },
    [commit, ready],
  );
  const dispatch = useCallback(
    (id: string, action: VocabularyAction) => {
      const next = updateVocabulary(
        latest.current,
        id,
        action,
        new Date().toISOString(),
      );
      if (next !== latest.current) commit(next);
    },
    [commit],
  );
  const toggleWordbook = useCallback(
    (wordId: string) => {
      const word = wordById(wordId);
      if (!word) return;
      const previous =
        latest.current.states[wordId] ??
        newVocabularyState(word, new Date().toISOString());
      commit({
        ...latest.current,
        states: {
          ...latest.current.states,
          [wordId]: { ...previous, addedToWordbook: !previous.addedToWordbook },
        },
      });
    },
    [commit],
  );
  const addWordbookWord = useCallback(
    (word: Word) => {
      const result = addWordToWordbook(
        latest.current,
        word,
        new Date().toISOString(),
      );
      if (result.store !== latest.current) commit(result.store);
      return result.added;
    },
    [commit],
  );
  const plan = planFor(store, today);
  const active = Object.values(store.sessions).find(
    (s) => s.mode === "learn" && s.date === today && s.phase !== "complete",
  );
  const inProgress =
    active?.date === today
      ? active.wordIds.filter((id) => {
          const r = active.lesson.records[`vq:${id}`];
          return (
            r?.initialResult && (r.initialResult !== "wrong" || r.retestResult)
          );
        })
      : [];
  const progress = {
    ...plan,
    completedWordIds: [...new Set([...plan.completedWordIds, ...inProgress])],
  };
  return {
    ready,
    notice,
    store,
    progress,
    active,
    previousDaily: Object.values(store.sessions).find(
      (s) => s.mode === "learn" && s.date !== today && s.phase !== "complete",
    ),
    extraBatch: Object.values(store.batches).find(
      (b) => batchProgress(store, b.id).completed < b.target,
    ),
    dayStats: vocabularyDayStats(store, today),
    dailyComplete: plan.completedWordIds.length === plan.wordIds.length,
    settings: vocabularySettings,
    due: getWordsDueForReview(store.states, now),
    wordbook: Object.values(store.states).filter((s) => s.addedToWordbook),
    start,
    dispatch,
    toggleWordbook,
    addWordbookWord,
  };
}
export function VocabularyProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Context.Provider value={useVocabularyState()}>{children}</Context.Provider>
  );
}
export function useVocabulary() {
  const value = useContext(Context);
  if (!value) throw new Error("VocabularyProvider required");
  return value;
}
