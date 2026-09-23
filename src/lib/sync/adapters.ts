// Domain-level sync adapters: call these from stores/services after a successful
// local mutation. They no-op when the user is a guest (no session).
//
// Local-first: call the local write first, then enqueue. The queue is keyed by
// the current user id so User A's pending mutations never get pushed as User B's.

"use client";

import { enqueueMutation } from "@/lib/sync/client";
import { useSession } from "next-auth/react";
import { useCallback } from "react";

// Track current user id at module level so non-React callers (e.g. stores)
// can enqueue without threading a hook through every function.
let currentUserId: string | null = null;

export function setSyncUserId(userId: string | null) {
  currentUserId = userId;
  if (typeof window !== "undefined") {
    (window as unknown as { __CET_SYNC_USER_ID?: string }).__CET_SYNC_USER_ID = userId ?? undefined;
  }
}

export function getSyncUserId() {
  return currentUserId;
}

function isLoggedIn() {
  return typeof window !== "undefined" && Boolean(currentUserId);
}

function withUserScope(m: Parameters<typeof enqueueMutation>[0]) {
  if (!isLoggedIn()) return null;
  return enqueueMutation(m);
}

// ---- Domain enqueues ----

export function enqueueXpEvent(opts: {
  eventId: string;
  source: string;
  sourceId: string;
  amount: number;
  earnedAt?: string;
}) {
  return withUserScope({
    entityType: "xpEvent",
    entityId: opts.eventId,
    operation: "upsert",
    payload: {
      eventId: opts.eventId,
      source: opts.source,
      sourceId: opts.sourceId,
      amount: opts.amount,
      earnedAt: opts.earnedAt ?? new Date().toISOString(),
    },
  });
}

export function enqueueSession(opts: {
  sessionId: string;
  module: string;
  activityId: string;
  planDate?: string;
  startedAt: string;
  completedAt?: string;
  durationSec?: number;
  status?: string;
  payload?: Record<string, unknown>;
}) {
  return withUserScope({
    entityType: "session",
    entityId: opts.sessionId,
    operation: "upsert",
    payload: opts,
  });
}

export function enqueueWordbook(opts: {
  wordId: string;
  source?: string;
  addedAt?: string;
  removed?: boolean;
}) {
  return withUserScope({
    entityType: "wordbook",
    entityId: opts.wordId,
    operation: opts.removed ? "remove" : "upsert",
    payload: {
      wordId: opts.wordId,
      source: opts.source ?? null,
      addedAt: opts.addedAt ?? new Date().toISOString(),
    },
  });
}

export function enqueueReviewItem(opts: {
  reviewItemId: string;
  sourceModule: string;
  activityId: string;
  questionId: string;
  status?: string;
  mastery?: string;
  dueDate?: string;
  priority?: number;
  version?: number;
  removed?: boolean;
}) {
  return withUserScope({
    entityType: "reviewItem",
    entityId: opts.reviewItemId,
    operation: opts.removed ? "remove" : "upsert",
    payload: {
      ...opts,
      removedAt: opts.removed ? new Date().toISOString() : null,
      version: opts.version ?? 1,
    },
  });
}

export function enqueueDailyPlan(opts: {
  planDate: string;
  completedTaskIds: string[];
}) {
  return withUserScope({
    entityType: "dailyPlan",
    entityId: opts.planDate,
    operation: "upsert",
    payload: { completedTaskIds: opts.completedTaskIds },
  });
}

export function enqueueProfile(opts: Record<string, unknown>) {
  return withUserScope({
    entityType: "profile",
    entityId: "me",
    operation: "upsert",
    payload: opts,
  });
}

export function enqueuePreferences(payload: Record<string, unknown>) {
  return withUserScope({
    entityType: "preferences",
    entityId: "me",
    operation: "upsert",
    payload: { payload },
  });
}

export function enqueueSettings(payload: Record<string, unknown>) {
  return withUserScope({
    entityType: "settings",
    entityId: "me",
    operation: "upsert",
    payload: { payload },
  });
}

export function enqueueTranslationHistory(opts: {
  itemId: string;
  promptId: string;
  answer: string;
  feedback?: Record<string, unknown>;
}) {
  return withUserScope({
    entityType: "translationHistory",
    entityId: opts.itemId,
    operation: "upsert",
    payload: opts,
  });
}

export function enqueueWritingHistory(opts: {
  itemId: string;
  promptId: string;
  answer: string;
  feedback?: Record<string, unknown>;
}) {
  return withUserScope({
    entityType: "writingHistory",
    entityId: opts.itemId,
    operation: "upsert",
    payload: opts,
  });
}

// React hook: subscribe to session changes and keep the module-level user id
// in sync. Use this at the top of the app shell.
export function useSyncUserIdSync() {
  const { status, data } = useSession();
  const userId = status === "authenticated" ? (data?.user?.id ?? null) : null;
  const setId = useCallback((id: string | null) => setSyncUserId(id), []);
  // Module-level subscription: set on every render that sees a userId change.
  if (currentUserId !== userId) setId(userId);
  return userId;
}

