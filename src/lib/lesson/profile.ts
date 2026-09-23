import { addDays } from "@/lib/dates";
import { getLesson } from "@/data/mock";
import { mockLesson } from "@/data/mockLesson";
import type { LessonSession, StudyProfile } from "@/types/session";
import type { Lesson, User } from "@/types/study";
import { firstSubmissionAccuracy } from "./session";

export const createProfile = (today: string): StudyProfile => ({
  schemaVersion: 1,
  anchorDate: today,
  completedLessons: {},
  rewardsByDay: {},
  bonusXpEvents: {},
});

/** 等级阈值：真实 XP 累计达到该值升一级。新用户从 Lv.1 开始。 */
export const NEXT_LEVEL_XP = 1500;

/** 等级称号，按 level 索引（level 1 → 下标 0）。 */
export const LEVEL_TITLES = [
  "新手",
  "学习者",
  "进阶者",
  "勤奋者",
  "高阶学员",
  "六级达人",
];

/** 由真实累计 XP 推导 level / 当前级内 XP / 称号。 */
export function levelFor(totalXp: number): { level: number; xp: number; title: string } {
  const level = 1 + Math.floor(totalXp / NEXT_LEVEL_XP);
  return {
    level,
    xp: totalXp % NEXT_LEVEL_XP,
    title: LEVEL_TITLES[Math.min(level - 1, LEVEL_TITLES.length - 1)],
  };
}

/**
 * Streak：按真实完成日（rewardsByDay + 新版每日计划完成奖励）计算。
 * 完成"今日总关卡"才增加；漏 1 天保留（从昨天起算）；连续漏 2 天清零。
 */
export function streakFor(profile: StudyProfile, today: string) {
  const days = new Set(Object.keys(profile.rewardsByDay));
  for (const key of Object.keys(profile.bonusXpEvents ?? {})) {
    if (/^daily-plan-complete:\d{4}-\d{2}-\d{2}$/.test(key)) days.add(key.slice("daily-plan-complete:".length));
  }
  let cursor = days.has(today) ? today : addDays(today, -1);
  let count = 0;
  while (days.has(cursor)) {
    count++;
    cursor = addDays(cursor, -1);
  }
  return count;
}

/**
 * 全局用户状态：XP / Level / Streak 的唯一 Source of Truth。
 * 基线为 0（不再叠加 mockUser 的演示 XP/Level/Streak），
 * 只累计真实获得的奖励 XP 与 bonus XP。
 */
export function totalXpFor(profile: StudyProfile): number {
  return (
    Object.values(profile.rewardsByDay).reduce((n, reward) => n + reward.xp, 0) +
    Object.values(profile.bonusXpEvents ?? {}).reduce((n, xp) => n + xp, 0)
  );
}

export function userFor(profile: StudyProfile, today: string): User {
  const { level, xp, title } = levelFor(totalXpFor(profile));
  return {
    nickname: "",
    streak: streakFor(profile, today),
    xp,
    level,
    title,
    nextLevelXp: NEXT_LEVEL_XP,
  };
}
export function finishSession(
  profile: StudyProfile,
  session: LessonSession,
): { profile: StudyProfile; session: LessonSession } {
  if (session.phase !== "complete" || !session.completedDay || session.reward)
    return { profile, session };
  const seededComplete =
    session.date < profile.anchorDate &&
    getLesson(session.date, profile.anchorDate).status === "completed";
  const firstCompletion =
    session.mode === "daily" &&
    !seededComplete &&
    !profile.completedLessons[session.date];
  const xp =
    firstCompletion && !profile.rewardsByDay[session.completedDay] ? 45 : 0;
  const next = {
    ...profile,
    completedLessons: firstCompletion
      ? { ...profile.completedLessons, [session.date]: session.id }
      : profile.completedLessons,
    rewardsByDay: xp
      ? {
          ...profile.rewardsByDay,
          [session.completedDay]: { xp, sessionId: session.id },
        }
      : profile.rewardsByDay,
  };
  return {
    profile: next,
    session: {
      ...session,
      reward: {
        xp,
        streak: streakFor(next, session.completedDay),
        accuracy: firstSubmissionAccuracy(session, mockLesson),
      },
    },
  };
}
export function calendarLesson(
  date: string,
  today: string,
  profile: StudyProfile,
  sessions: Record<string, LessonSession>,
): Lesson {
  const active = sessions[`${date}:daily`];
  const base: Lesson = {
    date,
    minutes: mockLesson.minutes,
    modules: [...new Set(mockLesson.questions.map((q) => q.module))],
    status: "available",
  };
  if (date > today) return { ...base, status: "locked" };
  if (profile.completedLessons[date]) return { ...base, status: "completed" };
  if (active && active.phase !== "complete")
    return {
      ...base,
      status: date === today ? "today" : "available",
      inProgress: true,
    };
  if (date === today) return { ...base, status: "today" };
  if (date < profile.anchorDate) {
    const historical = getLesson(date, profile.anchorDate);
    return {
      ...base,
      status: historical.status,
      rescheduledTo: historical.rescheduledTo,
    };
  }
  return base;
}
