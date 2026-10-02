import type { PrivateWrongItemView } from "@/content/private-wrong-item-store";
export type { PrivateWrongItemView } from "@/content/private-wrong-item-store";
export interface PrivateWrongItemsResponse { ownerId: string; items: PrivateWrongItemView[]; total: number; invalidatedTotal: number; }
const record = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === "object" && !Array.isArray(v);
/** Fail closed on a wrong-owner or malformed response; never turn it into an empty list. */
export function parsePrivateWrongItems(raw: unknown, ownerId: string, paperId: string): PrivateWrongItemsResponse {
  if (!record(raw) || raw.ownerId !== ownerId || !Array.isArray(raw.items)) throw new Error("错题数据异常，请重试");
  for (const item of raw.items) {
    if (!record(item) || typeof item.id !== "string" || item.paperId !== paperId || typeof item.questionId !== "string" || typeof item.contentHash !== "string" || typeof item.attemptId !== "string" || !["active", "content_changed"].includes(String(item.status)) || !Number.isSafeInteger(item.wrongCount) || Number(item.wrongCount) < 1 || (item.userAnswer !== null && typeof item.userAnswer !== "string") || typeof item.correctAnswer !== "string" || typeof item.firstSeenAt !== "string" || typeof item.lastSeenAt !== "string") throw new Error("错题数据异常，请重试");
    if (item.status === "active") {
      const q = item.question;
      if (!record(q) || typeof q.prompt !== "string" || !Array.isArray(q.options) || !q.options.every(o => record(o) && typeof o.id === "string" && typeof o.text === "string") || ["shortExplanation", "detailedExplanation", "passage"].some(k => q[k] !== undefined && typeof q[k] !== "string")) throw new Error("错题数据异常，请重试");
    }
  }
  const items = raw.items as unknown as PrivateWrongItemView[];
  const total = items.filter(item => item.status === "active").length;
  if (raw.total !== total || raw.invalidatedTotal !== items.length - total) throw new Error("错题数据异常，请重试");
  return { ownerId, items, total, invalidatedTotal: items.length - total };
}
export function formatPrivateWrongDate(iso: string) {
  return new Date(iso).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}
