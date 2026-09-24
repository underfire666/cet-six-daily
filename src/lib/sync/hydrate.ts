"use client";

import { getSyncUserId } from "@/lib/sync/adapters";
import { getStorageForNamespace } from "@/lib/storage/scoped";
import { publishRemoteHydrate } from "@/lib/storage/hydration-events";
import { applyPullToDomainStores, type PullResponse } from "./restore";

export type { PullResponse } from "./restore";

/** Apply a pull only to the account that is still mounted in this tab. */
export function hydrateFromPull(userId: string, data: PullResponse) {
  if (typeof window === "undefined" || !userId || getSyncUserId() !== userId) return [];
  const storage = getStorageForNamespace({ type: "user", id: userId });
  if (!storage) return [];
  const domains = applyPullToDomainStores(storage, data);
  publishRemoteHydrate(userId, domains);
  return domains;
}
