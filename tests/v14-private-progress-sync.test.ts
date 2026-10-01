import { test } from "node:test";
import assert from "node:assert/strict";
import { setSyncUserId } from "../src/lib/sync/adapters";
import {
  enqueuePrivateProgress,
  loadPrivateProgressQueue,
  pushPrivateProgressQueue,
  fetchRemoteProgress,
  clearPrivateProgressForPaper,
  generateAttemptId,
  type PrivateProgressPayload,
  type RemoteProgress,
} from "../src/lib/private-papers/progress-sync";

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

function payload(over: Partial<PrivateProgressPayload> = {}): PrivateProgressPayload {
  return {
    attemptId: "attempt-1",
    contentHash: "hash-1",
    answers: { 0: "A", 1: "B" },
    currentIndex: 2,
    submitted: false,
    baseRevision: 0,
    ...over,
  };
}

function putOk(revision: number) {
  return new Response(JSON.stringify({ ok: true, revision, updatedAt: "2026-10-01T00:00:00.000Z" }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function remoteView(paperId: string): Record<string, unknown> {
  return {
    paperId,
    progressVersion: 1,
    attemptId: "attempt-remote",
    contentHash: "hash-1",
    answers: { "0": "C", "3": "D" },
    currentIndex: 4,
    submitted: true,
    revision: 7,
    updatedAt: "2026-10-01T01:00:00.000Z",
  };
}

test("generateAttemptId produces distinct uuid-like ids", () => {
  const a = generateAttemptId();
  const b = generateAttemptId();
  assert.notEqual(a, b);
  assert.match(a, /^[0-9a-f-]{36}$/);
});

test("enqueuePrivateProgress stores a privateProgress mutation; repeat enqueue on same paper collapses to latest (snapshot)", () => {
  installBrowser();
  setSyncUserId("U1");
  enqueuePrivateProgress("paper-1", payload({ currentIndex: 1, answers: { 0: "A" } }));
  assert.equal(loadPrivateProgressQueue("U1").length, 1);
  // Second enqueue for same paper: snapshot merge collapses the old one.
  enqueuePrivateProgress("paper-1", payload({ currentIndex: 5, answers: { 0: "A", 1: "B" } }));
  const q = loadPrivateProgressQueue("U1");
  assert.equal(q.length, 1, "snapshot merge keeps only the newest mutation");
  assert.equal(q[0].entityType, "privateProgress");
  assert.equal(q[0].entityId, "paper-1");
  assert.equal(q[0].operation, "upsert");
  assert.equal((q[0].payload as unknown as PrivateProgressPayload).currentIndex, 5);
  setSyncUserId(null);
});

test("enqueue only writes the dedicated owner-scoped PRIVATE queue key (no XP/session/daily-plan keys)", () => {
  const storage = installBrowser();
  setSyncUserId("U2");
  enqueuePrivateProgress("paper-x", payload());
  const keys: string[] = [];
  for (let i = 0; i < storage.length; i++) keys.push(storage.key(i) as string);
  assert.deepEqual(keys, ["cet-daily:v14:private-progress-queue:U2"], "only the PRIVATE user queue key is touched");
  const queue = loadPrivateProgressQueue("U2");
  assert.ok(queue.every((m) => m.entityType === "privateProgress"), "no other entity types enqueued");
  setSyncUserId(null);
});

test("push success applies the mutation, removes it, and surfaces the new revision", async () => {
  installBrowser();
  setSyncUserId("U3");
  enqueuePrivateProgress("paper-ok", payload());
  const result = await pushPrivateProgressQueue({
    userId: "U3",
    fetchImpl: async () => putOk(5),
  });
  assert.equal(result.applied, 1);
  assert.equal(result.failed, 0);
  assert.deepEqual(result.conflicts, []);
  assert.equal(result.revisions["paper-ok"], 5);
  assert.equal(loadPrivateProgressQueue("U3").length, 0, "applied mutation removed from queue");
  setSyncUserId(null);
});

test("network error keeps the mutation in the queue and counts it as failed", async () => {
  installBrowser();
  setSyncUserId("U4");
  enqueuePrivateProgress("paper-net", payload());
  const result = await pushPrivateProgressQueue({
    userId: "U4",
    fetchImpl: async () => { throw new Error("offline"); },
  });
  assert.equal(result.applied, 0);
  assert.equal(result.failed, 1);
  assert.equal(loadPrivateProgressQueue("U4").length, 1, "network failure keeps the mutation for retry");
  setSyncUserId(null);
});

test("404 (paper deleted) removes the mutation from the queue", async () => {
  installBrowser();
  setSyncUserId("U5");
  enqueuePrivateProgress("paper-gone", payload());
  const result = await pushPrivateProgressQueue({
    userId: "U5",
    fetchImpl: async () => new Response("{}", { status: 404 }),
  });
  assert.equal(result.applied, 0);
  assert.equal(result.failed, 0);
  assert.equal(loadPrivateProgressQueue("U5").length, 0, "deleted paper's mutation dropped");
  setSyncUserId(null);
});

test("409 attempt_mismatch preserves local draft for explicit conflict resolution", async () => {
  installBrowser();
  setSyncUserId("U6");
  enqueuePrivateProgress("paper-attempt", payload());
  const result = await pushPrivateProgressQueue({
    userId: "U6",
    fetchImpl: async () => new Response(JSON.stringify({ ok: false, error: "attempt_mismatch", currentAttemptId: "other" }), {
      status: 409, headers: { "content-type": "application/json" },
    }),
  });
  assert.equal(result.applied, 0);
  assert.equal(result.failed, 0);
  assert.equal(loadPrivateProgressQueue("U6").length, 1, "local draft is preserved");
  assert.deepEqual(result.conflicts, ["paper-attempt"]);
  setSyncUserId(null);
});

test("409 revision_conflict keeps the mutation and calls onConflict with normalized server progress", async () => {
  installBrowser();
  setSyncUserId("U7");
  enqueuePrivateProgress("paper-conflict", payload());
  const captured: { paperId: string; serverProgress: RemoteProgress }[] = [];
  const result = await pushPrivateProgressQueue({
    userId: "U7",
    fetchImpl: async () => new Response(JSON.stringify({ ok: false, error: "revision_conflict", currentRevision: 7, serverProgress: remoteView("paper-conflict") }), {
      status: 409, headers: { "content-type": "application/json" },
    }),
    onConflict: (paperId, serverProgress) => { captured.push({ paperId, serverProgress }); },
  });
  assert.equal(result.applied, 0);
  assert.ok(result.conflicts.includes("paper-conflict"));
  assert.equal(loadPrivateProgressQueue("U7").length, 1, "conflicting mutation stays queued for user decision");
  assert.equal(captured.length, 1, "onConflict fired");
  const conflict = captured[0];
  assert.equal(conflict.paperId, "paper-conflict");
  assert.equal(conflict.serverProgress.revision, 7);
  assert.equal(conflict.serverProgress.currentIndex, 4);
  assert.equal(conflict.serverProgress.submitted, true);
  // answers keys normalized from strings to numbers
  assert.deepEqual(
    Object.keys(conflict.serverProgress.answers).map(Number).sort(),
    [0, 3],
  );
  setSyncUserId(null);
});

test("account switch guard: queue for U-A is never pushed while active user is U-B", async () => {
  installBrowser();
  setSyncUserId("A");
  enqueuePrivateProgress("paper-a", payload());
  setSyncUserId("B"); // active user is now B
  let fetchCalled = false;
  const result = await pushPrivateProgressQueue({
    userId: "A", // caller asks to push A's queue
    fetchImpl: async () => { fetchCalled = true; return putOk(1); },
  });
  assert.equal(fetchCalled, false, "no request fired when active user != requested user");
  assert.equal(loadPrivateProgressQueue("A").length, 1, "A's queue untouched");
  assert.equal(loadPrivateProgressQueue("B").length, 0, "B has nothing");
  assert.equal(result.failed, 1);
  setSyncUserId(null);
});

test("clearPrivateProgressForPaper drops only that paper's mutations", () => {
  installBrowser();
  setSyncUserId("U8");
  enqueuePrivateProgress("paper-keep", payload());
  enqueuePrivateProgress("paper-drop", payload());
  assert.equal(loadPrivateProgressQueue("U8").length, 2);
  clearPrivateProgressForPaper("U8", "paper-drop");
  const remaining = loadPrivateProgressQueue("U8");
  assert.equal(remaining.length, 1);
  assert.equal(remaining[0].entityId, "paper-keep");
  setSyncUserId(null);
});

test("fetchRemoteProgress returns normalized RemoteProgress on a healthy response", async () => {
  installBrowser();
  const res = await fetchRemoteProgress("paper-get", async () =>
    new Response(JSON.stringify({ exists: true, progress: remoteView("paper-get") }), {
      status: 200, headers: { "content-type": "application/json" },
    }),
  );
  assert.ok(res);
  assert.equal(res!.paperId, "paper-get");
  assert.equal(res!.revision, 7);
  assert.equal(res!.contentHash, "hash-1");
  assert.deepEqual(Object.keys(res!.answers).map(Number).sort(), [0, 3]);
});

test("deleted paper is not mistaken for an empty cloud record", async () => {
  installBrowser();
  await assert.rejects(() => fetchRemoteProgress("paper-nope", async () => new Response("{}", { status: 404 })));
});

test("fetchRemoteProgress returns null when server says exists:false (contentHash mismatch / no record)", async () => {
  installBrowser();
  const res = await fetchRemoteProgress("paper-stale", async () =>
    new Response(JSON.stringify({ exists: false, progress: null, revision: 0, invalidated: false }), {
      status: 200, headers: { "content-type": "application/json" },
    }),
  );
  assert.equal(res, null);
});

test("cloud read failure is distinct from an empty cloud record", async () => {
  installBrowser();
  await assert.rejects(() => fetchRemoteProgress("paper-err", async () => { throw new Error("down"); }));
});
