"use client";

import { useSession } from "next-auth/react";
import { useEffect } from "react";
import { getSyncUserId } from "@/lib/sync/adapters";
import { loadQueue, publishSyncStatus, pushQueue, pullRemote, runAutoSync, type SyncStatus } from "@/lib/sync/client";
import { hydrateFromPull } from "@/lib/sync/hydrate";

// SyncProvider: sits inside the app shell, listens to online/offline events,
// and triggers background push/pull when the user is authenticated.
// Guest mode: no auto sync (queue stays empty).

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const { status, data } = useSession();

  useEffect(() => {
    if (status !== "authenticated" || !data?.user?.id) return;
    const userId = data.user.id;
    let mounted = true;
    let busy = false;
    let rerun = false;
    const active = () => mounted && getSyncUserId() === userId;
    const online = () => navigator.onLine !== false;
    const report = (next: SyncStatus) => {
      if (active()) publishSyncStatus(userId, navigator.onLine === false && next === "failed" ? "offline" : next);
    };

    async function syncOnce() {
      if (!active()) return;
      if (!online()) {
        report("offline");
        return;
      }
      if (busy) {
        rerun = true;
        return;
      }
      busy = true;
      try {
        let attempts = 0;
        let outcome: Awaited<ReturnType<typeof runAutoSync>>;
        do {
          rerun = false;
          attempts++;
          outcome = await runAutoSync({
            active,
            push: () => pushQueue({ userId }),
            pull: () => pullRemote(),
            hydrate: (remote) => hydrateFromPull(userId, remote as Parameters<typeof hydrateFromPull>[1]),
            pending: () => loadQueue(userId).length,
            onStatus: report,
          });
        } while (active() && online() && attempts < 3 && (rerun || outcome === "pending"));
      } finally {
        busy = false;
      }
    }

    void syncOnce();

    const onOnline = () => void syncOnce();
    const onOffline = () => report("offline");
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    const interval = setInterval(() => void syncOnce(), 60_000);
    return () => {
      mounted = false;
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      clearInterval(interval);
    };
  }, [status, data?.user?.id]);

  return <>{children}</>;
}
