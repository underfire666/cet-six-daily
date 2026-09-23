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

const QUEUE_KEY = "cet-daily:v12:sync-queue";

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

export function loadQueue(): QueuedMutation[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveQueue(queue: QueuedMutation[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
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

export async function pushQueue(options?: {
  onStatus?: (s: SyncStatus) => void;
  fetchImpl?: typeof fetch;
}): Promise<{ applied: number; failed: number }> {
  const fetchImpl = options?.fetchImpl ?? fetch;
  const queue = loadQueue().filter((m) => m.status !== "syncing");
  if (queue.length === 0) return { applied: 0, failed: 0 };

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
    const remaining = loadQueue().filter((m) => !appliedSet.has(m.mutationId));
    saveQueue(remaining);
    options?.onStatus?.(remaining.length === 0 ? "synced" : "pending");
    return { applied: appliedSet.size, failed: 0 };
  } catch {
    const failed = loadQueue().map((m) => ({ ...m, attempts: m.attempts + 1, status: "failed" as const }));
    saveQueue(failed);
    options?.onStatus?.(navigator.onLine === false ? "offline" : "failed");
    return { applied: 0, failed: failed.length };
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
