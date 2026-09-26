import { test } from "node:test";
import assert from "node:assert/strict";
import { enqueueXpEvent, setSyncUserId } from "../src/lib/sync/adapters";
import { loadQueue, pushQueue, runAutoSync, type SyncStatus } from "../src/lib/sync/client";
import { completedTaskIdsFor, extendCompletedTaskBaseline } from "../src/components/dailyPlan/DailyPlanProvider";
import type { DailyPlan } from "../src/types/dailyPlan";

class MemoryStorage {
  private values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  get length() { return this.values.size; }
}

function installBrowser() {
  const storage = new MemoryStorage();
  (globalThis as Record<string, unknown>).localStorage = storage;
  (globalThis as Record<string, unknown>).window = new EventTarget();
  setSyncUserId(null);
  return storage;
}

function queueXp(userId: string, eventId: string) {
  setSyncUserId(userId);
  enqueueXpEvent({ eventId, source: "vocabulary", sourceId: eventId, amount: 2 });
  return loadQueue(userId)[0];
}

function appliedResponse(mutationId: string) {
  return new Response(JSON.stringify({ applied: [mutationId], skipped: [] }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

test("offline enqueue persists with the same mutationId across account remount", () => {
  installBrowser();
  const item = queueXp("A", "offline-xp");
  setSyncUserId(null);
  assert.equal(loadQueue().length, 0, "Guest cannot see A's queue");
  setSyncUserId("A");
  assert.equal(loadQueue()[0].mutationId, item.mutationId);
  assert.equal(loadQueue()[0].status, "pending");
  setSyncUserId(null);
});

test("failed offline push keeps the mutation and retries the same id after reconnect", async () => {
  installBrowser();
  const item = queueXp("A", "offline-retry");
  const failed = await pushQueue({ userId: "A", fetchImpl: async () => { throw new Error("offline"); } });
  assert.equal(failed.failed, 1);
  assert.equal(loadQueue("A")[0].mutationId, item.mutationId);
  assert.equal(loadQueue("A")[0].attempts, 1);
  const sent: string[] = [];
  const recovered = await pushQueue({
    userId: "A",
    fetchImpl: async (_url, init) => {
      const body = JSON.parse(String(init?.body)) as { mutations: { mutationId: string }[] };
      sent.push(body.mutations[0].mutationId);
      return appliedResponse(item.mutationId);
    },
  });
  assert.deepEqual(sent, [item.mutationId]);
  assert.equal(recovered.applied, 1);
  assert.equal(loadQueue("A").length, 0);
  setSyncUserId(null);
});

test("concurrent reconnect attempts share one push request", async () => {
  installBrowser();
  const item = queueXp("A", "one-upload");
  let requests = 0;
  let resolveFetch!: (response: Response) => void;
  const fetchImpl = () => {
    requests++;
    return new Promise<Response>((resolve) => { resolveFetch = resolve; });
  };
  const first = pushQueue({ userId: "A", fetchImpl });
  const second = pushQueue({ userId: "A", fetchImpl });
  assert.strictEqual(first, second);
  assert.equal(requests, 1);
  resolveFetch(appliedResponse(item.mutationId));
  await Promise.all([first, second]);
  assert.equal(loadQueue("A").length, 0);
  setSyncUserId(null);
});

test("A's in-flight response only clears A's queue after switching to B", async () => {
  installBrowser();
  const a = queueXp("A", "A-event");
  let resolveFetch!: (response: Response) => void;
  const request = pushQueue({
    userId: "A",
    fetchImpl: () => new Promise<Response>((resolve) => { resolveFetch = resolve; }),
  });
  const b = queueXp("B", "B-event");
  resolveFetch(appliedResponse(a.mutationId));
  await request;
  assert.equal(loadQueue("A").length, 0);
  assert.equal(loadQueue("B")[0].mutationId, b.mutationId);
  setSyncUserId(null);
});

test("B cannot upload A's pending queue, and A can resume it later", async () => {
  installBrowser();
  const a = queueXp("A", "A-private");
  setSyncUserId("B");
  let requests = 0;
  const blocked = await pushQueue({ userId: "A", fetchImpl: async () => { requests++; return appliedResponse(a.mutationId); } });
  assert.equal(requests, 0);
  assert.equal(blocked.failed, 1);
  assert.equal(loadQueue("B").length, 0);
  setSyncUserId("A");
  const resumed = await pushQueue({ userId: "A", fetchImpl: async () => { requests++; return appliedResponse(a.mutationId); } });
  assert.equal(resumed.applied, 1);
  assert.equal(requests, 1);
  assert.equal(loadQueue("A").length, 0);
  setSyncUserId(null);
});

test("reconnect runs push then pull then hydrate and ends synced", async () => {
  const steps: string[] = [];
  const statuses: SyncStatus[] = [];
  const result = await runAutoSync({
    active: () => true,
    push: async () => { steps.push("push"); return { failed: 0 }; },
    pull: async () => { steps.push("pull"); return { profile: { targetScore: 600 } }; },
    hydrate: () => { steps.push("hydrate"); },
    pending: () => { steps.push("pending"); return 0; },
    onStatus: (status) => statuses.push(status),
  });
  assert.deepEqual(steps, ["push", "pull", "pending", "hydrate", "pending"]);
  assert.deepEqual(statuses, ["syncing", "synced"]);
  assert.equal(result, "synced");
});

test("a local mutation created during pull is pushed before remote hydrate", async () => {
  const steps: string[] = [];
  const statuses: SyncStatus[] = [];
  let queued = 0;
  const options = {
    active: () => true,
    push: async () => { steps.push("push"); queued = 0; return { failed: 0 }; },
    pull: async () => {
      steps.push("pull");
      if (steps.filter((step) => step === "pull").length === 1) queued = 1;
      return { profile: { targetScore: 600 } };
    },
    hydrate: () => { steps.push("hydrate"); },
    pending: () => queued,
    onStatus: (status: SyncStatus) => statuses.push(status),
  };
  assert.equal(await runAutoSync(options), "pending");
  assert.deepEqual(steps, ["push", "pull"]);
  assert.deepEqual(statuses, ["syncing", "pending"]);

  assert.equal(await runAutoSync(options), "synced");
  assert.deepEqual(steps, ["push", "pull", "push", "pull", "hydrate"]);
  assert.deepEqual(statuses, ["syncing", "pending", "syncing", "synced"]);
});

test("failed push never pulls or hydrates stale remote state", async () => {
  const steps: string[] = [];
  const statuses: SyncStatus[] = [];
  const result = await runAutoSync({
    active: () => true,
    push: async () => { steps.push("push"); return { failed: 1 }; },
    pull: async () => { steps.push("pull"); return {}; },
    hydrate: () => { steps.push("hydrate"); },
    pending: () => { steps.push("pending"); return 1; },
    onStatus: (status) => statuses.push(status),
  });
  assert.deepEqual(steps, ["push"]);
  assert.deepEqual(statuses, ["syncing", "failed"]);
  assert.equal(result, "failed");
});

test("account change during push cancels pull and hydrate", async () => {
  let active = true;
  let resolvePush!: (result: { failed: number }) => void;
  const steps: string[] = [];
  const result = runAutoSync({
    active: () => active,
    push: () => { steps.push("push"); return new Promise((resolve) => { resolvePush = resolve; }); },
    pull: async () => { steps.push("pull"); return {}; },
    hydrate: () => { steps.push("hydrate"); },
    pending: () => 0,
    onStatus: () => {},
  });
  active = false;
  resolvePush({ failed: 0 });
  assert.equal(await result, "cancelled");
  assert.deepEqual(steps, ["push"]);
});

test("partial daily plan completion queues each finished task before the full plan is done", () => {
  const plan: DailyPlan = {
    date: "2026-09-24", phase: "foundation", estimatedMinutes: 20,
    tasks: [
      { id: "translation", module: "translation", target: "1 篇", estimatedMinutes: 10, order: 0, priority: "normal", source: "system" },
      { id: "writing", module: "writing", target: "1 篇", estimatedMinutes: 10, order: 1, priority: "normal", source: "system" },
    ],
    status: "in_progress", generatedAt: "2026-09-24T00:00:00.000Z", adjusted: false, planVersion: 1,
  };
  const progress = (done: number) => ({ done, total: 1, completed: done === 1 });
  const first = {
    vocabulary: progress(0), reading: progress(0), listening: progress(0),
    translation: progress(1), writing: progress(0),
  };
  assert.deepEqual(completedTaskIdsFor(plan, first), ["translation"]);
  assert.deepEqual(completedTaskIdsFor(plan, { ...first, writing: progress(1) }), ["translation", "writing"]);
});

test("remote hydrate baseline does not echo, then a later local task completion is still queued", () => {
  const hydrated = extendCompletedTaskBaseline(["reading"], ["reading"]);
  assert.equal(hydrated.newlyCompleted, false);
  const local = extendCompletedTaskBaseline(hydrated.seen, ["reading", "listening"]);
  assert.equal(local.newlyCompleted, true);
  assert.deepEqual(local.seen, ["reading", "listening"]);
  assert.equal(extendCompletedTaskBaseline(local.seen, ["reading", "listening"]).newlyCompleted, false);
});
