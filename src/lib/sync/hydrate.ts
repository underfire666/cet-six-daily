// Pull hydrate: take the /api/sync/pull response and write it into the user-scoped
// local cache so existing Providers can read it on next render.
// Guest scope is never touched.

import { nsKey } from "@/lib/storage/namespace";

interface PullResponse {
  profile?: Record<string, unknown> | null;
  preferences?: { payload?: unknown } | null;
  settings?: { payload?: unknown } | null;
  xpEvents?: Array<{ eventId: string; source: string; sourceId: string; amount: number; earnedAt: string }>;
  sessions?: Array<Record<string, unknown>>;
  wordbook?: Array<{ wordId: string; source?: string | null; addedAt: string; removedAt?: string | null }>;
  reviewItems?: Array<Record<string, unknown>>;
  dailyPlans?: Array<{ planDate: string; payload: unknown }>;
  pulledAt?: string;
}

export function hydrateFromPull(userId: string, data: PullResponse) {
  if (typeof window === "undefined") return;
  const ns = { type: "user" as const, id: userId };

  if (data.profile) {
    const existing = readLocal(nsKey(ns, "cet-daily:v1:profile"));
    const merged = {
      ...existing,
      targetScore: data.profile.targetScore ?? existing?.targetScore,
      examDate: data.profile.examDate ? new Date(data.profile.examDate as string).toISOString().slice(0, 10) : existing?.examDate,
      reminders: data.profile.reminders ?? existing?.reminders,
      sound: data.profile.sound ?? existing?.sound,
    };
    writeLocal(nsKey(ns, "cet-daily:v1:profile"), merged);
  }
  if (data.preferences?.payload) {
    writeLocal(nsKey(ns, "cet-daily:v1:study-preferences"), data.preferences.payload);
  }
  if (data.settings?.payload) {
    writeLocal(nsKey(ns, "cet-daily:v1:settings"), data.settings.payload);
  }
  if (Array.isArray(data.xpEvents)) {
    const ledger: Record<string, { eventId: string; amount: number; source: string; earnedAt: string }> = {};
    for (const e of data.xpEvents) ledger[e.eventId] = { eventId: e.eventId, amount: e.amount, source: e.source, earnedAt: e.earnedAt };
    writeLocal(nsKey(ns, "cet-daily:v1:xp-ledger"), { events: Object.values(ledger) });
  }
  if (Array.isArray(data.sessions)) {
    writeLocal(nsKey(ns, "cet-daily:v1:sessions"), { sessions: data.sessions });
  }
  if (Array.isArray(data.wordbook)) {
    writeLocal(nsKey(ns, "cet-daily:v1:wordbook"), {
      entries: data.wordbook.filter((w) => !w.removedAt).map((w) => ({ wordId: w.wordId, source: w.source, addedAt: w.addedAt })),
    });
  }
  if (Array.isArray(data.reviewItems)) {
    writeLocal(nsKey(ns, "cet-daily:v1:review"), { items: data.reviewItems.filter((r) => !r.removedAt) });
  }
  if (Array.isArray(data.dailyPlans)) {
    writeLocal(nsKey(ns, "cet-daily:v1:daily-plan"), { plans: data.dailyPlans });
  }
  if (data.pulledAt) {
    writeLocal(nsKey(ns, "cet-daily:v12:last-sync"), { at: data.pulledAt });
  }
}

function readLocal(key: string): Record<string, unknown> | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function writeLocal(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value));
}
