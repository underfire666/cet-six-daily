import type { SyncStatus } from "./client";

interface ManualSyncOptions {
  onStatus: (status: SyncStatus) => void;
  push: () => Promise<{ failed: number }>;
  pull: () => Promise<Record<string, unknown> | null>;
  hydrate: (remote: Record<string, unknown>) => void;
  refreshPending: () => number;
  onSynced: () => void;
}

export function isManualSyncBusy(status: SyncStatus): boolean {
  return status === "syncing";
}

export async function runManualSync({
  onStatus,
  push,
  pull,
  hydrate,
  refreshPending,
  onSynced,
}: ManualSyncOptions): Promise<void> {
  onStatus("syncing");
  try {
    const result = await push();
    if (result.failed > 0) throw new Error("待同步数据上传失败，请重试");

    const remote = await pull();
    if (!remote) throw new Error("云端读取失败，请重试");

    hydrate(remote);
    if (refreshPending() > 0) throw new Error("仍有待同步项目，请重试");
    onSynced();
    onStatus("synced");
  } catch (error) {
    onStatus("failed");
    throw error;
  }
}
