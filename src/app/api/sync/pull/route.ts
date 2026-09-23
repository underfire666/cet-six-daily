import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const userId = session.user.id;

  const [profile, preferences, settings, xpEvents, sessions, wordbook, reviewItems, dailyPlans] =
    await Promise.all([
      prisma.profile.findUnique({ where: { userId } }),
      prisma.studyPreferences.findUnique({ where: { userId } }),
      prisma.userSettings.findUnique({ where: { userId } }),
      prisma.xpEvent.findMany({ where: { userId }, orderBy: { earnedAt: "asc" } }),
      prisma.learningSession.findMany({ where: { userId }, orderBy: { startedAt: "asc" } }),
      prisma.wordbookEntry.findMany({ where: { userId } }),
      prisma.reviewItem.findMany({ where: { userId } }),
      prisma.dailyPlanState.findMany({ where: { userId } }),
    ]);

  return NextResponse.json({
    profile,
    preferences,
    settings,
    xpEvents,
    sessions,
    wordbook,
    reviewItems,
    dailyPlans,
    pulledAt: new Date().toISOString(),
  });
}
