import type { PrivateWrongItemView } from "@/content/private-wrong-item-store";
export type { PrivateWrongItemView } from "@/content/private-wrong-item-store";

export interface PrivateWrongItemCounts { active: number; removed: number; contentChanged: number; total: number; }
export interface PrivateWrongItemsResponse { ownerId: string; items: PrivateWrongItemView[]; counts: PrivateWrongItemCounts; }

const record = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === "object" && !Array.isArray(v);

/** Fail closed on a wrong-owner or malformed response; never turn it into an empty list. */
export function parsePrivateWrongItems(raw: unknown, ownerId: string, paperId: string): PrivateWrongItemsResponse {
  if (!record(raw) || raw.ownerId !== ownerId || !Array.isArray(raw.items)) throw new Error("错题数据异常，请重试");
  for (const item of raw.items) {
    if (!record(item) || typeof item.id !== "string" || item.paperId !== paperId || typeof item.questionId !== "string" || typeof item.contentHash !== "string" || typeof item.attemptId !== "string" || !["active", "content_changed", "paper_deleted"].includes(String(item.status)) || !Number.isSafeInteger(item.wrongCount) || Number(item.wrongCount) < 1 || (item.userAnswer !== null && typeof item.userAnswer !== "string") || typeof item.correctAnswer !== "string" || typeof item.firstSeenAt !== "string" || typeof item.lastSeenAt !== "string" || (item.removedAt !== null && typeof item.removedAt !== "string") || !Number.isSafeInteger(item.revision) || Number(item.revision) < 0) throw new Error("错题数据异常，请重试");
    if (item.status === "active" && item.removedAt === null) {
      const q = item.question;
      if (!record(q) || typeof q.prompt !== "string" || !Array.isArray(q.options) || !q.options.every(o => record(o) && typeof o.id === "string" && typeof o.text === "string") || ["shortExplanation", "detailedExplanation", "passage"].some(k => q[k] !== undefined && typeof q[k] !== "string")) throw new Error("错题数据异常，请重试");
    }
  }
  const items = raw.items as unknown as PrivateWrongItemView[];
  if (!record(raw.counts)) throw new Error("错题数据异常，请重试");
  const c = raw.counts;
  if (!Number.isSafeInteger(c.active) || !Number.isSafeInteger(c.removed) || !Number.isSafeInteger(c.contentChanged) || !Number.isSafeInteger(c.total)) throw new Error("错题数据异常，请重试");
  const counts: PrivateWrongItemCounts = { active: c.active as number, removed: c.removed as number, contentChanged: c.contentChanged as number, total: c.total as number };
  return { ownerId, items, counts };
}

export function formatPrivateWrongDate(iso: string) {
  return new Date(iso).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}
