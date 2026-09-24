import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { applyMutationInTx, validateMutation, type SyncMutationInput } from "./server";

export interface GuestMigrationSummary {
  verified: true;
  migrationId: string;
  mutationCount: number;
  counts: Record<string, number>;
  alreadyCompleted: boolean;
}

/** Small port keeps the transaction policy testable without a live database. */
export interface GuestMigrationPort {
  completed(userId: string, migrationId: string): Promise<GuestMigrationSummary | null>;
  hasMutation(userId: string, mutationId: string): Promise<boolean>;
  apply(userId: string, mutation: SyncMutationInput): Promise<void>;
  record(userId: string, mutation: SyncMutationInput): Promise<void>;
  verify(userId: string, mutation: SyncMutationInput): Promise<boolean>;
  markCompleted(userId: string, migrationId: string, summary: GuestMigrationSummary): Promise<void>;
}

export function testFailureInjectionAllowed(env: Partial<Record<"NODE_ENV" | "CET_SYNC_E2E_TEST_FAILURE", string>> = process.env): boolean {
  return env.NODE_ENV === "test" || (env.NODE_ENV !== "production" && env.CET_SYNC_E2E_TEST_FAILURE === "1");
}

export async function runGuestMigrationTransaction(
  port: GuestMigrationPort,
  userId: string,
  migrationId: string,
  mutations: SyncMutationInput[],
  options: { failAfter?: number } = {},
): Promise<GuestMigrationSummary> {
  if (!userId || !migrationId || !Array.isArray(mutations) || mutations.length === 0 || mutations.length > 1000) throw new Error("invalid migration request");
  for (const mutation of mutations) {
    if (mutation.entityType === "migrationRecord") throw new Error("migration record is server owned");
    const issue = validateMutation(mutation);
    if (issue) throw new Error(issue);
  }
  const already = await port.completed(userId, migrationId);
  if (already) return { ...already, alreadyCompleted: true };
  const counts: Record<string, number> = {};
  for (const [index, mutation] of mutations.entries()) {
    if (!(await port.hasMutation(userId, mutation.mutationId))) {
      await port.apply(userId, mutation);
      await port.record(userId, mutation);
    }
    counts[mutation.entityType] = (counts[mutation.entityType] ?? 0) + 1;
    if (options.failAfter === index + 1) throw new Error("injected migration failure");
  }
  for (const mutation of mutations) {
    if (!(await port.hasMutation(userId, mutation.mutationId)) || !(await port.verify(userId, mutation))) {
      throw new Error(`migration verification failed: ${mutation.entityType}`);
    }
  }
  const summary: GuestMigrationSummary = {
    verified: true,
    migrationId,
    mutationCount: mutations.length,
    counts,
    alreadyCompleted: false,
  };
  await port.markCompleted(userId, migrationId, summary);
  return summary;
}

async function verifyEntity(tx: Prisma.TransactionClient, userId: string, mutation: SyncMutationInput): Promise<boolean> {
  const id = mutation.entityId;
  const p = mutation.payload;
  switch (mutation.entityType) {
    case "profile": {
      const row = await tx.profile.findUnique({ where: { userId }, select: { targetScore: true } });
      return Boolean(row && (p.targetScore == null || row.targetScore === Number(p.targetScore)));
    }
    case "preferences": return Boolean(await tx.studyPreferences.findUnique({ where: { userId }, select: { id: true } }));
    case "settings": return Boolean(await tx.userSettings.findUnique({ where: { userId }, select: { id: true } }));
    case "xpEvent": {
      const row = await tx.xpEvent.findUnique({ where: { userId_eventId: { userId, eventId: String(p.eventId ?? id) } }, select: { amount: true } });
      return Boolean(row && row.amount === Number(p.amount));
    }
    case "session": {
      const row = await tx.learningSession.findUnique({ where: { userId_id: { userId, id } }, select: { status: true, completedAt: true } });
      return Boolean(row && row.status === String(p.status ?? "completed") && (!p.completedAt || row.completedAt?.getTime() === new Date(String(p.completedAt)).getTime()));
    }
    case "wordbook": {
      const row = await tx.wordbookEntry.findUnique({ where: { userId_wordId: { userId, wordId: id } }, select: { removedAt: true, version: true } });
      return Boolean(row && row.version >= Number(p.version ?? 1) && (row.version > Number(p.version ?? 1) || Boolean(row.removedAt) === (mutation.operation === "remove")));
    }
    case "reviewItem": {
      const row = await tx.reviewItem.findUnique({ where: { userId_reviewItemId: { userId, reviewItemId: id } }, select: { status: true, version: true } });
      return Boolean(row && row.version >= Number(p.version ?? 1) && (row.version > Number(p.version ?? 1) || row.status === String(p.status ?? "active")));
    }
    case "dailyPlan": {
      const row = await tx.dailyPlanState.findUnique({ where: { userId_planDate: { userId, planDate: id } }, select: { payload: true } });
      if (!row) return false;
      const incoming = Array.isArray(p.completedTaskIds) ? p.completedTaskIds as string[] : [];
      const saved = (row.payload as Record<string, unknown>).completedTaskIds;
      return incoming.every((taskId) => Array.isArray(saved) && saved.includes(taskId));
    }
    case "translationHistory": return Boolean(await tx.translationHistory.findUnique({ where: { userId_itemId: { userId, itemId: id } }, select: { id: true } }));
    case "writingHistory": return Boolean(await tx.writingHistory.findUnique({ where: { userId_itemId: { userId, itemId: id } }, select: { id: true } }));
    case "migrationRecord": return false;
  }
}

function prismaPort(tx: Prisma.TransactionClient): GuestMigrationPort {
  return {
    async completed(userId, migrationId) {
      const row = await tx.migrationRecord.findUnique({ where: { userId_migrationId: { userId, migrationId } } });
      return row?.status === "completed" ? (row.summary as unknown as GuestMigrationSummary) : null;
    },
    async hasMutation(userId, mutationId) {
      return Boolean(await tx.syncMutation.findUnique({ where: { userId_mutationId: { userId, mutationId } }, select: { id: true } }));
    },
    async apply(userId, mutation) { await applyMutationInTx(tx, userId, mutation); },
    async record(userId, mutation) {
      await tx.syncMutation.create({ data: {
        userId,
        mutationId: mutation.mutationId,
        entityType: mutation.entityType,
        entityId: mutation.entityId,
        operation: mutation.operation,
        payload: mutation.payload as Prisma.InputJsonValue,
        status: "applied",
      } });
    },
    verify: (userId, mutation) => verifyEntity(tx, userId, mutation),
    async markCompleted(userId, migrationId, summary) {
      await tx.migrationRecord.create({ data: { userId, migrationId, summary: summary as unknown as Prisma.InputJsonValue, status: "completed" } });
    },
  };
}

export async function applyGuestMigration(
  userId: string,
  migrationId: string,
  mutations: SyncMutationInput[],
  options: { failAfter?: number } = {},
): Promise<GuestMigrationSummary> {
  try {
    return await prisma.$transaction(
      (tx) => runGuestMigrationTransaction(prismaPort(tx), userId, migrationId, mutations, options),
      { maxWait: 5000, timeout: 20000 },
    );
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const row = await prisma.migrationRecord.findUnique({ where: { userId_migrationId: { userId, migrationId } } });
      if (row?.status === "completed") return { ...(row.summary as unknown as GuestMigrationSummary), alreadyCompleted: true };
    }
    throw error;
  }
}
