import { test } from "node:test";
import assert from "node:assert/strict";
import { mergeDailyPlan, validateMutation, type SyncMutationInput } from "../src/lib/sync/server";
import { backoffDelay, dedupeSameEntity } from "../src/lib/sync/client";
import { nsKey } from "../src/lib/storage/namespace";

test("validateMutation rejects bad entity / missing fields", () => {
  assert.notEqual(validateMutation({}), null);
  assert.equal(
    validateMutation({
      mutationId: "m1",
      entityType: "xpEvent",
      entityId: "e1",
      operation: "upsert",
      payload: { amount: 10 },
    }),
    null,
  );
  assert.notEqual(
    validateMutation({
      mutationId: "m1",
      entityType: "bogus" as SyncMutationInput["entityType"],
      entityId: "e1",
      operation: "upsert",
      payload: {},
    }),
    null,
  );
});

test("mergeDailyPlan completed-wins: never drops completed", () => {
  const merged = mergeDailyPlan(
    { completedTaskIds: ["a", "b"] },
    { completedTaskIds: ["b", "c"] },
  );
  assert.deepEqual([...(merged.completedTaskIds as string[])].sort(), ["a", "b", "c"]);
});

test("mergeDailyPlan with no existing returns incoming", () => {
  const merged = mergeDailyPlan(null, { completedTaskIds: ["x"] });
  assert.deepEqual(merged.completedTaskIds, ["x"]);
});

test("backoff grows and caps", () => {
  assert.ok(backoffDelay(0) < backoffDelay(3));
  assert.ok(backoffDelay(20) <= 300_000);
});

test("dedupeSameEntity keeps latest only", () => {
  const queue = [
    { mutationId: "m1", entityType: "wordbook", entityId: "w1", operation: "upsert" as const, payload: {}, createdAt: "", attempts: 0, status: "pending" as const },
    { mutationId: "m2", entityType: "wordbook", entityId: "w1", operation: "remove" as const, payload: {}, createdAt: "", attempts: 0, status: "pending" as const },
    { mutationId: "m3", entityType: "xpEvent", entityId: "x1", operation: "upsert" as const, payload: {}, createdAt: "", attempts: 0, status: "pending" as const },
  ];
  const out = dedupeSameEntity(queue, "wordbook", "w1");
  assert.equal(out.length, 2);
  assert.equal(out.find((m) => m.entityType === "wordbook")?.mutationId, "m2");
});

test("nsKey: guest keeps legacy key, user namespaces it", () => {
  assert.equal(nsKey("guest", "cet-daily:v1:study"), "cet-daily:v1:study");
  assert.equal(nsKey({ type: "user", id: "u1" }, "cet-daily:v1:study"), "user:u1:cet-daily:v1:study");
});
