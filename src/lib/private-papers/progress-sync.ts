/**
 * V14 Phase 1E.1 — Private study progress cloud sync adapter.
 *
 * Reuses the V12 queue *data structure* (localStorage, per-user key, mutationId
 * idempotency, snapshot merge via MERGE_POLICY["privateProgress"]) but pushes to
 * a dedicated per-paper PUT endpoint that supports revision optimistic-concurrency
 * and attemptId isolation.
 *
 * PRIVATE progress never enters the global LearningSession / XP / Review /
 * Daily Plan: it only ever enqueues entityType="privateProgress", and is pushed
 * by pushPrivateProgressQueue (NOT by the global /api/sync/push batch).
 */

import {
  enqueueMutation,
  loadQueue,
  saveQueue,
  type QueuedMutation,
} from "@/lib/sync/client";

export interface PrivateProgressPayload {
  attemptId: string;
  contentHash: string;
  answers: Record<number, string>;
  currentIndex: number;
  submitted: boolean;
  /** Revision the client based this write on; 0 when creating. */
  baseRevision: number;
}

export interface RemoteProgress {
  paperId: string;
  attemptId: string;
  contentHash: string;
  answers: Record<number, string>;
  currentIndex: number;
  submitted: boolean;
  revision: number;
  updatedAt: string;
}

export type PrivateSyncStatus = "local_saved" | "pending" | "synced" | "failed" | "conflict";

export interface PushPrivateProgressResult {
  /** Mutations accepted by the server (got a new revision). */
  applied: number;
  /** Mutations kept in the queue after a network/other error. */
  failed: number;
  /** paperIds that hit a revision_conflict and need a user decision. */
  conflicts: string[];
  /** paperId -> new revision for every mutation that was just applied. */
  revisions: Record<string, number>;
}

// Mirror of the (non-exported) activeUserId in sync/client.ts so we do not have
// to modify that file beyond the MERGE_POLICY entry. setSyncUserId writes this.
function activeUserId(): string | null {
  if (typeof window === "undefined") return null;
  return (window as unknown as { __CET_SYNC_USER_ID?: string }).__CET_SYNC_USER_ID ?? null;
}

function progressUrl(paperId: string): string {
  return `/api/private-papers/${encodeURIComponent(paperId)}/progress`;
}

/** Generate a fresh attemptId for a new practice round. */
export function generateAttemptId(): string {
  return crypto.randomUUID();
}

/**
 * Enqueue a private-progress snapshot for a paper. Because the merge policy is
 * "snapshot", any prior queued mutation for the same (user, paperId) is
 * collapsed — only the newest state survives.
 */
export function enqueuePrivateProgress(paperId: string, payload: PrivateProgressPayload): QueuedMutation {
  return enqueueMutation({
    entityType: "privateProgress",
    entityId: paperId,
    operation: "upsert",
    payload: payload as unknown as Record<string, unknown>,
  });
}

/** Load only the privateProgress mutations queued for this user. */
export function loadPrivateProgressQueue(userId: string): QueuedMutation[] {
  return loadQueue(userId).filter((m) => m.entityType === "privateProgress");
}

/** Remove every queued privateProgress mutation for one paper (adopt cloud / restart). */
export function clearPrivateProgressForPaper(userId: string, paperId: string): void {
  const remaining = loadQueue(userId).filter(
    (m) => !(m.entityType === "privateProgress" && m.entityId === paperId),
  );
  saveQueue(remaining, userId);
}

/** Normalize a raw server progress object (answers keys are strings) into RemoteProgress. */
function normalizeRemoteProgress(paperId: string, raw: Record<string, unknown>): RemoteProgress {
  const rawAnswers = (raw.answers ?? {}) as Record<string, unknown>;
  const answers: Record<number, string> = {};
  for (const [key, value] of Object.entries(rawAnswers)) {
    if (!/^(0|[1-9][0-9]*)$/.test(key) || !Number.isSafeInteger(Number(key))) continue;
    if (typeof value !== "string") continue;
    answers[Number(key)] = value;
  }
  return {
    paperId,
    attemptId: typeof raw.attemptId === "string" ? raw.attemptId : "",
    contentHash: typeof raw.contentHash === "string" ? raw.contentHash : "",
    answers,
    currentIndex: typeof raw.currentIndex === "number" ? raw.currentIndex : 0,
    submitted: raw.submitted === true,
    revision: typeof raw.revision === "number" ? raw.revision : 0,
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : "",
  };
}

/**
 * Push queued privateProgress mutations to the cloud, one PUT per paper.
 *
 * - 200                       -> applied; removed from queue; new revision surfaced.
 * - 404                       -> paper deleted; removed from queue (do not rebuild).
 * - 409 attempt_mismatch       -> stale practice round; removed from queue.
 * - 409 revision_conflict     -> kept in queue, fire onConflict with server progress.
 * - other error / network     -> kept in queue, counted as failed (manual retry).
 */
export async function pushPrivateProgressQueue(options: {
  userId: string;
  fetchImpl?: typeof fetch;
  onConflict?: (paperId: string, serverProgress: RemoteProgress) => void;
}): Promise<PushPrivateProgressResult> {
  const { userId, onConflict } = options;
  const fetchImpl = options.fetchImpl ?? fetch;
  const empty: PushPrivateProgressResult = { applied: 0, failed: 0, conflicts: [], revisions: {} };

  // Account-switch guard: never push a captured queue after the browser switched accounts.
  if (!userId || activeUserId() !== userId) {
    return { ...empty, failed: loadPrivateProgressQueue(userId).length };
  }

  const queue = loadPrivateProgressQueue(userId);
  if (queue.length === 0) return empty;

  const removed = new Set<string>();
  const revisions: Record<string, number> = {};
  const conflicts: string[] = [];
  let applied = 0;
  let failed = 0;

  for (const mutation of queue) {
    if (activeUserId() !== userId) break; // account switched mid-batch; stop.
    const paperId = mutation.entityId;
    const payload = mutation.payload as unknown as PrivateProgressPayload;
    try {
      const res = await fetchImpl(progressUrl(paperId), {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.status === 409) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
          serverProgress?: Record<string, unknown>;
        };
        if (data.error === "revision_conflict") {
          conflicts.push(paperId);
          if (data.serverProgress) onConflict?.(paperId, normalizeRemoteProgress(paperId, data.serverProgress));
          // Keep in queue; the user decides via the conflict dialog.
          continue;
        }
        if (data.error === "attempt_mismatch") {
          removed.add(mutation.mutationId); // stale practice round
          continue;
        }
        // content_changed / not_ready / other 409: keep, surface as failed.
        failed += 1;
        continue;
      }

      if (res.status === 404) {
        removed.add(mutation.mutationId); // paper deleted
        continue;
      }

      if (!res.ok) {
        failed += 1;
        continue;
      }

      const data = (await res.json()) as { ok?: boolean; revision?: number };
      if (data.ok === true && typeof data.revision === "number") {
        removed.add(mutation.mutationId);
        revisions[paperId] = data.revision;
        applied += 1;
      } else {
        failed += 1;
      }
    } catch {
      // Network error: keep in queue for a later retry.
      failed += 1;
    }
  }

  // Rebuild the queue: drop removed mutations; leave failed/conflict ones in place.
  const remaining = loadQueue(userId).filter((m) => !removed.has(m.mutationId));
  saveQueue(remaining, userId);

  return { applied, failed, conflicts, revisions };
}

/**
 * Fetch the current user's cloud progress for a paper.
 * Returns null when there is no record, the paper is gone, or the contentHash
 * no longer matches (the server returns exists:false in that case).
 */
export async function fetchRemoteProgress(
  paperId: string,
  fetchImpl?: typeof fetch,
): Promise<RemoteProgress | null> {
  const impl = fetchImpl ?? fetch;
  try {
    const res = await impl(progressUrl(paperId), { cache: "no-store" });
    if (res.status === 404) return null;
    if (!res.ok) return null;
    const data = (await res.json()) as {
      exists?: boolean;
      progress?: Record<string, unknown> | null;
    };
    if (data.exists !== true || !data.progress) return null;
    return normalizeRemoteProgress(paperId, data.progress);
  } catch {
    return null;
  }
}
