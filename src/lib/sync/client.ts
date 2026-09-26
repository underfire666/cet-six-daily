// Client-side sync engine: mutation queue, push, pull, retry with backoff.
// Local-first: every mutation is queued to localStorage first, then pushed in background.

export type SyncStatus =
  | "guest"
  | "local-only"
  | "syncing"
  | "synced"
  | "pending"
  | "failed"
  | "offline";

export interface QueuedMutation {
  mutationId: string;
  entityType: string;
  entityId: string;
  operation: "upsert" | "remove";
  payload: Record<string, unknown>;
  createdAt: string;
  attempts: number;
  status: "pending" | "syncing" | "failed";
}

const GUEST_QUEUE_KEY = "cet-daily:v12:sync-queue";
export const SYNC_QUEUE_EVENT = "cet-daily:v12:sync-queue-changed";
export const SYNC_STATUS_EVENT = "cet-daily:v12:sync-status-changed";

export interface SyncEventDetail {
  userId: string;
  status?: SyncStatus;
  pendingCount: number;
}

function activeUserId(): string | null {
  if (typeof window === "undefined") return null;
  return (window as unknown as { __CET_SYNC_USER_ID?: string }).__CET_SYNC_USER_ID ?? null;
}

function queueKey(userId?: string | null): string {
  // User-scoped queue: User A's pending mutations never get pushed as User B's.
  const owner = userId === undefined ? activeUserId() : userId;
  return owner ? `cet-daily:v12:sync-queue:${owner}` : GUEST_QUEUE_KEY;
}

function notifyQueue(userId: string | null, pendingCount: number) {
  if (typeof window === "undefined" || !userId || typeof window.dispatchEvent !== "function") return;
  window.dispatchEvent(new CustomEvent<SyncEventDetail>(SYNC_QUEUE_EVENT, {
    detail: { userId, pendingCount },
  }));
}

export function publishSyncStatus(userId: string, status: SyncStatus) {
  if (typeof window === "undefined" || typeof window.dispatchEvent !== "function") return;
  window.dispatchEvent(new CustomEvent<SyncEventDetail>(SYNC_STATUS_EVENT, {
    detail: { userId, status, pendingCount: loadQueue(userId).length },
  }));
}

// Per-entity queue merge policy.
// - snapshot: keep latest (profile/settings/preferences)
// - event: never collapse (xp events, sessions, translation/writing histories)
// - accumulative: merge payloads for same entityId (dailyPlan completedTaskIds)
// - state: latest wins but keep tombstone (wordbook/review)
type MergePolicy = "snapshot" | "event" | "accumulative" | "state";

const MERGE_POLICY: Record<string, MergePolicy> = {
  profile: "snapshot",
  settings: "snapshot",
  preferences: "snapshot",
  xpEvent: "event",
  session: "event",
  translationHistory: "event",
  writingHistory: "event",
  migrationRecord: "event",
  dailyPlan: "accumulative",
  wordbook: "state",
  reviewItem: "state",
};

export function loadQueue(userId?: string | null): QueuedMutation[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(queueKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveQueue(queue: QueuedMutation[], userId?: string | null) {
  if (typeof window === "undefined") return;
  const owner = userId === undefined ? activeUserId() : userId;
  localStorage.setItem(queueKey(owner), JSON.stringify(queue));
  notifyQueue(owner, queue.length);
}

export function enqueueMutation(m: Omit<QueuedMutation, "mutationId" | "createdAt" | "attempts" | "status">): QueuedMutation {
  const mutationId = crypto.randomUUID();
  const record: QueuedMutation = {
    ...m,
    mutationId,
    createdAt: new Date().toISOString(),
    attempts: 0,
    status: "pending",
  };
  let queue = loadQueue();
  queue = applyQueueMerge(queue, record);
  queue.push(record);
  saveQueue(queue);
  return record;
}

// Per-entity queue merge. Returns the queue *after* collapsing prior records
// that this new record supersedes (does not include the new record itself).
function applyQueueMerge(queue: QueuedMutation[], incoming: QueuedMutation): QueuedMutation[] {
  const policy = MERGE_POLICY[incoming.entityType] ?? "snapshot";
  if (policy === "event") return queue; // never collapse different events
  if (policy === "accumulative") {
    // For dailyPlan: merge completedTaskIds across queued mutations for the same planDate.
    const prior = queue.find((q) => q.entityType === incoming.entityType && q.entityId === incoming.entityId);
    if (prior) {
      const merged = mergeAccumulative(pairPayload(prior), pairPayload(incoming));
      incoming.payload = merged;
      return queue.filter((q) => q !== prior);
    }
    return queue;
  }
  // snapshot / state: drop prior mutations for same (entityType, entityId)
  return queue.filter((q) => !(q.entityType === incoming.entityType && q.entityId === incoming.entityId));
}

function pairPayload(m: QueuedMutation): Record<string, unknown> {
  return (m.payload as Record<string, unknown>) ?? {};
}

function mergeAccumulative(a: Record<string, unknown>, b: Record<string, unknown>): Record<string, unknown> {
  const aCompleted = new Set(Array.isArray(a.completedTaskIds) ? (a.completedTaskIds as string[]) : []);
  const bCompleted = new Set(Array.isArray(b.completedTaskIds) ? (b.completedTaskIds as string[]) : []);
  for (const id of bCompleted) aCompleted.add(id);
  return { ...a, ...b, completedTaskIds: Array.from(aCompleted) };
}

// Legacy helper kept for tests.
export function dedupeSameEntity(
  queue: QueuedMutation[],
  entityType: string,
  entityId: string,
): QueuedMutation[] {
  const seen = new Map<string, QueuedMutation>();
  for (const m of queue) {
    if (m.entityType === entityType && m.entityId === entityId) {
      seen.set(entityId, m);
    }
  }
  const latest = seen.get(entityId);
  return queue.filter((m) => {
    if (m.entityType !== entityType || m.entityId !== entityId) return true;
    return m === latest;
  });
}

const inFlightPushes = new Map<string, Promise<{ applied: number; failed: number }>>();

export function pushQueue(options?: {
  onStatus?: (s: SyncStatus) => void;
  fetchImpl?: typeof fetch;
  userId?: string;
}): Promise<{ applied: number; failed: number }> {
  const userId = options?.userId ?? activeUserId();
  const key = queueKey(userId);
  const existing = inFlightPushes.get(key);
  if (existing) return existing;
  const task = pushQueueForUser(userId, options).finally(() => {
    if (inFlightPushes.get(key) === task) inFlightPushes.delete(key);
  });
  inFlightPushes.set(key, task);
  return task;
}

async function pushQueueForUser(userId: string | null, options?: {
  onStatus?: (s: SyncStatus) => void;
  fetchImpl?: typeof fetch;
}): Promise<{ applied: number; failed: number }> {
  const fetchImpl = options?.fetchImpl ?? fetch;
  const queue = loadQueue(userId).filter((m) => m.status !== "syncing");
  if (queue.length === 0) return { applied: 0, failed: 0 };

  // Never send a captured account queue after the browser switched accounts.
  if (!userId || activeUserId() !== userId) {
    options?.onStatus?.("failed");
    return { applied: 0, failed: queue.length };
  }

  options?.onStatus?.("syncing");
  try {
    const res = await fetchImpl("/api/sync/push", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        mutations: queue.map((m) => ({
          mutationId: m.mutationId,
          entityType: m.entityType,
          entityId: m.entityId,
          operation: m.operation,
          payload: m.payload,
        })),
      }),
    });
    if (!res.ok) throw new Error(`push ${res.status}`);
    const data = (await res.json()) as { applied: string[]; skipped: string[] };
    const appliedSet = new Set([...data.applied, ...data.skipped]);
    const remaining = loadQueue(userId).filter((m) => !appliedSet.has(m.mutationId));
    saveQueue(remaining, userId);
    options?.onStatus?.(remaining.length === 0 ? "synced" : "pending");
    return { applied: appliedSet.size, failed: 0 };
  } catch {
    const attempted = new Set(queue.map((m) => m.mutationId));
    const failed = loadQueue(userId).map((m) => attempted.has(m.mutationId)
      ? { ...m, attempts: m.attempts + 1, status: "failed" as const }
      : m);
    saveQueue(failed, userId);
    options?.onStatus?.(navigator.onLine === false ? "offline" : "failed");
    return { applied: 0, failed: queue.length };
  }
}

export interface AutoSyncOptions {
  active: () => boolean;
  push: () => Promise<{ failed: number }>;
  pull: () => Promise<Record<string, unknown> | null>;
  hydrate: (remote: Record<string, unknown>) => void;
  pending: () => number;
  onStatus: (status: SyncStatus) => void;
}

/** One background sync attempt; never hydrates stale cloud data after a failed push. */
export async function runAutoSync(options: AutoSyncOptions): Promise<"synced" | "pending" | "failed" | "cancelled"> {
  if (!options.active()) return "cancelled";
  options.onStatus("syncing");
  try {
    const pushed = await options.push();
    if (!options.active()) return "cancelled";
    if (pushed.failed > 0) {
      options.onStatus("failed");
      return "failed";
    }
    const remote = await options.pull();
    if (!options.active()) return "cancelled";
    if (!remote) {
      options.onStatus("failed");
      return "failed";
    }
    // A local edit may arrive while pull is in flight. Push it before applying
    // the fetched snapshot, so hydrate cannot treat the newer edit as remote.
    if (options.pending() > 0) {
      options.onStatus("pending");
      return "pending";
    }
    options.hydrate(remote);
    if (!options.active()) return "cancelled";
    const status = options.pending() > 0 ? "pending" : "synced";
    options.onStatus(status);
    return status;
  } catch {
    if (options.active()) options.onStatus("failed");
    return options.active() ? "failed" : "cancelled";
  }
}

export async function pullRemote(options?: { fetchImpl?: typeof fetch }): Promise<Record<string, unknown> | null> {
  const fetchImpl = options?.fetchImpl ?? fetch;
  try {
    const res = await fetchImpl("/api/sync/pull");
    if (!res.ok) return null;
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function backoffDelay(attempts: number): number {
  return Math.min(300_000, 1000 * Math.pow(2, Math.min(attempts, 8)));
}
