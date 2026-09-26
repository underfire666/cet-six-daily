// V12 namespaced local cache.
// Guest keeps legacy keys untouched (no data loss).
// Logged-in users read/write under `user:<id>:` prefix.
// Legacy -> namespaced migration copies values once, never deletes the originals.

export type Namespace = "guest" | { type: "user"; id: string };

export function nsKey(ns: Namespace, legacyKey: string): string {
  if (ns === "guest") return legacyKey;
  return `user:${ns.id}:${legacyKey}`;
}

const MIGRATED_FLAG = "cet-daily:v12:namespaced-migrated";

export function migrateLegacyToNamespace(userId: string) {
  if (typeof window === "undefined") return;
  if (localStorage.getItem(`${MIGRATED_FLAG}:${userId}`)) return;
  const legacyKeys = [
    "cet-daily:v1:study",
    "cet-daily:v3:vocabulary",
    "cet-daily:v1:reading",
    "cet-daily:v1:listening",
    "cet-daily:v1:translation",
    "cet-daily:v1:writing",
    "cet-daily:v1:daily-plan",
    "cet-daily:v1:review",
    "cet-daily:v1:profile",
  ];
  for (const k of legacyKeys) {
    const v = localStorage.getItem(k);
    if (v != null) {
      localStorage.setItem(nsKey({ type: "user", id: userId }, k), v);
    }
  }
  localStorage.setItem(`${MIGRATED_FLAG}:${userId}`, new Date().toISOString());
}

export function clearUserNamespace(userId: string) {
  if (typeof window === "undefined") return;
  const prefix = `user:${userId}:`;
  const toRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(prefix)) toRemove.push(k);
  }
  for (const k of toRemove) localStorage.removeItem(k);
}
