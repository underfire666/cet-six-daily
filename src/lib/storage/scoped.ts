// Scoped storage wrapper: presents a KeyStorage interface that automatically
// prefixes all keys with the current user scope.
//
// - guest: legacy keys as-is (backwards compatible with V4–V11 data)
// - user:<id>: keys become `user:<id>:<legacyKey>`
//
// Providers call getScopedStorage() on mount; because AccountResetGate remounts
// the whole provider tree when userId changes, each mount sees the right scope.

import type { KeyStorage } from "@/lib/lesson/storage";
import { nsKey, type Namespace } from "@/lib/storage/namespace";
import { getSyncUserId } from "@/lib/sync/adapters";

function resolveNamespace(): Namespace {
  const uid = getSyncUserId();
  return uid ? { type: "user", id: uid } : "guest";
}

export function getScopedStorage(): KeyStorage | undefined {
  if (typeof window === "undefined") return undefined;
  return getStorageForNamespace(resolveNamespace());
}

/** Resolve a repository storage adapter for an explicit namespace. */
export function getStorageForNamespace(ns: Namespace): KeyStorage | undefined {
  if (typeof window === "undefined") return undefined;
  const legacy = window.localStorage;

  return {
    get length() {
      // Only count keys under our scope.
      let n = 0;
      for (let i = 0; i < legacy.length; i++) {
        const k = legacy.key(i);
        if (k && isInScope(k, ns)) n++;
      }
      return n;
    },
    key(index: number) {
      let n = 0;
      for (let i = 0; i < legacy.length; i++) {
        const k = legacy.key(i);
        if (k && isInScope(k, ns)) {
          if (n === index) return stripScope(k, ns);
          n++;
        }
      }
      return null;
    },
    getItem(key: string) {
      return legacy.getItem(nsKey(ns, key));
    },
    setItem(key: string, value: string) {
      legacy.setItem(nsKey(ns, key), value);
    },
    removeItem(key: string) {
      legacy.removeItem(nsKey(ns, key));
    },
  };
}

function isInScope(fullKey: string, ns: Namespace): boolean {
  if (ns === "guest") {
    // Guest sees only legacy keys (no user: prefix).
    return !fullKey.startsWith("user:");
  }
  return fullKey.startsWith(`user:${ns.id}:`);
}

function stripScope(fullKey: string, ns: Namespace): string {
  if (ns === "guest") return fullKey;
  const prefix = `user:${ns.id}:`;
  return fullKey.startsWith(prefix) ? fullKey.slice(prefix.length) : fullKey;
}
