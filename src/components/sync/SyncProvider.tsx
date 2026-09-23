"use client";

import { useSession } from "next-auth/react";
import { useEffect, useRef } from "react";
import { loadQueue, pushQueue, pullRemote } from "@/lib/sync/client";
import { hydrateFromPull } from "@/lib/sync/hydrate";

// SyncProvider: sits inside the app shell, listens to online/offline events,
// and triggers background push/pull when the user is authenticated.
// Guest mode: no auto sync (queue stays empty).

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const { status, data } = useSession();
  const busy = useRef(false);

  useEffect(() => {
    if (status !== "authenticated" || !data?.user?.id) return;
    const userId = data.user.id;

    async function syncOnce() {
      if (busy.current) return;
      busy.current = true;
      try {
        if (loadQueue().length > 0) await pushQueue();
        const remote = await pullRemote();
        if (remote) hydrateFromPull(userId, remote as Parameters<typeof hydrateFromPull>[1]);
      } catch {
        // silent; next tick retries
      } finally {
        busy.current = false;
      }
    }

    void syncOnce();

    const onOnline = () => void syncOnce();
    window.addEventListener("online", onOnline);
    const interval = setInterval(() => void syncOnce(), 60_000);
    return () => {
      window.removeEventListener("online", onOnline);
      clearInterval(interval);
    };
  }, [status, data?.user?.id]);

  return <>{children}</>;
}
