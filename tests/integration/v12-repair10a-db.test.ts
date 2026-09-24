import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "../../src/lib/db/prisma";
import { applyGuestMigration } from "../../src/lib/sync/migration-server";
import type { SyncMutationInput } from "../../src/lib/sync/server";

test("PostgreSQL guest migration rolls back, verifies and deduplicates retries", async () => {
  const id = randomUUID();
  const migrationId = `repair10a-${id}`;
  const now = new Date().toISOString();
  const mutations: SyncMutationInput[] = [
    { mutationId: `${id}:profile`, entityType: "profile", entityId: "me", operation: "upsert", payload: { targetScore: 600 } },
    { mutationId: `${id}:preferences`, entityType: "preferences", entityId: "me", operation: "upsert", payload: { payload: { intensity: "standard" } } },
    { mutationId: `${id}:settings`, entityType: "settings", entityId: "me", operation: "upsert", payload: { payload: { feedback: { soundEnabled: true } } } },
    { mutationId: `${id}:xp`, entityType: "xpEvent", entityId: `${id}:xp`, operation: "upsert", payload: { eventId: `${id}:xp`, source: "reading", sourceId: `${id}:session`, amount: 15, earnedAt: now } },
    { mutationId: `${id}:session`, entityType: "session", entityId: `${id}:session`, operation: "upsert", payload: { module: "reading", activityId: "article", status: "completed", startedAt: now, completedAt: now, payload: { schemaVersion: 1 } } },
    { mutationId: `${id}:word`, entityType: "wordbook", entityId: `${id}:word`, operation: "upsert", payload: { addedAt: now, version: 1 } },
    { mutationId: `${id}:review`, entityType: "reviewItem", entityId: `${id}:review`, operation: "upsert", payload: { sourceModule: "reading", activityId: "article", questionId: "q1", status: "active", mastery: "learning", version: 1, payload: {} } },
    { mutationId: `${id}:plan`, entityType: "dailyPlan", entityId: "2026-09-24", operation: "upsert", payload: { completedTaskIds: ["task-1"] } },
    { mutationId: `${id}:translation`, entityType: "translationHistory", entityId: `${id}:translation`, operation: "upsert", payload: { promptId: "translation", answer: "answer", createdAt: now } },
    { mutationId: `${id}:writing`, entityType: "writingHistory", entityId: `${id}:writing`, operation: "upsert", payload: { promptId: "writing", answer: "answer", createdAt: now } },
  ];
  const user = await prisma.user.create({ data: { email: `repair10a-${id}@example.invalid`, passwordHash: "test-only" } });
  try {
    await assert.rejects(applyGuestMigration(user.id, migrationId, mutations, { failAfter: 5 }), /injected migration failure/);
    assert.equal(await prisma.xpEvent.count({ where: { userId: user.id } }), 0);
    assert.equal(await prisma.learningSession.count({ where: { userId: user.id } }), 0);
    assert.equal(await prisma.syncMutation.count({ where: { userId: user.id } }), 0);
    assert.equal(await prisma.migrationRecord.count({ where: { userId: user.id } }), 0);
    const first = await applyGuestMigration(user.id, migrationId, mutations);
    const second = await applyGuestMigration(user.id, migrationId, mutations);
    assert.equal(first.verified, true);
    assert.equal(first.alreadyCompleted, false);
    assert.equal(second.alreadyCompleted, true);
    assert.equal(await prisma.xpEvent.count({ where: { userId: user.id } }), 1);
    assert.equal(await prisma.learningSession.count({ where: { userId: user.id } }), 1);
    assert.equal(await prisma.wordbookEntry.count({ where: { userId: user.id } }), 1);
    assert.equal(await prisma.reviewItem.count({ where: { userId: user.id } }), 1);
    assert.equal(await prisma.dailyPlanState.count({ where: { userId: user.id } }), 1);
    assert.equal(await prisma.translationHistory.count({ where: { userId: user.id } }), 1);
    assert.equal(await prisma.writingHistory.count({ where: { userId: user.id } }), 1);
    assert.equal(await prisma.migrationRecord.count({ where: { userId: user.id, status: "completed" } }), 1);
  } finally {
    await prisma.user.delete({ where: { id: user.id } });
    await prisma.$disconnect();
  }
});
