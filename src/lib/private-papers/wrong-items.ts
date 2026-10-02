import type { PrivateWrongItemView } from "@/content/private-wrong-item-store";
export type { PrivateWrongItemView } from "@/content/private-wrong-item-store";
export interface PrivateWrongItemCounts { active: number; removed: number; contentChanged: number; total: number; }
export interface PrivateWrongItemsResponse { ownerId: string; items: PrivateWrongItemView[]; counts: PrivateWrongItemCounts; }
const record = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === "object" && !Array.isArray(v);
const text = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;
const date = (v: unknown): v is string => typeof v === "string" && Number.isFinite(Date.parse(v));

/** All active questions are rendered, including removed ones. Validate both paths. */
function validItem(raw: unknown, paperId: string): raw is PrivateWrongItemView {
  if (!record(raw) || !text(raw.id) || raw.paperId !== paperId || !text(raw.questionId) || !text(raw.contentHash) || !text(raw.attemptId) || !["active", "content_changed", "paper_deleted"].includes(String(raw.status)) || !Number.isSafeInteger(raw.wrongCount) || Number(raw.wrongCount) < 1 || (raw.userAnswer !== null && !text(raw.userAnswer)) || !text(raw.correctAnswer) || !date(raw.firstSeenAt) || !date(raw.lastSeenAt) || (raw.removedAt !== null && !date(raw.removedAt)) || !Number.isSafeInteger(raw.revision) || Number(raw.revision) < 0 || Number(raw.revision) > 2147483647 || (raw.paperTitle !== undefined && !text(raw.paperTitle))) return false;
  if (raw.status !== "active") return raw.question === undefined;
  const q = raw.question;
  if (!record(q) || !text(q.prompt) || !Array.isArray(q.options) || q.options.length < 2 || !q.options.every(o => record(o) && text(o.id) && typeof o.text === "string") || ["shortExplanation", "detailedExplanation", "passage"].some(k => q[k] !== undefined && typeof q[k] !== "string")) return false;
  if (new Set(q.options.map(o => o.id)).size !== q.options.length || !q.options.some(o => o.id === raw.correctAnswer) || (raw.userAnswer !== null && !q.options.some(o => o.id === raw.userAnswer))) return false;
  return true;
}

/** Fail closed on malformed items, duplicates or counts that disagree with the snapshot. */
export function parsePrivateWrongItems(raw: unknown, ownerId: string, paperId: string): PrivateWrongItemsResponse {
  if (!record(raw) || raw.ownerId !== ownerId || !Array.isArray(raw.items) || !raw.items.every(item => validItem(item, paperId)) || !record(raw.counts)) throw new Error("错题数据异常，请重试");
  const items = raw.items as PrivateWrongItemView[], ids = new Set<string>(), versions = new Set<string>();
  for (const item of items) {
    const version = JSON.stringify([item.contentHash, item.questionId]);
    if (ids.has(item.id) || versions.has(version)) throw new Error("错题数据重复，请重试");
    ids.add(item.id); versions.add(version);
  }
  const counts: PrivateWrongItemCounts = { active: items.filter(i => i.status === "active" && i.removedAt === null).length, removed: items.filter(i => i.removedAt !== null).length, contentChanged: items.filter(i => i.status !== "active" && i.removedAt === null).length, total: items.length };
  for (const key of ["active", "removed", "contentChanged", "total"] as const) if (!Number.isSafeInteger(raw.counts[key]) || raw.counts[key] !== counts[key]) throw new Error("错题数量与列表不一致，请重试");
  return { ownerId, items, counts };
}

export function parsePrivateWrongManagement(raw: unknown, ownerId: string, before: PrivateWrongItemView, removed: boolean): PrivateWrongItemView {
  if (!record(raw) || raw.ownerId !== ownerId || !validItem(raw.item, before.paperId)) throw new Error("错题操作返回数据异常，请重新检查");
  const item = raw.item;
  if (item.id !== before.id || item.questionId !== before.questionId || item.contentHash !== before.contentHash || item.status !== "active" || (item.removedAt !== null) !== removed || item.revision < before.revision || item.revision > before.revision + 1 || ["attemptId", "wrongCount", "userAnswer", "correctAnswer", "firstSeenAt", "lastSeenAt"].some(k => item[k as keyof PrivateWrongItemView] !== before[k as keyof PrivateWrongItemView])) throw new Error("错题操作结果已变化，请重新检查");
  return item;
}
export function formatPrivateWrongDate(iso: string) {
  return new Date(iso).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}
