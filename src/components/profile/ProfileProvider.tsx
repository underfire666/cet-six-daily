"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useToday } from "@/components/StudyProvider";
import { useLearning } from "@/components/LearningProvider";
import { useDailyPlan } from "@/components/dailyPlan/DailyPlanProvider";
import { useVocabulary } from "@/components/vocabulary/VocabularyProvider";
import { useReview } from "@/components/review/ReviewProvider";
import { useReading } from "@/components/reading/ReadingProvider";
import { useListening } from "@/components/listening/ListeningProvider";
import { loadProfile, saveProfile, type UserProfile, type TargetScore, type ReminderPrefs, type SoundPrefs } from "@/lib/profile/store";
import { computeStudyStats, summarizeObjective, type StudyStats } from "@/lib/profile/stats";

const Context = createContext<ReturnType<typeof useProfileState> | null>(null);

function useProfileState() {
  const today = useToday();
  const learning = useLearning();
  const plan = useDailyPlan();
  const vocab = useVocabulary();
  const review = useReview();
  const reading = useReading();
  const listening = useListening();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const storage = useRef<Storage | undefined>(undefined);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      try { storage.current = window.localStorage; } catch {}
      const loaded = loadProfile(storage.current);
      setProfile(loaded.profile);
    });
    return () => { active = false; };
  }, []);

  const update = useCallback((patch: Partial<UserProfile>) => {
    setProfile((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };
      saveProfile(storage.current, next);
      return next;
    });
  }, []);

  // examDate 修改：复用 V8 updatePreferences，同步未来计划
  const setExamDate = useCallback((date: string) => {
    plan.updatePreferences({ ...plan.preferences, examDate: date }, true);
  }, [plan]);

  const setTargetScore = useCallback((v: TargetScore) => update({ targetScore: v }), [update]);
  const setReminders = useCallback((r: Partial<ReminderPrefs>) => update({ reminders: { ...(profile?.reminders ?? { evening: true, miss: true, lastChance: true }), ...r } }), [profile, update]);
  const setSound = useCallback((s: Partial<SoundPrefs>) => update({ sound: { ...(profile?.sound ?? { answerSound: true, haptic: true, celebration: true }), ...s } }), [profile, update]);

  // 组装 stats
  const stats: StudyStats | null = useMemo(() => {
    if (!learning.ready || !review.ready) return null;
    // 客观题 records 合并
    const obj = { correct: 0, attempts: 0 };
    const scan = (sessions: Record<string, { lesson?: { records?: Record<string, { initialResult?: string; retest?: { correct?: boolean }[]; initial?: { correct?: boolean }[] }> } }>) => {
      for (const s of Object.values(sessions)) {
        const r = s.lesson?.records;
        if (!r) continue;
        const o = summarizeObjective(r as Record<string, { initialResult?: "correct" | "wrong" }>);
        obj.correct += o.correct;
        obj.attempts += o.attempts;
      }
    };
    scan((reading.store.sessions ?? {}) as never);
    scan((listening.store.sessions ?? {}) as never);

    // XP by day：用 rewardsByDay（V2 daily）+ review XP ledger
    const xpByDay: Record<string, number> = {};
    for (const [day, reward] of Object.entries(learning.profile.rewardsByDay)) {
      xpByDay[day] = (xpByDay[day] ?? 0) + reward.xp;
    }
    for (const [k, xp] of Object.entries(review.store.xpLedger)) {
      // key 格式 review:YYYY-MM-DD:itemId
      const day = k.slice(6, 16);
      xpByDay[day] = (xpByDay[day] ?? 0) + xp;
    }

    return computeStudyStats({
      completedDays: new Set(Object.keys(learning.profile.completedLessons)),
      totalXp: learning.user.xp,
      streak: learning.user.streak,
      level: learning.user.level,
      levelTitle: learning.user.title,
      objective: obj,
      wrongCount: Object.values(review.store.items).filter((i) => !i.removed).length,
      wordbookCount: vocab.wordbook.length,
      dueReviewCount: review.dueToday.length,
      xpByDay,
      today,
    });
  }, [learning.ready, learning.profile, learning.user, review.ready, review.store, review.dueToday, vocab.wordbook, reading.store.sessions, listening.store.sessions, today]);

  const examDate = plan.preferences.examDate;

  return {
    ready: !!profile && learning.ready,
    profile,
    stats,
    examDate,
    setExamDate,
    setTargetScore,
    setReminders,
    setSound,
    updatePlanPreferences: plan.updatePreferences,
    planPreferences: plan.preferences,
    examDaysLeft: useMemo(() => {
      if (!examDate) return null;
      const diff = Math.round((new Date(examDate + "T00:00:00+08:00").getTime() - new Date(today + "T00:00:00+08:00").getTime()) / 86400000);
      return diff;
    }, [examDate, today]),
  };
}

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  return <Context.Provider value={useProfileState()}>{children}</Context.Provider>;
}
export function useProfile() {
  const v = useContext(Context);
  if (!v) throw new Error("ProfileProvider required");
  return v;
}
