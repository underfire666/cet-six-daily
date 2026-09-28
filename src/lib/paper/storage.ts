/**
 * V13 Phase 2E: PaperSession storage.
 *
 * Local-first：先写 localStorage，再通过 V12 sync queue 推送到云端。
 * 复用 V12 LearningSession 表（module="paper", activityId=paperId, payload=完整状态）。
 * entityType="session"，merge policy="event"（每次更新都是独立 mutation，不 collapse）。
 *
 * 坏记录隔离：单个 session 损坏不影响其他 session。
 * 存储失败明确提示，不显示虚假"已保存"。
 */

import type { PaperSessionState } from "@/types/paper";
import { isValidPaperSession } from "./session";

const PAPER_SESSION_PREFIX = "cet-daily:v13:paper-session:";

export interface PaperStorageIssue {
  message: string;
  sessionId?: string;
}

function getStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function sessionKey(sessionId: string): string {
  return `${PAPER_SESSION_PREFIX}${sessionId}`;
}

/** 加载单个 PaperSession。失败返回 null，不抛出。 */
export function loadPaperSession(sessionId: string): { session: PaperSessionState | null; issue?: string } {
  const storage = getStorage();
  if (!storage) return { session: null, issue: "浏览器无法访问本地存储，Paper 进度将不会被保存。" };
  try {
    const raw = storage.getItem(sessionKey(sessionId));
    if (!raw) return { session: null };
    const parsed = JSON.parse(raw);
    if (!isValidPaperSession(parsed)) {
      return { session: null, issue: `Paper session ${sessionId} 数据已损坏，已隔离。` };
    }
    return { session: parsed };
  } catch {
    return { session: null, issue: `Paper session ${sessionId} 读取失败，已隔离。` };
  }
}

/** 保存单个 PaperSession 到 localStorage。返回是否成功。 */
export function savePaperSession(session: PaperSessionState): { ok: boolean; issue?: string } {
  const storage = getStorage();
  if (!storage) return { ok: false, issue: "浏览器无法访问本地存储，当前作答未保存。" };
  try {
    storage.setItem(sessionKey(session.sessionId), JSON.stringify(session));
    return { ok: true };
  } catch {
    return { ok: false, issue: "本地存储写入失败（可能空间不足），当前作答未保存。" };
  }
}

/** 列出所有本地 PaperSession（按 startedAt 降序）。坏记录跳过并记录 issue。 */
export function listPaperSessions(ownerNamespace?: string): { sessions: PaperSessionState[]; issues: PaperStorageIssue[] } {
  const storage = getStorage();
  if (!storage) return { sessions: [], issues: [{ message: "浏览器无法访问本地存储。" }] };
  const sessions: PaperSessionState[] = [];
  const issues: PaperStorageIssue[] = [];
  try {
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (!key || !key.startsWith(PAPER_SESSION_PREFIX)) continue;
      const sessionId = key.slice(PAPER_SESSION_PREFIX.length);
      try {
        const raw = storage.getItem(key);
        if (!raw) continue;
        const parsed = JSON.parse(raw);
        if (!isValidPaperSession(parsed)) {
          issues.push({ message: `Paper session 数据已损坏，已隔离。`, sessionId });
          continue;
        }
        if (ownerNamespace && parsed.ownerNamespace !== ownerNamespace) continue;
        sessions.push(parsed);
      } catch {
        issues.push({ message: `Paper session 读取失败，已隔离。`, sessionId });
      }
    }
  } catch {
    issues.push({ message: "遍历本地存储失败。" });
  }
  sessions.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  return { sessions, issues };
}

/** 查找某 paperId 的未完成 session（用于 resume）。 */
export function findInProgressSession(paperId: string, ownerNamespace: string): PaperSessionState | null {
  const { sessions } = listPaperSessions(ownerNamespace);
  return sessions.find((s) => s.paperId === paperId && s.phase !== "completed") ?? null;
}

/** 查找某 paperId 的已完成 session（最近一次）。 */
export function findLatestCompletedSession(paperId: string, ownerNamespace: string): PaperSessionState | null {
  const { sessions } = listPaperSessions(ownerNamespace);
  return sessions.find((s) => s.paperId === paperId && s.phase === "completed") ?? null;
}

/** 删除单个 PaperSession（本地）。 */
export function removePaperSession(sessionId: string): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.removeItem(sessionKey(sessionId));
  } catch {
    // ignore
  }
}

/**
 * 将 PaperSession 推送到 V12 sync queue（登录用户）。
 * Guest 用户不调用此函数（数据只在本地）。
 *
 * 复用 entityType="session"，server 端写入 LearningSession 表：
 * - id = sessionId
 * - module = "paper"
 * - activityId = paperId
 * - startedAt / completedAt / status / payload
 */
export function enqueuePaperSessionSync(session: PaperSessionState): void {
  if (typeof window === "undefined") return;
  // 动态导入避免 SSR 问题
  import("@/lib/sync/client").then(({ enqueueMutation }) => {
    enqueueMutation({
      entityType: "session",
      entityId: session.sessionId,
      operation: "upsert",
      payload: {
        module: "paper",
        activityId: session.paperId,
        startedAt: session.startedAt,
        completedAt: session.completedAt ?? null,
        status: session.phase === "completed" ? "completed" : "in_progress",
        durationSec: session.result?.durationSec ?? null,
        payload: session as unknown as Record<string, unknown>,
      },
    });
  }).catch(() => {
    // sync queue 不可用时静默失败，本地数据已保存
  });
}

/** 保存 + 同步（登录用户）。返回本地保存结果。 */
export function saveAndSyncPaperSession(session: PaperSessionState, isLoggedIn: boolean): { ok: boolean; issue?: string } {
  const result = savePaperSession(session);
  if (result.ok && isLoggedIn) {
    enqueuePaperSessionSync(session);
  }
  return result;
}
