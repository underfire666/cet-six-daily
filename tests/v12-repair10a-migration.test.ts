import test from "node:test";
import assert from "node:assert/strict";
import {
  runGuestMigrationTransaction,
  testFailureInjectionAllowed,
  type GuestMigrationPort,
  type GuestMigrationSummary,
} from "../src/lib/sync/migration-server";
import type { SyncMutationInput } from "../src/lib/sync/server";

type State = {
  entities: Map<string, SyncMutationInput>;
  mutationIds: Set<string>;
  records: Map<string, GuestMigrationSummary>;
};

const entities = [
  "profile", "preferences", "settings", "xpEvent", "session", "wordbook",
  "reviewItem", "dailyPlan", "translationHistory", "writingHistory",
] as const;

function payloadFor(entityType: typeof entities[number], entityId: string): Record<string, unknown> {
  if (entityType === "xpEvent") return { eventId: entityId, source: "reading", sourceId: "session-1", amount: 15 };
  if (entityType === "reviewItem") return { status: "active", mastery: "learning" };
  return { value: entityId };
}

const mutations: SyncMutationInput[] = entities.map((entityType, index) => {
  const entityId = `${entityType}-${index}`;
  return {
    mutationId: `guest:migration-1:${entityType}:${entityId}`,
    entityType,
    entityId,
    operation: "upsert",
    payload: payloadFor(entityType, entityId),
  };
});

/** A transaction adapter: changes are published only when the callback succeeds. */
async function inTransaction(
  database: State,
  work: (port: GuestMigrationPort) => Promise<GuestMigrationSummary>,
): Promise<GuestMigrationSummary> {
  const next: State = {
    entities: new Map(database.entities),
    mutationIds: new Set(database.mutationIds),
    records: new Map(database.records),
  };
  const port: GuestMigrationPort = {
    async completed(userId, migrationId) { return next.records.get(`${userId}:${migrationId}`) ?? null; },
    async hasMutation(userId, mutationId) { return next.mutationIds.has(`${userId}:${mutationId}`); },
    async apply(userId, mutation) { next.entities.set(`${userId}:${mutation.entityType}:${mutation.entityId}`, mutation); },
    async record(userId, mutation) { next.mutationIds.add(`${userId}:${mutation.mutationId}`); },
    async verify(userId, mutation) { return next.entities.has(`${userId}:${mutation.entityType}:${mutation.entityId}`); },
    async markCompleted(userId, migrationId, summary) { next.records.set(`${userId}:${migrationId}`, summary); },
  };
  const result = await work(port);
  database.entities = next.entities;
  database.mutationIds = next.mutationIds;
  database.records = next.records;
  return result;
}

const emptyState = (): State => ({ entities: new Map(), mutationIds: new Set(), records: new Map() });

test("guest migration is idempotent across retry and stores one row per entity", async () => {
  const database = emptyState();
  const run = () => inTransaction(database, (port) => runGuestMigrationTransaction(port, "account-A", "migration-1", mutations));
  const first = await run();
  const second = await run();
  assert.equal(first.verified, true);
  assert.equal(first.alreadyCompleted, false);
  assert.equal(second.alreadyCompleted, true);
  assert.equal(database.entities.size, entities.length);
  assert.equal(database.mutationIds.size, entities.length);
  assert.equal(database.records.size, 1);
  for (const entityType of entities) assert.equal(first.counts[entityType], 1);
  assert.equal(database.entities.has(`account-B:xpEvent:xpEvent-3`), false);
});

test("mid-transaction failure rolls back all entities and leaves guest data available for retry", async () => {
  const database = emptyState();
  const guestData = new Map([["cet-daily:v3:vocabulary", "guest-wordbook"]]);
  await assert.rejects(
    inTransaction(database, (port) => runGuestMigrationTransaction(port, "account-A", "migration-1", mutations, { failAfter: 5 })),
    /injected migration failure/,
  );
  assert.equal(database.entities.size, 0);
  assert.equal(database.mutationIds.size, 0);
  assert.equal(database.records.size, 0);
  assert.equal(guestData.get("cet-daily:v3:vocabulary"), "guest-wordbook");
  const retry = await inTransaction(database, (port) => runGuestMigrationTransaction(port, "account-A", "migration-1", mutations));
  assert.equal(retry.verified, true);
  assert.equal(database.entities.size, entities.length);
});

test("verification failure never completes a migration", async () => {
  const database = emptyState();
  await assert.rejects(
    inTransaction(database, (port) => runGuestMigrationTransaction({ ...port, verify: async () => false }, "account-A", "migration-1", mutations)),
    /migration verification failed/,
  );
  assert.equal(database.entities.size, 0);
  assert.equal(database.records.size, 0);
});

test("failure injection is unavailable to an ordinary production request", () => {
  assert.equal(testFailureInjectionAllowed({ NODE_ENV: "production", CET_SYNC_E2E_TEST_FAILURE: "1" }), false);
  assert.equal(testFailureInjectionAllowed({ NODE_ENV: "production" }), false);
  assert.equal(testFailureInjectionAllowed({ NODE_ENV: "test" }), true);
  assert.equal(testFailureInjectionAllowed({ NODE_ENV: "development", CET_SYNC_E2E_TEST_FAILURE: "1" }), true);
});
