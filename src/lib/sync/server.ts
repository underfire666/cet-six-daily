// Server-side sync processor.
// All handlers take userId from server session; request body userId is ignored.
// Idempotency: every mutation carries mutationId; recorded in SyncMutation UNIQUE(userId, mutationId).

import { prisma } from "@/lib/db/prisma";
import { Prisma } from "@prisma/client";

export type MutationOp = "upsert" | "remove";

export interface SyncMutationInput {
  mutationId: string;
  entityType:
    | "profile"
    | "preferences"
    | "settings"
    | "xpEvent"
    | "session"
    | "wordbook"
    | "reviewItem"
    | "dailyPlan"
    | "translationHistory"
    | "writingHistory"
    | "migrationRecord";
  entityId: string;
  operation: MutationOp;
  payload: Record<string, unknown>;
}

const VALID_ENTITY = new Set([
  "profile",
  "preferences",
  "settings",
  "xpEvent",
  "session",
  "wordbook",
  "reviewItem",
  "dailyPlan",
  "translationHistory",
  "writingHistory",
  "migrationRecord",
]);

// XP source whitelist (must match local XP ledger sources in LearningProvider).
const VALID_XP_SOURCE = new Set([
  "daily_lesson",
  "vocabulary",
  "reading",
  "listening",
  "review",
  "translation",
  "writing",
  "achievement",
  "bonus",
]);
const MAX_XP_PER_EVENT = 200; // no single event should award more than this.

const VALID_REVIEW_STATUS = new Set(["active", "mastered", "removed"]);
const VALID_REVIEW_MASTERY = new Set(["new", "learning", "familiar", "mastered"]);

export function validateMutation(m: Partial<SyncMutationInput>): string | null {
  if (!m || typeof m !== "object") return "mutation missing";
  if (!m.mutationId || typeof m.mutationId !== "string") return "mutationId missing";
  if (!m.entityType || !VALID_ENTITY.has(m.entityType)) return `unknown entity ${String(m.entityType)}`;
  if (!m.entityId || typeof m.entityId !== "string") return "entityId missing";
  if (m.operation !== "upsert" && m.operation !== "remove") return "bad operation";
  if (!m.payload || typeof m.payload !== "object") return "payload missing";

  if (m.entityType === "xpEvent") {
    const src = String((m.payload as Record<string, unknown>).source ?? "");
    const amount = Number((m.payload as Record<string, unknown>).amount ?? 0);
    if (!VALID_XP_SOURCE.has(src)) return `invalid xp source: ${src}`;
    if (!Number.isFinite(amount) || amount <= 0 || amount > MAX_XP_PER_EVENT)
      return `xp amount out of range`;
  }
  if (m.entityType === "reviewItem") {
    const p = m.payload as Record<string, unknown>;
    if (p.status != null && !VALID_REVIEW_STATUS.has(String(p.status)))
      return `invalid review status: ${String(p.status)}`;
    if (p.mastery != null && !VALID_REVIEW_MASTERY.has(String(p.mastery)))
      return `invalid review mastery: ${String(p.mastery)}`;
  }
  return null;
}


export function mergeDailyPlan(
  local: Record<string, unknown> | null,
  incoming: Record<string, unknown>,
): Record<string, unknown> {
  const base = (local ?? {}) as Record<string, unknown>;
  const incomingCompleted = new Set(
    Array.isArray(incoming.completedTaskIds) ? (incoming.completedTaskIds as string[]) : [],
  );
  const mergedCompleted = new Set<string>(
    Array.isArray(base.completedTaskIds) ? (base.completedTaskIds as string[]) : [],
  );
  for (const id of incomingCompleted) mergedCompleted.add(id);
  return {
    ...base,
    ...incoming,
    completedTaskIds: Array.from(mergedCompleted),
  };
}

export async function applyPushBatch(userId: string, mutations: SyncMutationInput[]) {
  const applied: string[] = [];
  const skipped: string[] = [];
  for (const m of mutations) {
    try {
      await prisma.$transaction(async (tx) => {
        const seen = await tx.syncMutation.findUnique({
          where: { userId_mutationId: { userId, mutationId: m.mutationId } },
        });
        if (seen) {
          skipped.push(m.mutationId);
          return;
        }
        // applyMutation uses top-level prisma; re-implement inside tx for atomicity.
        await applyMutationInTx(tx, userId, m);
        await tx.syncMutation.create({
          data: {
            userId,
            mutationId: m.mutationId,
            entityType: m.entityType,
            entityId: m.entityId,
            operation: m.operation,
            payload: m.payload as object,
            status: "applied",
          },
        });
        applied.push(m.mutationId);
      });
    } catch (e) {
      // Concurrent duplicate: unique constraint on SyncMutation(userId, mutationId) fired.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        skipped.push(m.mutationId);
        continue;
      }
      throw e;
    }
  }
  return { applied, skipped };
}

async function applyMutationInTx(
  tx: Prisma.TransactionClient,
  userId: string,
  m: SyncMutationInput,
) {
  const p = m.payload as Record<string, unknown>;
  switch (m.entityType) {
    case "xpEvent":
      await tx.xpEvent.upsert({
        where: { userId_eventId: { userId, eventId: String(p.eventId ?? m.entityId) } },
        create: {
          userId,
          eventId: String(p.eventId ?? m.entityId),
          source: String(p.source),
          sourceId: String(p.sourceId ?? ""),
          amount: Number(p.amount),
          earnedAt: new Date(String(p.earnedAt ?? new Date().toISOString())),
        },
        update: {},
      });
      return;
    case "session":
      await tx.learningSession.upsert({
        where: { userId_id: { userId, id: m.entityId } },
        create: {
          id: m.entityId,
          userId,
          module: String(p.module ?? "vocabulary"),
          activityId: String(p.activityId ?? ""),
          planDate: (p.planDate as string) ?? null,
          startedAt: new Date(String(p.startedAt ?? new Date().toISOString())),
          completedAt: p.completedAt ? new Date(String(p.completedAt)) : null,
          durationSec: p.durationSec != null ? Number(p.durationSec) : null,
          status: String(p.status ?? "completed"),
          payload: (p.payload as object) ?? {},
          version: 1,
        },
        update: {
          status: String(p.status ?? "completed"),
          completedAt: p.completedAt ? new Date(String(p.completedAt)) : undefined,
          durationSec: p.durationSec != null ? Number(p.durationSec) : undefined,
          payload: (p.payload as object) ?? undefined,
        },
      });
      return;
    case "wordbook": {
      const removedAt = m.operation === "remove" ? new Date() : (p.removedAt ? new Date(String(p.removedAt)) : null);
      await tx.wordbookEntry.upsert({
        where: { userId_wordId: { userId, wordId: m.entityId } },
        create: {
          userId,
          wordId: m.entityId,
          source: (p.source as string) ?? null,
          removedAt,
          addedAt: new Date(String(p.addedAt ?? new Date().toISOString())),
        },
        update: {
          removedAt,
          source: (p.source as string) ?? undefined,
          version: { increment: 1 },
        },
      });
      return;
    }
    case "reviewItem": {
      const removedAt = m.operation === "remove" ? new Date() : (p.removedAt ? new Date(String(p.removedAt)) : null);
      const existing = await tx.reviewItem.findUnique({
        where: { userId_reviewItemId: { userId, reviewItemId: m.entityId } },
        select: { version: true },
      });
      const incomingVersion = Number(p.version ?? 1);
      if (existing && incomingVersion < existing.version) return;
      await tx.reviewItem.upsert({
        where: { userId_reviewItemId: { userId, reviewItemId: m.entityId } },
        create: {
          userId,
          reviewItemId: m.entityId,
          sourceModule: String(p.sourceModule ?? ""),
          activityId: String(p.activityId ?? ""),
          questionId: String(p.questionId ?? ""),
          status: String(p.status ?? "active"),
          mastery: (p.mastery as string) ?? null,
          dueDate: (p.dueDate as string) ?? null,
          priority: p.priority != null ? Number(p.priority) : null,
          removedAt,
          version: incomingVersion,
        },
        update: {
          status: String(p.status ?? "active"),
          mastery: (p.mastery as string) ?? null,
          dueDate: (p.dueDate as string) ?? undefined,
          priority: p.priority != null ? Number(p.priority) : undefined,
          removedAt,
          version: incomingVersion,
        },
      });
      return;
    }
    case "dailyPlan": {
      const existing = await tx.dailyPlanState.findUnique({
        where: { userId_planDate: { userId, planDate: m.entityId } },
      });
      const incoming = (p.payload as Record<string, unknown> | undefined) ?? p;
      const merged = mergeDailyPlan(
        (existing?.payload as Record<string, unknown> | null) ?? null,
        incoming,
      );
      await tx.dailyPlanState.upsert({
        where: { userId_planDate: { userId, planDate: m.entityId } },
        create: { userId, planDate: m.entityId, payload: merged as object, version: 1 },
        update: { payload: merged as object, version: { increment: 1 } },
      });
      return;
    }
    case "profile":
      await tx.profile.upsert({
        where: { userId },
        create: {
          userId,
          targetScore: p.targetScore != null ? Number(p.targetScore) : null,
          examDate: p.examDate ? new Date(String(p.examDate)) : null,
          reminders: (p.reminders as object) ?? undefined,
          sound: (p.sound as object) ?? undefined,
        },
        update: {
          targetScore: p.targetScore != null ? Number(p.targetScore) : undefined,
          examDate: p.examDate ? new Date(String(p.examDate)) : undefined,
          reminders: (p.reminders as object) ?? undefined,
          sound: (p.sound as object) ?? undefined,
        },
      });
      return;
    case "preferences":
      await tx.studyPreferences.upsert({
        where: { userId },
        create: { userId, payload: (p.payload as object) ?? p },
        update: { payload: (p.payload as object) ?? p },
      });
      return;
    case "settings":
      await tx.userSettings.upsert({
        where: { userId },
        create: { userId, payload: (p.payload as object) ?? p },
        update: { payload: (p.payload as object) ?? p },
      });
      return;
    case "translationHistory":
      await tx.translationHistory.upsert({
        where: { userId_itemId: { userId, itemId: m.entityId } },
        create: {
          userId,
          itemId: m.entityId,
          promptId: String(p.promptId ?? ""),
          answer: String(p.answer ?? ""),
          feedback: (p.feedback as object) ?? undefined,
        },
        update: {},
      });
      return;
    case "writingHistory":
      await tx.writingHistory.upsert({
        where: { userId_itemId: { userId, itemId: m.entityId } },
        create: {
          userId,
          itemId: m.entityId,
          promptId: String(p.promptId ?? ""),
          answer: String(p.answer ?? ""),
          feedback: (p.feedback as object) ?? undefined,
        },
        update: {},
      });
      return;
    case "migrationRecord":
      await tx.migrationRecord.upsert({
        where: { userId_migrationId: { userId, migrationId: m.entityId } },
        create: { userId, migrationId: m.entityId, summary: (p.summary as object) ?? p, status: "completed" },
        update: {},
      });
      return;
  }
}

