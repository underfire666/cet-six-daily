"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { addDays } from "@/lib/dates";
import type { DailyPlanStore, StudyPreferences } from "@/types/dailyPlan";
import type { Lesson } from "@/types/study";
import { emptyDailyPlanStore, loadDailyPlanStore, saveDailyPlanStore } from "@/lib/dailyPlan/storage";
import { generatePlan, planStatus } from "@/lib/dailyPlan/generator";
import { applyPreferences } from "@/lib/dailyPlan/preferences";
import { rescheduleMissedTasks } from "@/lib/dailyPlan/reschedule";
import { useVocabulary } from "@/components/vocabulary/VocabularyProvider";
import { useReading } from "@/components/reading/ReadingProvider";
import { useListening } from "@/components/listening/ListeningProvider";
import { useTranslation } from "@/components/translation/TranslationProvider";
import { useWriting } from "@/components/writing/WritingProvider";
import { useLearning } from "@/components/LearningProvider";
import { useToday } from "@/components/StudyProvider";
import { getScopedStorage } from "@/lib/storage/scoped";
import { subscribeRemoteHydrate } from "@/lib/storage/hydration-events";
import { enqueueDailyPlan, enqueuePreferences } from "@/lib/sync/adapters";

const Context = createContext<ReturnType<typeof useDailyPlanState> | null>(null);
function useDailyPlanState() {
  const today = useToday();
  const learning = useLearning();
  const vocab = useVocabulary();
  const reading = useReading();
  const listening = useListening();
  const translation = useTranslation();
  const writing = useWriting();
  const [store, setStore] = useState<DailyPlanStore>(emptyDailyPlanStore);
  const latest = useRef(store);
  const storage = useRef<Storage | undefined>(undefined);
  const skipDerivedEnqueue = useRef(false);
  const remoteCompletionDates = useRef(new Set<string>());
  const [loaded, setLoaded] = useState(false);
  const [notice, setNotice] = useState("");
  const ready = loaded && learning.ready && vocab.ready && reading.ready && listening.ready && translation.ready && writing.ready;

  const commit = useCallback((next: DailyPlanStore) => {
    latest.current = next;
    setStore(next);
    const saved = saveDailyPlanStore(storage.current, next);
    setNotice(saved ? "" : "浏览器暂时无法保存学习计划，刷新后可能丢失。");
    return saved;
  }, []);
  useEffect(() => subscribeRemoteHydrate(["dailyPlan", "study", "vocabulary", "reading", "listening", "translation", "writing"], () => {
    skipDerivedEnqueue.current = true;
    remoteCompletionDates.current.add(today);
    const loaded = loadDailyPlanStore(storage.current);
    latest.current = loaded.store;
    setStore(loaded.store);
    if (loaded.issue) setNotice(loaded.issue);
  }), [today]);
  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      try { storage.current = getScopedStorage() as Storage | undefined; } catch {}
      const result = loadDailyPlanStore(storage.current);
      latest.current = result.store;
      setStore(result.store);
      if (result.issue) setNotice(result.issue);
      setLoaded(true);
    });
    return () => { active = false; };
  }, []);

  // 按计划日期读取专项记录，额外练习不占每日计划进度。
  const getCompletion = useCallback((date: string) => {
    const v = vocab.store.daily[date], r = reading.store.daily[date], l = listening.store.daily[date];
    const t = translation.store.daily[date], w = writing.store.daily[date];
    const progress = (done: number, total: number) => ({ done, total, completed: total > 0 && done >= total });
    return {
      vocabulary: progress(v?.completedWordIds.length ?? 0, v?.wordIds.length ?? 20),
      reading: progress(r?.completedArticleIds.length ?? 0, r?.articleIds.length ?? 3),
      listening: progress(l?.completedMaterialIds.length ?? 0, l?.materialIds.length ?? 3),
      translation: progress(t?.completedTaskIds.length ?? 0, t?.taskIds.length ?? 1),
      writing: progress(w?.completedTaskIds.length ?? 0, w?.taskIds.length ?? 1),
    };
  }, [vocab.store.daily, reading.store.daily, listening.store.daily, translation.store.daily, writing.store.daily]);
  const completion = useMemo(() => getCompletion(today), [getCompletion, today]);

  useEffect(() => {
    if (!ready) return;
    const fromRemote = skipDerivedEnqueue.current;
    skipDerivedEnqueue.current = false;
    let next = latest.current;
    const plans = { ...next.plans };
    if (!plans[today]) plans[today] = generatePlan(today, next.preferences.examDate, next.preferences);
    for (const [date, plan] of Object.entries(plans)) {
      if (date > today) continue;
      const status = planStatus(plan, getCompletion(date));
      if (status !== plan.status && !(plan.status === "adjusted" && status !== "completed")) plans[date] = { ...plan, status };
    }
    next = { ...next, plans: rescheduleMissedTasks({ plans, today, examDate: next.preferences.examDate, pref: next.preferences, isPlanCompleted: (_, plan) => plan.status === "completed" }) };
    if (JSON.stringify(next) !== JSON.stringify(latest.current)) {
      if (!fromRemote && next.plans[today]?.status === "completed") remoteCompletionDates.current.delete(today);
      commit(next);
      // Enqueue dailyPlan state for sync
      if (!fromRemote) {
        for (const [date, plan] of Object.entries(next.plans)) {
          if (plan.status === "completed") {
            enqueueDailyPlan({ planDate: date, completedTaskIds: plan.tasks.filter(t => !t.removed).map(t => t.id), plan });
          }
        }
      }
    }
  }, [ready, today, getCompletion, commit]);

  const awardXp = learning.awardXp;
  useEffect(() => {
    if (!ready || store.plans[today]?.status !== "completed" || remoteCompletionDates.current.has(today)) return;
    const key = `daily-plan-complete:${today}`;
    awardXp(key, 10);
    if (latest.current.completionLedger[key] === undefined) commit({ ...latest.current, completionLedger: { ...latest.current.completionLedger, [key]: 10 } });
  }, [ready, today, store.plans, awardXp, commit]);

  const updatePreferences = useCallback((pref: StudyPreferences, syncFuture: boolean) => {
    const next = applyPreferences(latest.current, today, pref, syncFuture, getCompletion(today));
    const saved = commit(next);
    enqueuePreferences(pref as unknown as Record<string, unknown>);
    return saved;
  }, [commit, today, getCompletion]);
  const getPlan = useCallback((date: string) => store.plans[date] ?? (date >= today ? generatePlan(date, store.preferences.examDate, store.preferences) : undefined), [store.plans, store.preferences, today]);
  const getLesson = (date: string): Lesson => {
    const plan = getPlan(date);
    if (!plan) return learning.getLesson(date);
    const status = date > today ? "locked" : planStatus(plan, getCompletion(date)) === "completed" ? "completed" : date === today ? "today" : plan.adjusted ? "adjusted" : "available";
    return { date, minutes: plan.estimatedMinutes, modules: [...new Set(plan.tasks.filter(t => !t.removed).map(t => t.module))], status, inProgress: plan.status === "in_progress" };
  };
  return {
    ready, notice, store, completion, getCompletion, getPlan, getLesson,
    lessonHref: (date: string) => getPlan(date) ? `/plan/${date}` : `/lesson/${date}`,
    todayPlan: store.plans[today],
    futurePlans: Array.from({ length: 7 }, (_, i) => { const date = addDays(today, i + 1); return { date, plan: getPlan(date)! }; }),
    updatePreferences, preferences: store.preferences,
  };
}
export function DailyPlanProvider({ children }: { children: React.ReactNode }) {
  return <Context.Provider value={useDailyPlanState()}>{children}</Context.Provider>;
}
export function useDailyPlan() {
  const value = useContext(Context);
  if (!value) throw new Error("DailyPlanProvider required");
  return value;
}
