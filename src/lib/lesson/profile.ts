import { addDays } from "@/lib/dates";
import { getLesson, mockUser } from "@/data/mock";
import { mockLesson } from "@/data/mockLesson";
import type { LessonSession, StudyProfile } from "@/types/session";
import type { Lesson } from "@/types/study";
import { firstSubmissionAccuracy } from "./session";

export const createProfile = (today: string): StudyProfile => ({
  schemaVersion: 1,
  anchorDate: today,
  completedLessons: {},
  rewardsByDay: {},
  bonusXpEvents: {},
});
export function streakFor(profile: StudyProfile, today: string) {
  const days = new Set([
    ...Array.from({ length: 7 }, (_, i) => addDays(profile.anchorDate, -i - 1)),
    ...Object.keys(profile.rewardsByDay),
  ]);
  let cursor = days.has(today) ? today : addDays(today, -1);
  let count = 0;
  while (days.has(cursor)) {
    count++;
    cursor = addDays(cursor, -1);
  }
  return count;
}
export function userFor(profile: StudyProfile, today: string) {
  const total =
    mockUser.xp +
    Object.values(profile.rewardsByDay).reduce((n, reward) => n + reward.xp, 0) +
    Object.values(profile.bonusXpEvents ?? {}).reduce((n, xp) => n + xp, 0);
  return {
    ...mockUser,
    streak: streakFor(profile, today),
    xp: total % mockUser.nextLevelXp,
    level: mockUser.level + Math.floor(total / mockUser.nextLevelXp),
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
