"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useToday } from "@/components/StudyProvider";
import { useReading } from "@/components/reading/ReadingProvider";
import { useListening } from "@/components/listening/ListeningProvider";
import { useLearning } from "@/components/LearningProvider";
import type {
  ReviewItem,
  ReviewResult,
  ReviewSession,
  ReviewStore,
} from "@/types/review";
import {
  emptyReviewStore,
  loadReviewStore,
  saveReviewStore,
  completeReview,
} from "@/lib/review/store";
import {
  createReviewSession,
  getDueReviews,
  selectDailyReviews,
  selectManualReviews,
} from "@/lib/review/scheduler";

import { importReviewEvents } from "@/lib/review/import";

const Context = createContext<ReturnType<typeof useReviewState> | null>(null);

function useReviewState() {
  const today = useToday();
  const reading = useReading();
  const listening = useListening();
  const learning = useLearning();

  const [store, setStore] = useState<ReviewStore>(emptyReviewStore);
  const latest = useRef(store);
  const storage = useRef<Storage | undefined>(undefined);
  const [ready, setReady] = useState(false);
  const [notice, setNotice] = useState("");

  const commit = useCallback((next: ReviewStore) => {
    latest.current = next;
    setStore(next);
    if (!saveReviewStore(storage.current, next))
      setNotice("复习进度保存失败，刷新后可能丢失。");
  }, []);

  // 加载
  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      try {
        storage.current = window.localStorage;
      } catch {}
      const loaded = loadReviewStore(storage.current);
      latest.current = loaded.store;
      setStore(loaded.store);
      if (loaded.issue) setNotice(loaded.issue);
      setReady(true);
    });
    return () => {
      active = false;
    };
  }, []);

  // 等来源存档全部加载后，按持久化事件账本幂等收录。
  useEffect(() => {
    if (!ready || !reading.ready || !listening.ready) return;
    const next = importReviewEvents(latest.current, [
      { module: "reading", sessions: reading.store.sessions },
      { module: "listening", sessions: listening.store.sessions },
    ], new Date().toISOString());
    if (next !== latest.current) commit(next);
  }, [ready, reading.ready, listening.ready, reading.store.sessions, listening.store.sessions, commit]);

  const awardXp = learning.awardXp;
  useEffect(() => {
    if (!ready || !learning.ready) return;
    for (const session of Object.values(store.sessions)) {
      if (session.applied && session.rewardXp > 0) awardXp(`review-session:${session.id}`, session.rewardXp);
    }
  }, [ready, learning.ready, store.sessions, awardXp]);

  const dueToday = useMemo(
    () => selectDailyReviews(store.items, today, "standard"),
    [store.items, today],
  );

  const startSession = useCallback(
    (items: ReviewItem[], mode: ReviewSession["mode"], source: ReviewSession["source"]) => {
      if (items.length === 0) return null;
      const s = createReviewSession(items, today, mode, source);
      commit({ ...latest.current, sessions: { ...latest.current.sessions, [s.id]: s } });
      return s.id;
    },
    [commit, today],
  );

  const answer = useCallback(
    (sessionId: string, itemId: string, correct: boolean) => {
      const s = latest.current.sessions[sessionId];
      if (!s || s.applied || s.itemIds[s.currentIndex] !== itemId || s.answers[itemId]) return;
      const answers: Record<string, { correct: boolean; result: ReviewResult }> = {
        ...s.answers,
        [itemId]: { correct, result: correct ? "review_correct" : "wrong" },
      };
      const updated: ReviewSession = {
        ...s,
        answers,
        currentIndex: Math.min(Object.keys(answers).length, s.itemIds.length),
      };
      commit({ ...latest.current, sessions: { ...latest.current.sessions, [sessionId]: updated } });
    },
    [commit],
  );

  const finish = useCallback(
    (sessionId: string) => {
      const done = completeReview(latest.current, sessionId, new Date().toISOString());
      if (done !== latest.current) {
        commit(done);
      }
    },
    [commit],
  );

  const toggleFavorite = useCallback(
    (itemId: string) => {
      const it = latest.current.items[itemId];
      if (!it) return;
      commit({
        ...latest.current,
        items: { ...latest.current.items, [itemId]: { ...it, favorite: !it.favorite } },
      });
    },
    [commit],
  );

  const remove = useCallback(
    (itemId: string) => {
      const it = latest.current.items[itemId];
      if (!it) return;
      commit({
        ...latest.current,
        items: { ...latest.current.items, [itemId]: { ...it, removed: true } },
      });
    },
    [commit],
  );

  const restore = useCallback(
    (itemId: string) => {
      const it = latest.current.items[itemId];
      if (!it) return;
      commit({
        ...latest.current,
        items: { ...latest.current.items, [itemId]: { ...it, removed: false } },
      });
    },
    [commit],
  );

  const stats = useMemo(() => {
    const all = Object.values(store.items).filter((i) => !i.removed);
    return {
      total: all.length,
      due: getDueReviews(store.items, today).length,
      unmastered: all.filter((i) => i.masteryStatus === "weak").length,
      mastered: all.filter((i) => i.masteryStatus === "mastered").length,
      favorite: all.filter((i) => i.favorite).length,
    };
  }, [store.items, today]);

  return {
    ready,
    notice,
    store,
    dueToday,
    stats,
    startSession,
    answer,
    finish,
    toggleFavorite,
    remove,
    restore,
    selectManual: (filter: "unmastered" | "favorite" | "due") =>
      selectManualReviews(store.items, filter, today),
  };
}

export function ReviewProvider({ children }: { children: React.ReactNode }) {
  return (
    <Context.Provider value={useReviewState()}>{children}</Context.Provider>
  );
}
export function useReview() {
  const v = useContext(Context);
  if (!v) throw new Error("ReviewProvider required");
  return v;
}
