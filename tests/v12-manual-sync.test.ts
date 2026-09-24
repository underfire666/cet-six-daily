import { test } from "node:test";
import assert from "node:assert/strict";
import { isManualSyncBusy, runManualSync } from "../src/lib/sync/manual";
import type { SyncStatus } from "../src/lib/sync/client";

function setup(options: { queued: number; pushFails?: boolean; pullFails?: boolean; hydrateFails?: boolean; remainingAfterPush?: number }) {
  const steps: string[] = [];
  const statuses: SyncStatus[] = [];
  let status: SyncStatus = "pending";
  let pending = options.queued;
  let lastSync = false;

  const sync = () => runManualSync({
    onStatus(next) {
      status = next;
      statuses.push(next);
    },
    async push() {
      steps.push("push");
      if (options.pushFails) return { failed: pending };
      pending = options.remainingAfterPush ?? 0;
      return { failed: 0 };
    },
    async pull() {
      steps.push("pull");
      return options.pullFails ? null : { profile: { targetScore: 600 } };
    },
    hydrate() {
      steps.push("hydrate");
      if (options.hydrateFails) throw new Error("hydrate failed");
    },
    refreshPending() {
      steps.push("refresh");
      return pending;
    },
    onSynced() {
      steps.push("lastSync");
      lastSync = true;
    },
  });

  return {
    sync,
    steps,
    statuses,
    get status() { return status; },
    get lastSync() { return lastSync; },
  };
}

test("manual sync with empty queue completes pull and enables retry", async () => {
  const state = setup({ queued: 0 });
  await state.sync();
  assert.deepEqual(state.steps, ["push", "pull", "hydrate", "refresh", "lastSync"]);
  assert.deepEqual(state.statuses, ["syncing", "synced"]);
  assert.equal(state.lastSync, true);
  assert.equal(isManualSyncBusy(state.status), false);
});

test("manual sync with pending queue pushes before pull and enables retry", async () => {
  const state = setup({ queued: 1 });
  await state.sync();
  assert.deepEqual(state.steps, ["push", "pull", "hydrate", "refresh", "lastSync"]);
  assert.deepEqual(state.statuses, ["syncing", "synced"]);
  assert.equal(isManualSyncBusy(state.status), false);
});

test("a second empty-queue manual sync also finishes and remains clickable", async () => {
  const state = setup({ queued: 0 });
  await state.sync();
  await state.sync();
  assert.deepEqual(state.statuses, ["syncing", "synced", "syncing", "synced"]);
  assert.equal(isManualSyncBusy(state.status), false);
});

test("pull failure becomes retryable failed state without claiming success", async () => {
  const state = setup({ queued: 0, pullFails: true });
  await assert.rejects(state.sync(), /云端读取失败/);
  assert.deepEqual(state.statuses, ["syncing", "failed"]);
  assert.equal(state.lastSync, false);
  assert.equal(isManualSyncBusy(state.status), false);
});

test("push failure stops before pull and becomes retryable failed state", async () => {
  const state = setup({ queued: 1, pushFails: true });
  await assert.rejects(state.sync(), /上传失败/);
  assert.equal(state.steps.includes("pull"), false);
  assert.deepEqual(state.statuses, ["syncing", "failed"]);
  assert.equal(state.lastSync, false);
  assert.equal(isManualSyncBusy(state.status), false);
});

test("hydrate failure is surfaced and does not display synced", async () => {
  const state = setup({ queued: 0, hydrateFails: true });
  await assert.rejects(state.sync(), /hydrate failed/);
  assert.deepEqual(state.statuses, ["syncing", "failed"]);
  assert.equal(state.lastSync, false);
  assert.equal(isManualSyncBusy(state.status), false);
});

test("remaining queued mutations cannot be misreported as synced", async () => {
  const state = setup({ queued: 1, remainingAfterPush: 1 });
  await assert.rejects(state.sync(), /仍有待同步项目/);
  assert.deepEqual(state.statuses, ["syncing", "failed"]);
  assert.equal(state.lastSync, false);
  assert.equal(isManualSyncBusy(state.status), false);
});
