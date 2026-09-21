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
import { useVocabulary } from "@/components/vocabulary/VocabularyProvider";
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
  recordWrong,
  selectDailyReviews,
  selectManualReviews,
} from "@/lib/review/scheduler";
import { reviewDate } from "@/lib/review/config";

const Context = createContext<ReturnType<typeof useReviewState> | null>(null);

function useReviewState() {
  const today = useToday();
  const reading = useReading();
  const listening = useListening();
  const vocab = useVocabulary();
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

  // 自动收录：扫 reading/listening/vocabulary sessions 的 records
  useEffect(() => {
    if (!ready) return;
    let next = latest.current;
    let changed = false;
    const now = new Date().toISOString();
    const scan = (
      sessions: Record<string, { lesson?: { records?: Record<string, { initialResult?: string; retest?: { correct?: boolean }[]; initial?: { correct?: boolean }[] }> }; articleId?: string; materialId?: string; wordIds?: string[]; date?: string }>,
      module: "reading" | "listening" | "vocabulary",
    ) => {
      for (const s of Object.values(sessions)) {
        const records = s.lesson?.records;
        if (!records) continue;
        const activityId = s.articleId ?? s.materialId ?? "daily";
        for (const [qid, r] of Object.entries(records)) {
          if (qid.startsWith("vq:")) continue;
          const initialWrong = r.initialResult === "wrong";
          const retestWrong = (r.initial ?? []).some((a) => !a.correct);
          const secondWrong = (r.retest ?? []).some((a) => !a.correct);
          const secondCorrect = (r.retest ?? []).some((a) => a.correct);
          if (initialWrong && secondWrong) {
            next = { ...next, items: recordWrong(next.items, module, activityId, qid, now, "wrong") };
            changed = true;
          } else if (initialWrong && secondCorrect) {
            next = { ...next, items: recordWrong(next.items, module, activityId, qid, now, "second_try_correct") };
            changed = true;
          }
        }
      }
    };
    // reading/listening store.sessions
    scan((reading.store.sessions ?? {}) as never, "reading");
    scan((listening.store.sessions ?? {}) as never, "listening");
    // vocabulary 由 V4 自己管，不重复收录
    if (changed) commit(next);
  }, [ready, reading.store.sessions, listening.store.sessions, commit]);

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
      if (!s || s.applied) return;
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
        // 发 XP
        const session = done.sessions[sessionId];
        if (session?.applied && session.rewardXp > 0) {
          learning.awardXp(`review-session:${sessionId}`, session.rewardXp);
        }
        commit(done);
      }
    },
    [commit, learning],
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
      due: dueToday.length,
      unmastered: all.filter((i) => i.masteryStatus === "weak").length,
      mastered: all.filter((i) => i.masteryStatus === "mastered").length,
      favorite: all.filter((i) => i.favorite).length,
    };
  }, [store.items, dueToday]);

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
