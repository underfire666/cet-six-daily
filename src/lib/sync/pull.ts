import { prisma } from "@/lib/db/prisma";

type PullReader = Pick<typeof prisma,
  | "profile"
  | "studyPreferences"
  | "userSettings"
  | "xpEvent"
  | "learningSession"
  | "wordbookEntry"
  | "reviewItem"
  | "dailyPlanState"
  | "translationHistory"
  | "writingHistory"
>;

/** The route passes its authenticated session user ID; no client ID is read. */
export async function readPullSnapshotForUser(userId: string, db: PullReader = prisma) {
  const [profile, preferences, settings, xpEvents, sessions, wordbook, reviewItems, dailyPlans, translationHistory, writingHistory] =
    await Promise.all([
      db.profile.findUnique({ where: { userId } }),
      db.studyPreferences.findUnique({ where: { userId } }),
      db.userSettings.findUnique({ where: { userId } }),
      db.xpEvent.findMany({ where: { userId }, orderBy: { earnedAt: "asc" } }),
      db.learningSession.findMany({ where: { userId }, orderBy: { startedAt: "asc" } }),
      db.wordbookEntry.findMany({ where: { userId } }),
      db.reviewItem.findMany({ where: { userId } }),
      db.dailyPlanState.findMany({ where: { userId } }),
      db.translationHistory.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
      db.writingHistory.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
    ]);
  return {
    profile,
    preferences,
    settings,
    xpEvents,
    sessions,
    wordbook,
    reviewItems,
    dailyPlans,
    translationHistory,
    writingHistory,
    pulledAt: new Date().toISOString(),
  };
}
