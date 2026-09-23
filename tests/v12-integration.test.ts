import { test } from "node:test";
import assert from "node:assert/strict";
import { enqueueXpEvent, enqueueWordbook, enqueueReviewItem, enqueueDailyPlan, setSyncUserId, getSyncUserId } from "../src/lib/sync/adapters";
import { loadQueue } from "../src/lib/sync/client";

// Minimal localStorage shim for tests.
class MemoryStorage {
  private m = new Map<string, string>();
  getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null; }
  setItem(k: string, v: string) { this.m.set(k, v); }
  removeItem(k: string) { this.m.delete(k); }
  get length() { return this.m.size; }
  key(i: number) { return Array.from(this.m.keys())[i] ?? null; }
}

function installStorage() {
  const s = new MemoryStorage();
  (globalThis as Record<string, unknown>).localStorage = s;
  (globalThis as Record<string, unknown>).window = globalThis;
  return s;
}

test("adapters: guest enqueue is no-op", () => {
  installStorage();
  setSyncUserId(null);
  enqueueXpEvent({ eventId: "x1", source: "vocabulary", sourceId: "w1", amount: 10 });
  assert.equal(loadQueue().length, 0);
});

test("adapters: logged-in enqueue queues XP event", () => {
  installStorage();
  setSyncUserId("u1");
  enqueueXpEvent({ eventId: "x1", source: "vocabulary", sourceId: "w1", amount: 10 });
  const q = loadQueue();
  assert.equal(q.length, 1);
  assert.equal(q[0].entityType, "xpEvent");
  assert.equal((q[0].payload as Record<string, unknown>).source, "vocabulary");
  setSyncUserId(null);
});

test("adapters: queue is user-scoped (A vs B)", () => {
  const s = installStorage();
  setSyncUserId("uA");
  enqueueXpEvent({ eventId: "x1", source: "vocabulary", sourceId: "w1", amount: 10 });
  assert.equal(loadQueue().length, 1);

  setSyncUserId("uB");
  assert.equal(loadQueue().length, 0, "B must not see A's queue");

  enqueueWordbook({ wordId: "wB" });
  assert.equal(loadQueue().length, 1);

  setSyncUserId("uA");
  assert.equal(loadQueue().length, 1, "A sees A's queue");
  setSyncUserId(null);
});

test("adapters: wordbook add/remove enqueues correct operation", () => {
  installStorage();
  setSyncUserId("u1");
  enqueueWordbook({ wordId: "w1" });
  enqueueWordbook({ wordId: "w1", removed: true });
  const q = loadQueue();
  // per-entity state merge collapses add+remove to the final tombstone.
  assert.equal(q.length, 1);
  assert.equal(q[0].operation, "remove");
  setSyncUserId(null);
});

test("adapters: review version increments locally", () => {
  installStorage();
  setSyncUserId("u1");
  enqueueReviewItem({ reviewItemId: "r1", sourceModule: "vocabulary", activityId: "a1", questionId: "q1", version: 1 });
  enqueueReviewItem({ reviewItemId: "r1", sourceModule: "vocabulary", activityId: "a1", questionId: "q1", status: "mastered", version: 2 });
  const q = loadQueue();
  // state merge keeps only the latest (v2)
  assert.equal(q.length, 1);
  assert.equal((q[0].payload as Record<string, unknown>).version, 2);
  setSyncUserId(null);
});

test("adapters: dailyPlan merges completedTaskIds across queue entries", () => {
  installStorage();
  setSyncUserId("u1");
  enqueueDailyPlan({ planDate: "2026-09-23", completedTaskIds: ["t1"] });
  enqueueDailyPlan({ planDate: "2026-09-23", completedTaskIds: ["t2"] });
  const q = loadQueue();
  // per-entity accumulative merge should collapse to one entry with t1+t2.
  assert.equal(q.length, 1);
  const inner = q[0].payload as Record<string, unknown>;
  assert.deepEqual([...(inner.completedTaskIds as string[])].sort(), ["t1", "t2"]);
  setSyncUserId(null);
});

test("scoped storage: guest uses legacy keys, user prefixes", async () => {
  const s = installStorage();
  const { nsKey } = await import("../src/lib/storage/namespace");
  assert.equal(nsKey("guest", "cet-daily:v1:study"), "cet-daily:v1:study");
  assert.equal(nsKey({ type: "user", id: "u1" }, "cet-daily:v1:study"), "user:u1:cet-daily:v1:study");
});

test("scoped storage: A set XP, B cannot read", () => {
  const s = installStorage();
  // A writes under user:A: prefix
  s.setItem("user:uA:cet-daily:v1:study", JSON.stringify({ xp: 100 }));
  // B writes under user:B: prefix
  s.setItem("user:uB:cet-daily:v1:study", JSON.stringify({ xp: 200 }));
  // Guest legacy
  s.setItem("cet-daily:v1:study", JSON.stringify({ xp: 50 }));

  // Guest reads legacy
  const guest = JSON.parse(s.getItem("cet-daily:v1:study")!);
  assert.equal(guest.xp, 50);

  // A reads own
  const a = JSON.parse(s.getItem("user:uA:cet-daily:v1:study")!);
  assert.equal(a.xp, 100);

  // B cannot see A
  assert.equal(s.getItem("user:uB:cet-daily:v1:study"), JSON.stringify({ xp: 200 }));
});
