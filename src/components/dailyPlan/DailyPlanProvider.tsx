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
import { addDays } from "@/lib/dates";
import type {
  DailyPlan,
  PlanModule,
  StudyPreferences,
} from "@/types/dailyPlan";
import {
  emptyDailyPlanStore,
  loadDailyPlanStore,
  saveDailyPlanStore,
} from "@/lib/dailyPlan/storage";
import { generatePlan, planStatus } from "@/lib/dailyPlan/generator";
import { rescheduleMissedTasks } from "@/lib/dailyPlan/reschedule";
import { useVocabulary } from "@/components/vocabulary/VocabularyProvider";
import { useReading } from "@/components/reading/ReadingProvider";
import { useListening } from "@/components/listening/ListeningProvider";
import { useTranslation } from "@/components/translation/TranslationProvider";
import { useWriting } from "@/components/writing/WritingProvider";
import { useLearning } from "@/components/LearningProvider";
import { useToday } from "@/components/StudyProvider";
import type { DailyPlanStore } from "@/types/dailyPlan";

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
  const [ready, setReady] = useState(false);
  const [notice, setNotice] = useState("");

  const commit = useCallback(
    (next: DailyPlanStore) => {
      latest.current = next;
      setStore(next);
      if (!saveDailyPlanStore(storage.current, next))
        setNotice("浏览器暂时无法保存学习计划，刷新后可能丢失。");
    },
    [],
  );

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      try {
        storage.current = window.localStorage;
      } catch {}
      const loaded = loadDailyPlanStore(storage.current);
      latest.current = loaded.store;
      setStore(loaded.store);
      if (loaded.issue) setNotice(loaded.issue);
      setReady(true);
    });
    return () => {
      active = false;
    };
  }, []);

  // Completion snapshot：从各专项 Provider 读今日完成
  const completion = useMemo(() => {
    const modules: Record<
      PlanModule,
      { completed: boolean; done: number; total: number }
    > = {
      vocabulary: {
        completed: vocab.dailyComplete,
        done: vocab.progress.completedWordIds.length,
        total: vocab.progress.wordIds.length,
      },
      reading: {
        completed: reading.dailyComplete,
        done: reading.progress.completedArticleIds.length,
        total: reading.progress.articleIds.length,
      },
      listening: {
        completed: listening.dailyComplete,
        done: listening.progress.completedMaterialIds.length,
        total: listening.progress.materialIds.length,
      },
      translation: {
        completed: translation.dailyComplete,
        done: translation.progress.completedTaskIds.length,
        total: translation.progress.taskIds.length,
      },
      writing: {
        completed: writing.dailyComplete,
        done: writing.progress.completedTaskIds.length,
        total: writing.progress.taskIds.length,
      },
    };
    return modules;
  }, [
    vocab.dailyComplete,
    vocab.progress,
    reading.dailyComplete,
    reading.progress,
    listening.dailyComplete,
    listening.progress,
    translation.dailyComplete,
    translation.progress,
    writing.dailyComplete,
    writing.progress,
  ]);

  // 确保今日 plan 存在（不存在则生成；同时跑 reschedule）
  useEffect(() => {
    if (!ready) return;
    const pref = latest.current.preferences;
    let next = latest.current;

    // 1. 跑 reschedule（只对未完成的历史 plan）
    const rescheduled = rescheduleMissedTasks({
      plans: next.plans,
      today,
      examDate: pref.examDate,
      pref,
      isPlanCompleted: (date, plan) => {
        // 过去日期的 plan 是否完成：如果该日期有 completion snapshot（今天才有），否则按 plan.status
        if (date === today) {
          const status = planStatus(plan, {
            vocabulary: { completed: completion.vocabulary.completed },
            reading: { completed: completion.reading.completed },
            listening: { completed: completion.listening.completed },
            translation: { completed: completion.translation.completed },
            writing: { completed: completion.writing.completed },
          });
          return status === "completed";
        }
        return plan.status === "completed";
      },
    });
    next = { ...next, plans: rescheduled };

    // 2. 确保今日 plan 存在
    if (!next.plans[today]) {
      next = {
        ...next,
        plans: {
          ...next.plans,
          [today]: generatePlan(today, pref.examDate, pref),
        },
      };
    }

    // 3. 根据 completion 同步今日 plan.status
    const todayPlan = next.plans[today];
    if (todayPlan) {
      const synced = planStatus(todayPlan, {
        vocabulary: { completed: completion.vocabulary.completed },
        reading: { completed: completion.reading.completed },
        listening: { completed: completion.listening.completed },
        translation: { completed: completion.translation.completed },
        writing: { completed: completion.writing.completed },
      });
      if (todayPlan.status !== synced) {
        next = {
          ...next,
          plans: { ...next.plans, [today]: { ...todayPlan, status: synced } },
        };
      }
    }

    if (next !== latest.current) commit(next);
  }, [ready, today, completion, commit]);

  // Daily Completion Bonus：今日 plan 完成时发一次
  useEffect(() => {
    if (!ready) return;
    const plan = latest.current.plans[today];
    if (!plan || plan.status !== "completed") return;
    const ledgerKey = `daily-plan-complete:${today}`;
    if (latest.current.completionLedger[ledgerKey] !== undefined) return;
    learning.awardXp(ledgerKey, 10);
    commit({
      ...latest.current,
      completionLedger: {
        ...latest.current.completionLedger,
        [ledgerKey]: 10,
      },
    });
  }, [ready, today, completion, learning, commit]);

  // 未来 7 天预览
  const futurePlans = useMemo(() => {
    const out: { date: string; plan: DailyPlan }[] = [];
    for (let i = 1; i <= 7; i++) {
      const d = addDays(today, i);
      const existing = store.plans[d];
      out.push({ date: d, plan: existing ?? generatePlan(d, store.preferences.examDate, store.preferences) });
    }
    return out;
  }, [today, store.plans, store.preferences]);

  const updatePreferences = useCallback(
    (pref: StudyPreferences, regenerateFuture: boolean) => {
      let next: DailyPlanStore = {
        ...latest.current,
        preferences: pref,
      };
      // 重新生成未完成的未来 plan
      if (regenerateFuture) {
        const plans = { ...next.plans };
        for (const d of Object.keys(plans)) {
          if (d <= today) continue;
          if (plans[d].status === "completed") continue;
          plans[d] = generatePlan(d, pref.examDate, pref);
        }
        next = { ...next, plans };
      }
      commit(next);
    },
    [commit, today],
  );

  const editTodayTasks = useCallback(
    (tasks: DailyPlan["tasks"], syncFuture: boolean) => {
      const todayPlan = latest.current.plans[today];
      if (!todayPlan) return;
      let next: DailyPlanStore = {
        ...latest.current,
        plans: {
          ...latest.current.plans,
          [today]: { ...todayPlan, tasks, adjusted: true, adjustmentReason: "preference_change" },
        },
        customizedDates: [...new Set([...latest.current.customizedDates, today])],
      };
      if (syncFuture) {
        // 简化：重生成未来 7 天（不影响已 customized 的日期）
        const plans = { ...next.plans };
        for (let i = 1; i <= 7; i++) {
          const d = addDays(today, i);
          if (next.customizedDates.includes(d)) continue;
          if (plans[d] && plans[d].status === "completed") continue;
          plans[d] = generatePlan(d, next.preferences.examDate, next.preferences);
        }
        next = { ...next, plans };
      }
      commit(next);
    },
    [commit, today],
  );

  const getPlan = useCallback(
    (date: string): DailyPlan | undefined => {
      return store.plans[date];
    },
    [store.plans],
  );

  return {
    ready,
    notice,
    store,
    completion,
    todayPlan: store.plans[today],
    futurePlans,
    getPlan,
    updatePreferences,
    editTodayTasks,
    preferences: store.preferences,
  };
}

export function DailyPlanProvider({ children }: { children: React.ReactNode }) {
  return (
    <Context.Provider value={useDailyPlanState()}>{children}</Context.Provider>
  );
}
export function useDailyPlan() {
  const v = useContext(Context);
  if (!v) throw new Error("DailyPlanProvider required");
  return v;
}
