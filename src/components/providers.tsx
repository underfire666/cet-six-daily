"use client";

import { SessionProvider, useSession } from "next-auth/react";
import { SyncProvider } from "@/components/sync/SyncProvider";
import { useSyncUserIdSync } from "@/lib/sync/adapters";

function AccountResetGate({ children }: { children: React.ReactNode }) {
  const { status, data } = useSession();
  useSyncUserIdSync();
  // Wait for the session decision before stores capture a scoped storage handle.
  // Otherwise a login transition can start a user lesson in the guest store.
  if (status === "loading") return <div role="status" className="p-8 text-center">加载中…</div>;
  const userId = status === "authenticated" ? (data?.user?.id ?? "guest") : "guest";
  // key change remounts the whole provider tree under it, so A→B never shares
  // in-memory state. Guest→A, A→B, B→A all get a fresh tree.
  return <div key={userId} className="contents">{children}</div>;
}

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <AccountResetGate>
        <SyncProvider>{children}</SyncProvider>
      </AccountResetGate>
    </SessionProvider>
  );
}
