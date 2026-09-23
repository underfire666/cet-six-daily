"use client";

import { SessionProvider } from "next-auth/react";
import { SyncProvider } from "@/components/sync/SyncProvider";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <SyncProvider>{children}</SyncProvider>
    </SessionProvider>
  );
}
