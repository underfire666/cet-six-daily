"use client";

import { getSyncUserId } from "@/lib/sync/adapters";

export const REMOTE_HYDRATE_EVENT = "cet-daily:remote-hydrate";

export type HydratedDomain =
  | "profile"
  | "study"
  | "vocabulary"
  | "reading"
  | "listening"
  | "translation"
  | "writing"
  | "dailyPlan"
  | "review";

interface RemoteHydrateDetail {
  userId: string;
  domains: HydratedDomain[];
}

export function publishRemoteHydrate(userId: string, domains: HydratedDomain[]) {
  if (typeof window === "undefined" || domains.length === 0) return;
  window.dispatchEvent(
    new CustomEvent<RemoteHydrateDetail>(REMOTE_HYDRATE_EVENT, {
      detail: { userId, domains },
    }),
  );
}

export function subscribeRemoteHydrate(
  domains: HydratedDomain[],
  callback: () => void,
): () => void {
  if (typeof window === "undefined") return () => {};
  const interested = new Set(domains);
  const onHydrate = (event: Event) => {
    const detail = (event as CustomEvent<RemoteHydrateDetail>).detail;
    if (
      !detail ||
      detail.userId !== getSyncUserId() ||
      !detail.domains.some((domain) => interested.has(domain))
    )
      return;
    callback();
  };
  window.addEventListener(REMOTE_HYDRATE_EVENT, onHydrate);
  return () => window.removeEventListener(REMOTE_HYDRATE_EVENT, onHydrate);
}
