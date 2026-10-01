/** Separate owner-scoped PRIVATE queue; immutable attempted requests survive lost replies. */
import { getSyncIdentityGeneration } from "@/lib/sync/adapters";
import { loadQueue, saveQueue, type QueuedMutation } from "@/lib/sync/client";
export interface PrivateProgressPayload {
  attemptId: string; contentHash: string; answers: Record<number, string>; currentIndex: number;
  submitted: boolean; baseRevision: number; mode?: "save" | "restart";
}
export interface RemoteProgress extends PrivateProgressPayload { paperId: string; progressVersion: number; revision: number; updatedAt: string; }
export interface RemoteSnapshot { progress: RemoteProgress | null; revision: number; invalidated: boolean; }
export type PrivateSyncStatus = "local_saved" | "pending" | "synced" | "failed" | "conflict";
export interface PushPrivateProgressResult { applied: number; failed: number; conflicts: string[]; revisions: Record<string, number>; invalid: Record<string, string>; pending: number; wrongItemsRecorded: Record<string, number>; }
interface PrivateMutation extends QueuedMutation { blocked?: boolean; }
export const PRIVATE_PROGRESS_SYNC_EVENT = "cet-daily:private-progress-synced";
const activeUserId = (): string | null => typeof window === "undefined" ? null : (window as unknown as { __CET_SYNC_USER_ID?: string }).__CET_SYNC_USER_ID ?? null;
const queueKey = (userId: string) => `cet-daily:v14:private-progress-queue:${userId}`;
const progressUrl = (paperId: string) => `/api/private-papers/${encodeURIComponent(paperId)}/progress`;
export const generateAttemptId = () => crypto.randomUUID();
function savePrivateQueue(userId: string, queue: PrivateMutation[]) { localStorage.setItem(queueKey(userId), JSON.stringify(queue)); }
export function loadPrivateProgressQueue(userId: string): PrivateMutation[] {
  const raw = localStorage.getItem(queueKey(userId));
  const parsed: unknown = raw ? JSON.parse(raw) : [];
  if (!Array.isArray(parsed)) throw new Error("Invalid PRIVATE queue");
  // Migrate legacy PRIVATE records only after successfully persisting their new queue.
  const legacy = loadQueue(userId).filter(m => m.entityType === "privateProgress");
  if (legacy.length) {
    const combined = [...parsed, ...legacy.filter(m => !parsed.some(q => q.mutationId === m.mutationId))];
    savePrivateQueue(userId, combined);
    saveQueue(loadQueue(userId).filter(m => m.entityType !== "privateProgress"), userId);
    return combined;
  }
  return parsed;
}
export function enqueuePrivateProgress(paperId: string, payload: PrivateProgressPayload): PrivateMutation {
  const userId = activeUserId();
  if (!userId) throw new Error("Authenticated owner required");
  const queue = loadPrivateProgressQueue(userId);
  const previous = queue.find(m => m.entityId === paperId && m.status === "pending" && !m.blocked);
  const prior = previous?.payload as unknown as PrivateProgressPayload | undefined;
  const merged = { ...payload, mode: prior?.attemptId === payload.attemptId && prior.mode === "restart" ? "restart" : payload.mode ?? "save" };
  const mutation: PrivateMutation = { mutationId: crypto.randomUUID(), entityType: "privateProgress", entityId: paperId, operation: "upsert", payload: merged, createdAt: new Date().toISOString(), attempts: 0, status: "pending" };
  savePrivateQueue(userId, [...queue.filter(m => m !== previous), mutation]);
  return mutation;
}
export function discardPrivateProgressForOtherContent(userId: string, paperId: string, contentHash: string) {
  const queue = loadPrivateProgressQueue(userId);
  savePrivateQueue(userId, queue.filter(m => m.entityId !== paperId || m.payload.contentHash === contentHash));
}
export function clearPrivateProgressForPaper(userId: string, paperId: string) { savePrivateQueue(userId, loadPrivateProgressQueue(userId).filter(m => m.entityId !== paperId)); }
const record = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === "object" && !Array.isArray(v);
export function normalizeRemoteProgress(paperId: string, raw: unknown): RemoteProgress {
  if (!record(raw) || raw.paperId !== paperId || raw.progressVersion !== 1 || typeof raw.attemptId !== "string" || !raw.attemptId || typeof raw.contentHash !== "string" || !raw.contentHash || !record(raw.answers) || !Number.isSafeInteger(raw.currentIndex) || Number(raw.currentIndex) < 0 || !Number.isSafeInteger(raw.revision) || Number(raw.revision) < 1 || typeof raw.submitted !== "boolean" || typeof raw.updatedAt !== "string") throw new Error("Invalid cloud progress");
  const answers: Record<number, string> = {};
  for (const [k, v] of Object.entries(raw.answers)) {
    if (!/^(0|[1-9][0-9]*)$/.test(k) || !Number.isSafeInteger(Number(k)) || typeof v !== "string") throw new Error("Invalid cloud answers");
    answers[Number(k)] = v;
  }
  return { paperId, progressVersion: 1, attemptId: raw.attemptId, contentHash: raw.contentHash, answers, currentIndex: Number(raw.currentIndex), submitted: raw.submitted, revision: Number(raw.revision), baseRevision: Number(raw.revision), updatedAt: raw.updatedAt };
}
export async function fetchRemoteSnapshot(paperId: string, fetchImpl: typeof fetch = fetch): Promise<RemoteSnapshot> {
  const res = await fetchImpl(progressUrl(paperId), { cache: "no-store" });
  if (!res.ok) throw new Error(`Cloud read ${res.status}`);
  const data: unknown = await res.json();
  if (!record(data) || typeof data.exists !== "boolean") throw new Error("Invalid cloud snapshot");
  if (data.exists) { const progress = normalizeRemoteProgress(paperId, data.progress); return { progress, revision: progress.revision, invalidated: false }; }
  if (data.progress !== null || !Number.isSafeInteger(data.revision) || Number(data.revision) < 0 || typeof data.invalidated !== "boolean") throw new Error("Invalid empty cloud snapshot");
  return { progress: null, revision: Number(data.revision), invalidated: data.invalidated };
}
export async function fetchRemoteProgress(paperId: string, fetchImpl?: typeof fetch) { return (await fetchRemoteSnapshot(paperId, fetchImpl)).progress; }
const inFlight = new Map<string, Promise<PushPrivateProgressResult>>();
export function pushPrivateProgressQueue(options: { userId: string; paperId?: string; fetchImpl?: typeof fetch; onConflict?: (paperId: string, server: RemoteProgress) => void }): Promise<PushPrivateProgressResult> {
  const running = inFlight.get(options.userId);
  if (running) return running.then(() => pushPrivateProgressQueue(options));
  const task = pushPrivateQueue(options).finally(() => { if (inFlight.get(options.userId) === task) inFlight.delete(options.userId); });
  inFlight.set(options.userId, task);
  return task;
}
async function pushPrivateQueue({ userId, paperId: onlyPaper, fetchImpl = fetch, onConflict }: { userId: string; paperId?: string; fetchImpl?: typeof fetch; onConflict?: (paperId: string, server: RemoteProgress) => void }): Promise<PushPrivateProgressResult> {
  const result: PushPrivateProgressResult = { applied: 0, failed: 0, conflicts: [], revisions: {}, invalid: {}, pending: 0, wrongItemsRecorded: {} };
  if (!userId || activeUserId() !== userId) { result.failed = loadPrivateProgressQueue(userId).length; return result; }
  const generation = getSyncIdentityGeneration();
  const active = () => activeUserId() === userId && getSyncIdentityGeneration() === generation;
  const attempted = new Set<string>();
  for (let count = 0; count < 30 && active(); count++) {
    const item = loadPrivateProgressQueue(userId).find(m => (!onlyPaper || m.entityId === onlyPaper) && !m.blocked && !attempted.has(m.mutationId));
    if (!item) break;
    const paperId = item.entityId, payload = item.payload as unknown as PrivateProgressPayload;
    attempted.add(item.mutationId);
    // Once sent, keep its ID and payload unchanged until an acknowledgement arrives.
    savePrivateQueue(userId, loadPrivateProgressQueue(userId).map(m => m.mutationId === item.mutationId ? { ...m, status: "syncing", attempts: m.attempts + 1 } : m));
    try {
      const res = await fetchImpl(progressUrl(paperId), { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...payload, progressVersion: 1, mutationId: item.mutationId }) });
      if (!active()) break;
      const data: unknown = await res.json();
      if (!record(data)) throw new Error("Invalid progress response");
      if (res.status === 409 && (data.error === "revision_conflict" || data.error === "attempt_mismatch")) {
        result.conflicts.push(paperId);
        savePrivateQueue(userId, loadPrivateProgressQueue(userId).map(m => m.entityId === paperId ? { ...m, blocked: true, status: "failed" } : m));
        if (data.serverProgress) onConflict?.(paperId, normalizeRemoteProgress(paperId, data.serverProgress));
        continue;
      }
      if (res.status === 404 || res.status === 410 || data.error === "not_ready") {
        result.invalid[paperId] = String(data.error ?? "not_found");
        const queue = loadPrivateProgressQueue(userId);
        savePrivateQueue(userId, res.status === 404 ? queue.filter(m => m.entityId !== paperId) : queue.map(m => m.entityId === paperId ? { ...m, blocked: true, status: "failed" } : m));
        continue;
      }
      if (!res.ok || data.ok !== true || !Number.isSafeInteger(data.revision) || Number(data.revision) < 1) throw new Error("Progress write failed");
      const revision = Number(data.revision);
      const current = loadPrivateProgressQueue(userId);
      // If the user already replaced this practice round, its old reply has no effect.
      const stillQueued = current.some(m => m.mutationId === item.mutationId);
      if (!stillQueued) continue;
      const remaining = current.filter(m => m.mutationId !== item.mutationId).map(m => {
        const next = m.payload as unknown as PrivateProgressPayload;
        return m.entityId === paperId && m.status === "pending" && next.attemptId === payload.attemptId && next.contentHash === payload.contentHash
          ? { ...m, payload: { ...next, baseRevision: revision, mode: "save" } } : m;
      });
      savePrivateQueue(userId, remaining);
      result.applied++; result.revisions[paperId] = revision;
      if (Number.isSafeInteger(data.wrongItemsRecorded) && Number(data.wrongItemsRecorded) > 0) result.wrongItemsRecorded[paperId] = Number(data.wrongItemsRecorded);
      window.dispatchEvent(new CustomEvent(PRIVATE_PROGRESS_SYNC_EVENT, { detail: { userId, paperId, attemptId: payload.attemptId, contentHash: payload.contentHash, revision, wrongItemsRecorded: Number.isSafeInteger(data.wrongItemsRecorded) ? Number(data.wrongItemsRecorded) : 0 } }));
    } catch {
      if (!active()) break;
      savePrivateQueue(userId, loadPrivateProgressQueue(userId).map(m => m.mutationId === item.mutationId ? { ...m, status: "failed" } : m));
      result.failed++;
      // A failed/ambiguous earlier write must be replayed before any later snapshot.
      break;
    }
  }
  const remaining = loadPrivateProgressQueue(userId).filter(m => !onlyPaper || m.entityId === onlyPaper);
  result.conflicts = [...new Set([...result.conflicts, ...remaining.filter(m => m.blocked).map(m => m.entityId)])];
  result.pending = remaining.length;
  return result;
}
