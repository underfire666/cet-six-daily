"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useToday } from "@/components/StudyProvider";
import { useLearning } from "@/components/LearningProvider";
import { useDailyPlan } from "@/components/dailyPlan/DailyPlanProvider";
import { useVocabulary } from "@/components/vocabulary/VocabularyProvider";
import { useReview } from "@/components/review/ReviewProvider";
import { useReading } from "@/components/reading/ReadingProvider";
import { useListening } from "@/components/listening/ListeningProvider";
import { useTranslation } from "@/components/translation/TranslationProvider";
import { useWriting } from "@/components/writing/WritingProvider";
import { loadProfile, saveProfile, type UserProfile, type TargetScore, type ReminderPrefs } from "@/lib/profile/store";
import { computeStudyStats, summarizeObjective, summarizeReviewAnswers, type CompletedSession, type ObjectiveRecord, type StudyStats } from "@/lib/profile/stats";
import { countdownText, todayInShanghai } from "@/lib/dates";
import { totalXpFor } from "@/lib/lesson/profile";

const Context = createContext<ReturnType<typeof useProfileState> | null>(null);

function useProfileState() {
  const today = useToday();
  const learning = useLearning();
  const plan = useDailyPlan();
  const vocab = useVocabulary();
  const review = useReview();
  const reading = useReading();
  const listening = useListening();
  const translation = useTranslation();
  const writing = useWriting();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const latestProfile = useRef<UserProfile | null>(null);
  const [notice, setNotice] = useState("");
  const storage = useRef<Storage | undefined>(undefined);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      try { storage.current = window.localStorage; } catch {}
      const loaded = loadProfile(storage.current);
      latestProfile.current = loaded.profile;
      setProfile(loaded.profile);
      if (loaded.issue) setNotice(loaded.issue);
    });
    return () => { active = false; };
  }, []);

  const update = useCallback((patch: Partial<UserProfile>) => {
    if (!latestProfile.current) return;
    const next = { ...latestProfile.current, ...patch, updatedAt: new Date().toISOString() };
    latestProfile.current = next;
    setProfile(next);
    setNotice(saveProfile(storage.current, next) ? "" : "偏好保存失败，刷新后可能丢失，请检查浏览器存储空间或权限。");
  }, []);

  // examDate 修改：复用 V8 updatePreferences，同步未来计划
  const setExamDate = useCallback((date: string) => {
    plan.updatePreferences({ ...plan.preferences, examDate: date }, true);
  }, [plan]);

  const setTargetScore = useCallback((v: TargetScore) => update({ targetScore: v }), [update]);
  const setReminders = useCallback((r: Partial<ReminderPrefs>) => update({ reminders: { ...(latestProfile.current?.reminders ?? { evening: true, miss: true, lastChance: true }), ...r } }), [update]);

  // 客观题 records 合并：词汇 + 阅读 + 听力 + 复习（翻译/写作不计入客观正确率）
  const objective = useMemo(() => {
    const obj = { correct: 0, attempts: 0 };
    const scan = (sessions: Record<string, { lesson?: { records?: Record<string, ObjectiveRecord> } }>) => {
      for (const s of Object.values(sessions)) {
        const r = s.lesson?.records;
        if (!r) continue;
        const o = summarizeObjective(r);
        obj.correct += o.correct;
        obj.attempts += o.attempts;
      }
    };
    for (const session of Object.values(learning.sessions)) {
      const result = summarizeObjective(session.records);
      obj.correct += result.correct;
      obj.attempts += result.attempts;
    }
    scan(vocab.store.sessions);
    scan(reading.store.sessions);
    scan(listening.store.sessions);
    // 复习：ReviewSession.answers 每次作答为明确 correct/incorrect
    for (const s of Object.values(review.store.sessions ?? {})) {
      const o = summarizeReviewAnswers(s.answers ?? {});
      obj.correct += o.correct;
      obj.attempts += o.attempts;
    }
    return obj;
  }, [learning.sessions, vocab.store.sessions, reading.store.sessions, listening.store.sessions, review.store.sessions]);

  // 已完成 session（真实 duration 来源）：V2 daily + 词汇 + 阅读 + 听力 + 翻译 + 写作 + 复习
  const completedSessions: CompletedSession[] = useMemo(() => {
    const out: CompletedSession[] = [];
    const dayOf = (iso?: string) => (iso ? todayInShanghai(new Date(iso)) : undefined);
    for (const s of Object.values(learning.sessions)) {
      if (s.phase === "complete") out.push({ startedAt: s.startedAt, completedAt: s.completedAt, day: dayOf(s.completedAt) });
    }
    for (const s of Object.values(vocab.store.sessions ?? {})) {
      if (s.completedAt) out.push({ startedAt: s.lesson?.startedAt, completedAt: s.completedAt, day: dayOf(s.completedAt), rewardXp: s.rewardXp });
    }
    for (const s of Object.values(reading.store.sessions ?? {})) {
      if (s.completedAt) out.push({ startedAt: s.startedAt, completedAt: s.completedAt, day: dayOf(s.completedAt), rewardXp: s.rewardXp });
    }
    for (const s of Object.values(listening.store.sessions ?? {})) {
      if (s.completedAt) out.push({ startedAt: s.startedAt, completedAt: s.completedAt, day: dayOf(s.completedAt), rewardXp: s.rewardXp });
    }
    for (const s of Object.values(translation.store.sessions ?? {})) {
      if (s.completedAt) out.push({ startedAt: s.startedAt, completedAt: s.completedAt, day: dayOf(s.completedAt), rewardXp: s.rewardXp });
    }
    for (const s of Object.values(writing.store.sessions ?? {})) {
      if (s.completedAt) out.push({ startedAt: s.startedAt, completedAt: s.completedAt, day: dayOf(s.completedAt), rewardXp: s.rewardXp });
    }
    for (const s of Object.values(review.store.sessions ?? {})) {
      if (s.completedAt) out.push({ startedAt: s.startedAt, completedAt: s.completedAt, day: dayOf(s.completedAt) });
    }
    return out;
  }, [learning.sessions, vocab.store.sessions, reading.store.sessions, listening.store.sessions, translation.store.sessions, writing.store.sessions, review.store.sessions]);

  const allReady = learning.ready && plan.ready && vocab.ready && review.ready && reading.ready && listening.ready && translation.ready && writing.ready;

  // 组装 stats
  const stats: StudyStats | null = useMemo(() => {
    if (!allReady) return null;
    // XP by day：用 rewardsByDay（V2 daily）+ review XP ledger
    const xpByDay: Record<string, number> = {};
    for (const [day, reward] of Object.entries(learning.profile.rewardsByDay)) {
      xpByDay[day] = (xpByDay[day] ?? 0) + reward.xp;
    }
    for (const [k, xp] of Object.entries(review.store.xpLedger)) {
      // key 格式 review:YYYY-MM-DD:itemId
      const day = k.slice(7, 17);
      xpByDay[day] = (xpByDay[day] ?? 0) + xp;
    }

    for (const [key, xp] of Object.entries(plan.store.completionLedger)) {
      const day = key.slice("daily-plan-complete:".length);
      xpByDay[day] = (xpByDay[day] ?? 0) + xp;
    }

    return computeStudyStats({
      completedDays: new Set([...Object.keys(learning.profile.rewardsByDay), ...Object.keys(plan.store.completionLedger).map(k => k.slice("daily-plan-complete:".length))]),
      totalXp: totalXpFor(learning.profile),
      streak: learning.user.streak,
      level: learning.user.level,
      levelTitle: learning.user.title,
      objective,
      wrongCount: Object.values(review.store.items).filter((i) => !i.removed).length,
      wordbookCount: vocab.wordbook.length,
      dueReviewCount: review.stats.due,
      xpByDay,
      completedSessions,
      today,
    });
  }, [allReady, plan.store.completionLedger, learning.profile, learning.user, review.store, review.stats.due, vocab.wordbook, objective, completedSessions, today]);

  const examDate = plan.preferences.examDate;

  return {
    ready: !!profile && allReady,
    profile,
    notice,
    stats,
    examDate,
    setExamDate,
    setTargetScore,
    setReminders,
    updatePlanPreferences: plan.updatePreferences,
    planPreferences: plan.preferences,
    // Sound/Haptic/Celebration：单一 Source of Truth = 现有 FeedbackSettings（learning.settings）
    settings: learning.settings,
    setSettings: learning.setSettings,
    examDaysLeft: useMemo(() => {
      if (!examDate) return null;
      const diff = Math.round((new Date(examDate + "T00:00:00+08:00").getTime() - new Date(today + "T00:00:00+08:00").getTime()) / 86400000);
      return diff;
    }, [examDate, today]),
    examText: useMemo(() => {
      if (!examDate) return null;
      return countdownText(today, examDate);
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
