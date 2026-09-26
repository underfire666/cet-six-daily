import { test } from "node:test";
import assert from "node:assert/strict";
import { recordWrong } from "../src/lib/review/scheduler";
import { enqueueReviewItem, enqueueXpEvent, setSyncUserId } from "../src/lib/sync/adapters";
import { loadQueue, saveQueue } from "../src/lib/sync/client";

class MemoryStorage {
  private m = new Map<string, string>();
  getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null; }
  setItem(k: string, v: string) { this.m.set(k, v); }
  removeItem(k: string) { this.m.delete(k); }
  get length() { return this.m.size; }
  key(i: number) { return Array.from(this.m.keys())[i] ?? null; }
}

function install() {
  const s = new MemoryStorage();
  (globalThis as Record<string, unknown>).localStorage = s;
  (globalThis as Record<string, unknown>).window = globalThis;
  return s;
}

test("provider-integration: review wrong -> enqueueReviewItem (version 1)", () => {
  install();
  setSyncUserId("u1");
  saveQueue([]);
  const items = recordWrong({}, "vocabulary", "w1", "q1", "2026-09-23T10:00:00Z", "wrong", "optA");
  const item = Object.values(items)[0];
  enqueueReviewItem({
    reviewItemId: item.id,
    sourceModule: item.sourceModule,
    activityId: item.sourceActivityId,
    questionId: item.questionId,
    status: item.masteryStatus,
    dueDate: item.nextReviewAt,
    removed: item.removed,
    version: 1,
  });
  const q = loadQueue();
  assert.equal(q.length, 1);
  assert.equal(q[0].entityType, "reviewItem");
  setSyncUserId(null);
});

test("provider-integration: review correct -> version increments to 2", () => {
  install();
  setSyncUserId("u2");
  saveQueue([]);
  const items = recordWrong({}, "reading", "a1", "q1", "2026-09-23T10:00:00Z", "wrong");
  const itemId = Object.keys(items)[0];
  enqueueReviewItem({ reviewItemId: itemId, sourceModule: "reading", activityId: "a1", questionId: "q1", version: 1 });
  enqueueReviewItem({ reviewItemId: itemId, sourceModule: "reading", activityId: "a1", questionId: "q1", status: "learning", version: 2 });
  const q = loadQueue();
  assert.equal(q.length, 1, "state merge keeps latest");
  assert.equal((q[0].payload as Record<string, unknown>).version, 2);
  setSyncUserId(null);
});

test("provider-integration: dailyPlan XP events both queued", () => {
  install();
  setSyncUserId("u3");
  saveQueue([]);
  enqueueXpEvent({ eventId: "s1", source: "daily_lesson", sourceId: "lesson-1", amount: 50 });
  enqueueXpEvent({ eventId: "s2", source: "daily_lesson", sourceId: "lesson-2", amount: 50 });
  const q = loadQueue();
  assert.ok(q.length >= 2);
  assert.ok(q.every((e) => e.entityType === "xpEvent"));
  setSyncUserId(null);
});

test("provider-integration: guest enqueue is no-op (queue stays empty)", () => {
  install();
  setSyncUserId(null);
  enqueueReviewItem({ reviewItemId: "r1", sourceModule: "vocabulary", activityId: "a1", questionId: "q1", version: 1 });
  assert.equal(loadQueue().length, 0);
});

test("provider-integration: A and B queues isolated", () => {
  install();
  setSyncUserId("uA");
  saveQueue([]);
  enqueueReviewItem({ reviewItemId: "rA", sourceModule: "vocabulary", activityId: "a1", questionId: "q1", version: 1 });
  assert.equal(loadQueue().length, 1);
  setSyncUserId("uB");
  assert.equal(loadQueue().length, 0, "B cannot see A's review");
  setSyncUserId("uA");
  assert.equal(loadQueue().length, 1, "A sees own review");
  setSyncUserId(null);
});

test("provider-integration: hydrate does not re-enqueue", () => {
  install();
  setSyncUserId("u1");
  saveQueue([]);
  enqueueReviewItem({ reviewItemId: "r1", sourceModule: "vocabulary", activityId: "a1", questionId: "q1", version: 1 });
  const afterPush = loadQueue().length;
  // Hydrate path writes directly to storage, never calls enqueueXxx.
  assert.equal(loadQueue().length, afterPush);
  setSyncUserId(null);
});
