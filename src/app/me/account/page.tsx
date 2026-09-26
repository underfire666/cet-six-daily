"use client";

import { signOut, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { loadQueue, pushQueue, pullRemote, SYNC_QUEUE_EVENT, SYNC_STATUS_EVENT, type SyncEventDetail, type SyncStatus } from "@/lib/sync/client";
import { isManualSyncBusy, runManualSync } from "@/lib/sync/manual";
import { hydrateFromPull } from "@/lib/sync/hydrate";
import { buildGuestMigrationPlan, type GuestMigrationPlan } from "@/lib/sync/migration";
import { getStorageForNamespace } from "@/lib/storage/scoped";

const MIGRATED_FLAG = "cet-daily:v12:guest-migrated-to";
const MIGRATION_ID_KEY = "cet-daily:v12:guest-migration-id:";
const LAST_SYNC_KEY = "cet-daily:v12:last-sync";

function lastSyncFor(userId: string): string {
  try {
    const raw = getStorageForNamespace({ type: "user", id: userId })?.getItem(LAST_SYNC_KEY);
    const at = raw ? (JSON.parse(raw) as { at?: unknown }).at : null;
    return typeof at === "string" && Number.isFinite(Date.parse(at)) ? new Date(at).toLocaleString() : "";
  } catch {
    return "";
  }
}

export default function AccountPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("guest");
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSync, setLastSync] = useState<string>("");
  const [migrating, setMigrating] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [migrationPlan, setMigrationPlan] = useState<GuestMigrationPlan | null>(null);
  const [alreadyMigrated, setAlreadyMigrated] = useState(false);
  const [migrationError, setMigrationError] = useState("");
  const [syncError, setSyncError] = useState("");
  const manualSyncInFlight = useRef(false);

  const derivedStatus: SyncStatus =
    status === "unauthenticated" ? "guest" : syncStatus === "guest" ? "pending" : syncStatus;

  const userId = session?.user?.id;
  useEffect(() => {
    if (!userId) return;
    queueMicrotask(() => {
      const migrationId = localStorage.getItem(`${MIGRATION_ID_KEY}${userId}`) ?? crypto.randomUUID();
      setMigrationPlan(buildGuestMigrationPlan(localStorage, migrationId));
      setAlreadyMigrated(localStorage.getItem(MIGRATED_FLAG) === userId);
    });
  }, [userId]);
  useEffect(() => {
    if (!userId) return;
    let mounted = true;
    const refresh = () => {
      const count = loadQueue(userId).length;
      setPendingCount(count);
      return count;
    };
    const onQueue = (event: Event) => {
      const detail = (event as CustomEvent<SyncEventDetail>).detail;
      if (detail?.userId !== userId) return;
      const count = refresh();
      if (!manualSyncInFlight.current && count > 0)
        setSyncStatus((current) => current === "syncing" ? current : navigator.onLine === false ? "offline" : "pending");
    };
    const onStatus = (event: Event) => {
      const detail = (event as CustomEvent<SyncEventDetail>).detail;
      if (detail?.userId !== userId || !detail.status) return;
      refresh();
      if (manualSyncInFlight.current) return;
      setSyncStatus(detail.status);
      if (detail.status === "synced") setLastSync(lastSyncFor(userId));
    };
    const onOffline = () => {
      if (!manualSyncInFlight.current) setSyncStatus("offline");
    };
    window.addEventListener(SYNC_QUEUE_EVENT, onQueue);
    window.addEventListener(SYNC_STATUS_EVENT, onStatus);
    window.addEventListener("offline", onOffline);
    queueMicrotask(() => {
      if (!mounted) return;
      const count = refresh();
      const previous = lastSyncFor(userId);
      setLastSync(previous);
      setSyncStatus((current) => current === "syncing" ? current
        : navigator.onLine === false ? "offline" : count > 0 ? "pending" : previous ? "synced" : "pending");
    });
    return () => {
      mounted = false;
      window.removeEventListener(SYNC_QUEUE_EVENT, onQueue);
      window.removeEventListener(SYNC_STATUS_EVENT, onStatus);
      window.removeEventListener("offline", onOffline);
    };
  }, [userId]);
  const stats = migrationPlan?.preview;
  const hasLocalData = Boolean(stats?.hasData);

  function refreshPending(): number {
    const count = loadQueue(userId).length;
    setPendingCount(count);
    return count;
  }

  async function onSync() {
    if (!userId || manualSyncInFlight.current) return;
    manualSyncInFlight.current = true;
    setSyncError("");
    try {
      await runManualSync({
        onStatus: setSyncStatus,
        push: () => pushQueue({ userId }),
        pull: () => pullRemote(),
        hydrate: (remote) => hydrateFromPull(userId, remote as Parameters<typeof hydrateFromPull>[1]),
        refreshPending,
        onSynced: () => setLastSync(new Date().toLocaleString()),
      });
    } catch (error) {
      refreshPending();
      setSyncError(error instanceof Error ? error.message : "同步失败，请重试");
    } finally {
      manualSyncInFlight.current = false;
    }
  }

  async function onConfirmMigrate() {
    if (!userId) return;
    setMigrating(true);
    setMigrationError("");
    try {
      const key = `${MIGRATION_ID_KEY}${userId}`;
      const migrationId = localStorage.getItem(key) ?? crypto.randomUUID();
      localStorage.setItem(key, migrationId); // stable across retry after a lost response
      const currentPlan = buildGuestMigrationPlan(localStorage, migrationId);
      if (!currentPlan.preview.hasData) throw new Error("没有可合并的本机记录");
      const response = await fetch("/api/sync/migrate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ migrationId, mutations: currentPlan.mutations }),
      });
      if (!response.ok) throw new Error("合并未完成，请稍后重试");
      const result = await response.json() as { verified?: boolean };
      if (result.verified !== true) throw new Error("合并结果未验证，请稍后重试");
      const remote = await pullRemote();
      if (!remote) throw new Error("云端读取失败，请稍后重试");
      hydrateFromPull(userId, remote as Parameters<typeof hydrateFromPull>[1]);
      localStorage.setItem(MIGRATED_FLAG, userId);
      setAlreadyMigrated(true);
      setShowPreview(false);
      setLastSync(new Date().toLocaleString());
      setSyncStatus("synced");
    } catch (error) {
      setMigrationError((error as Error).message || "合并失败，请稍后重试");
      setSyncStatus("failed");
    } finally {
      setMigrating(false);
      refreshPending();
    }
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
        disabled={isManualSyncBusy(derivedStatus)}
        className="w-full rounded-xl bg-emerald-600 py-3 text-white font-medium disabled:opacity-50"
      >
        {derivedStatus === "syncing" ? "同步中…" : "立即同步"}
      </button>
      {syncError && <p role="alert" className="text-sm text-red-700">{syncError}</p>}
      {migrationError && <p role="alert" className="text-sm text-red-700">{migrationError}</p>}

      {hasLocalData && !alreadyMigrated && !showPreview && (
        <button
          onClick={() => {
            const migrationId = localStorage.getItem(`${MIGRATION_ID_KEY}${userId}`) ?? crypto.randomUUID();
            setMigrationPlan(buildGuestMigrationPlan(localStorage, migrationId));
            setShowPreview(true);
          }}
          disabled={migrating}
          className="w-full rounded-xl border border-emerald-600 py-3 text-emerald-700 font-medium disabled:opacity-50"
        >
          把本机学习记录合并到账号
        </button>
      )}

      {showPreview && hasLocalData && stats && (
        <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 space-y-3">
          <div className="font-medium">检测到本机学习记录</div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>学习天数 <strong>{stats.studyDays}</strong></div>
            <div>XP <strong>{stats.xp}</strong></div>
            <div>已完成会话 <strong>{stats.sessionCount}</strong></div>
            <div>生词 <strong>{stats.wordCount}</strong></div>
            <div>错题 <strong>{stats.wrongCount}</strong></div>
            {stats.translationCount > 0 && <div>翻译历史 <strong>{stats.translationCount}</strong></div>}
            {stats.writingCount > 0 && <div>写作历史 <strong>{stats.writingCount}</strong></div>}
          </div>
          <div className="text-xs text-stone-500">合并后，本机数据仍保留；可在新设备登录同一账号恢复。</div>
          <button
            onClick={onConfirmMigrate}
            disabled={migrating}
            className="w-full rounded-xl bg-emerald-600 py-2 text-white font-medium disabled:opacity-50"
          >
            {migrating ? "合并中…" : "合并到我的账号"}
          </button>
          <button
            onClick={() => setShowPreview(false)}
            className="w-full rounded-xl border border-stone-300 py-2 text-stone-600"
          >
            稍后处理
          </button>
        </div>
      )}

      <button
        onClick={() => signOut({ callbackUrl: "/" })}
        className="w-full rounded-xl border border-stone-300 py-3 text-stone-600"
      >
        退出登录
      </button>
    </main>
  );
}
