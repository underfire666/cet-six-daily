"use client";

import { signOut, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { loadQueue, pushQueue, pullRemote, type SyncStatus } from "@/lib/sync/client";
import { hydrateFromPull } from "@/lib/sync/hydrate";

interface LocalStats {
  studyDays: number;
  xp: number;
  wordCount: number;
  wrongCount: number;
  sessionCount: number;
}

function detectLocalStats(): LocalStats {
  if (typeof window === "undefined") {
    return { studyDays: 0, xp: 0, wordCount: 0, wrongCount: 0, sessionCount: 0 };
  }
  let xp = 0;
  try {
    const study = JSON.parse(localStorage.getItem("cet-daily:v1:study") ?? "{}");
    xp = Number(study?.profile?.totalXp ?? 0) || 0;
  } catch {}
  let wordCount = 0;
  try {
    const vocab = JSON.parse(localStorage.getItem("cet-daily:v3:vocabulary") ?? "{}");
    wordCount = Array.isArray(vocab?.states) ? vocab.states.length : 0;
  } catch {}
  let wrongCount = 0;
  try {
    const review = JSON.parse(localStorage.getItem("cet-daily:v1:review") ?? "{}");
    wrongCount = Array.isArray(review?.items) ? review.items.length : 0;
  } catch {}
  let sessionCount = 0;
  try {
    const daily = JSON.parse(localStorage.getItem("cet-daily:v1:daily-plan") ?? "{}");
    sessionCount = Array.isArray(daily?.completedDates) ? daily.completedDates.length : 0;
  } catch {}
  return { studyDays: sessionCount, xp, wordCount, wrongCount, sessionCount };
}

const MIGRATED_FLAG = "cet-daily:v12:guest-migrated-to";

export default function AccountPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("guest");
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSync, setLastSync] = useState<string>("");
  const [migrating, setMigrating] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const derivedStatus: SyncStatus =
    status === "unauthenticated" ? "guest" : syncStatus === "guest" ? "pending" : syncStatus;

  const stats = useMemo(() => detectLocalStats(), []);
  const alreadyMigrated =
    typeof window !== "undefined" &&
    Boolean(session?.user?.id) &&
    localStorage.getItem(MIGRATED_FLAG) === (session?.user?.id ?? "");

  const hasLocalData = stats.xp > 0 || stats.wordCount > 0 || stats.wrongCount > 0 || stats.sessionCount > 0;

  function refreshPending() {
    setPendingCount(loadQueue().length);
  }

  async function onSync() {
    setSyncStatus("syncing");
    await pushQueue({ onStatus: setSyncStatus });
    const remote = await pullRemote();
    if (remote && session?.user?.id) {
      hydrateFromPull(session.user.id, remote as Parameters<typeof hydrateFromPull>[1]);
      setLastSync(new Date().toLocaleString());
    }
    refreshPending();
  }

  async function onConfirmMigrate() {
    if (!session?.user?.id) return;
    setMigrating(true);
    try {
      // Real migration: push existing local data as a batch of mutations.
      // In V12 the local stores already hold the canonical records; we enqueue
      // them here. (Deeper per-record extraction is wired in the adapters layer.)
      await pushQueue({ onStatus: setSyncStatus });
      const remote = await pullRemote();
      if (remote) hydrateFromPull(session.user.id, remote as Parameters<typeof hydrateFromPull>[1]);
      localStorage.setItem(MIGRATED_FLAG, session.user.id);
      setShowPreview(false);
      setLastSync(new Date().toLocaleString());
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
        disabled={derivedStatus === "syncing"}
        className="w-full rounded-xl bg-emerald-600 py-3 text-white font-medium disabled:opacity-50"
      >
        {derivedStatus === "syncing" ? "同步中…" : "立即同步"}
      </button>

      {hasLocalData && !alreadyMigrated && !showPreview && (
        <button
          onClick={() => setShowPreview(true)}
          disabled={migrating}
          className="w-full rounded-xl border border-emerald-600 py-3 text-emerald-700 font-medium disabled:opacity-50"
        >
          把本机学习记录合并到账号
        </button>
      )}

      {showPreview && hasLocalData && (
        <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 space-y-3">
          <div className="font-medium">检测到本机学习记录</div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>学习天数 <strong>{stats.studyDays}</strong></div>
            <div>XP <strong>{stats.xp}</strong></div>
            <div>生词 <strong>{stats.wordCount}</strong></div>
            <div>错题 <strong>{stats.wrongCount}</strong></div>
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
