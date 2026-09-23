"use client";

import { signOut, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { loadQueue, pushQueue, pullRemote, type SyncStatus } from "@/lib/sync/client";

export default function AccountPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("guest");
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSync, setLastSync] = useState<string>("");
  const [migrating, setMigrating] = useState(false);

  const derivedStatus: SyncStatus =
    status === "unauthenticated" ? "guest" : syncStatus === "guest" ? "pending" : syncStatus;

  function refreshPending() {
    setPendingCount(loadQueue().length);
  }

  async function onSync() {
    setSyncStatus("syncing");
    await pushQueue({ onStatus: setSyncStatus });
    const remote = await pullRemote();
    if (remote) setLastSync(new Date().toLocaleString());
    refreshPending();
  }

  async function onMigrateLocal() {
    setMigrating(true);
    // In V12 the local->cloud upload is the same push pipeline; mutationIds are stable per local record.
    await pushQueue({ onStatus: setSyncStatus });
    refreshPending();
    setMigrating(false);
  }

  if (status === "loading") return <main className="p-8 text-center text-stone-500">加载中…</main>;

  if (!session) {
    return (
      <main className="p-6 space-y-4">
        <h1 className="text-xl font-bold">账号与同步</h1>
        <p className="text-sm text-stone-500">当前未登录，学习记录仅保存在本机。</p>
        <button
          onClick={() => router.push("/login")}
          className="w-full rounded-xl bg-emerald-600 py-3 text-white font-medium"
        >
          登录 / 注册
        </button>
      </main>
    );
  }

  const statusLabel: Record<SyncStatus, string> = {
    guest: "未登录",
    "local-only": "仅本地",
    syncing: "正在同步…",
    synced: "已同步",
    pending: pendingCount > 0 ? `待同步 ${pendingCount} 项` : "待同步",
    failed: "同步失败，请重试",
    offline: "离线，恢复网络后自动同步",
  };

  return (
    <main className="p-6 space-y-5">
      <h1 className="text-xl font-bold">账号与同步</h1>
      <div className="rounded-xl border border-stone-200 p-4 space-y-2">
        <div className="text-sm text-stone-500">邮箱</div>
        <div className="text-base font-medium">{session.user?.email}</div>
      </div>
      <div className="rounded-xl border border-stone-200 p-4 space-y-2">
        <div className="text-sm text-stone-500">同步状态</div>
        <div className="text-base font-medium text-emerald-700">{statusLabel[derivedStatus]}</div>
        {lastSync && <div className="text-xs text-stone-400">上次同步 {lastSync}</div>}
      </div>
      <button
        onClick={onSync}
        disabled={derivedStatus === "syncing"}
        className="w-full rounded-xl bg-emerald-600 py-3 text-white font-medium disabled:opacity-50"
      >
        {derivedStatus === "syncing" ? "同步中…" : "立即同步"}
      </button>
      <button
        onClick={onMigrateLocal}
        disabled={migrating}
        className="w-full rounded-xl border border-emerald-600 py-3 text-emerald-700 font-medium disabled:opacity-50"
      >
        {migrating ? "迁移中…" : "把本机学习记录合并到账号"}
      </button>
      <button
        onClick={() => signOut({ callbackUrl: "/" })}
        className="w-full rounded-xl border border-stone-300 py-3 text-stone-600"
      >
        退出登录
      </button>
    </main>
  );
}
