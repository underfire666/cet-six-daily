import type { ContentPack, ContentSource, ContentRights } from "./types";
import { getSource } from "./sources";
import { validateAll, validatePack } from "./validator";
import { rightsVerdict } from "./rights";

type PackRecord = { pack: ContentPack; source: ContentSource };

const packs = new Map<string, PackRecord>();

export function registerContentPack(pack: ContentPack, options: { strict?: boolean } = {}): void {
  const source = getSource(pack.sourceId);
  if (!source) {
    throw new Error(`[content] unknown sourceId: ${pack.sourceId} (pack=${pack.id})`);
  }
  if (packs.has(pack.id)) {
    throw new Error(`[content] duplicate pack id: ${pack.id}`);
  }
  const report = validateAll([...listContentPacks(), pack]);
  if (report.errors.length && (options.strict ?? process.env.NODE_ENV !== "production")) {
    throw new Error(`[content] ${report.errors.map(e=>`${e.itemId ?? e.packId}: ${e.message}`).join("; ")}`);
  }
  if (report.errors.length) console.error("[content] invalid records isolated", report.errors);
  const existing = new Set(getItems<{ id: string; paperId?: string }>().map(i => i.id ?? i.paperId ?? ""));
  const accepted: unknown[] = [];
  for (const item of Array.isArray(pack.items) ? pack.items : []) {
    if (validatePack({...pack,items:[...accepted,item]}).some(i=>i.level === "error")) continue;
    const id = (item as { id?: string }).id ?? (item as { paperId?: string }).paperId;
    if (!id || existing.has(id)) continue;
    existing.add(id);
    accepted.push(item);
  }
  packs.set(pack.id, { pack: {...pack,items:accepted}, source });
}

export function getContentPack(id: string): ContentPack | undefined {
  return packs.get(id)?.pack;
}

export function listContentPacks(): ContentPack[] {
  return [...packs.values()].map((r) => r.pack);
}

export function getPackSource(packId: string): ContentSource | undefined {
  return packs.get(packId)?.source;
}

/** 所有 active 状态的内容项（含所属 pack）。 */
export function getItems<T = unknown>(type?: string): T[] {
  const out: T[] = [];
  for (const { pack } of packs.values()) {
    if (type && pack.contentType !== type) continue;
    out.push(...(pack.items as T[]));
  }
  return out;
}

/** Demo mode explicitly permits the bundled Mock source; formal pools exclude unknown licenses. */
export function getActiveItems<T = unknown>(type?: string, mode: "demo" | "production" = "demo"): T[] {
  const out: T[] = [];
  for (const {pack,source} of packs.values()) {
    if (type && pack.contentType !== type) continue;
    if (mode === "production" && (source.type === "mock" || source.licenseType === "unknown")) continue;
    out.push(...pack.items.filter(item => (item as {status:string}).status === "active") as T[]);
  }
  return out;
}

/**
 * V13：可发布（production published）内容池。
 * 规则：来源非 mock、license 非 unknown、状态 active/published、
 * pack 级 rights 通过（owned / licensed+evidence / official_public_material）。
 * staging / raw / blocked / unknown-rights 一律排除 —— 学习页与 Selector 绝不能抽到。
 */
export function getPublishableItems<T = unknown>(type?: string): T[] {
  const out: T[] = [];
  for (const {pack,source} of packs.values()) {
    if (type && pack.contentType !== type) continue;
    if (source.type === "mock" || source.licenseType === "unknown") continue;
    if (pack.rights && rightsVerdict(pack.rights) !== "allowed") continue;
    out.push(...pack.items.filter(item => {
      const status = (item as {status?:string}).status;
      if (status !== "active" && status !== "published") return false;
      const itemRights = (item as {rights?: ContentRights}).rights;
      return !itemRights || rightsVerdict(itemRights) === "allowed";
    }) as T[]);
  }
  return out;
}

/** V13：paper 内容（开发/测试/审计用；不暴露给学习页 Selector）。 */
export function getPapers<T = unknown>(): T[] {
  return getItems<T>("paper");
}

/** V13：按 stable ID 解析 paper（fixture 仅开发/测试 resolve）。 */
export function getPaperById<T = unknown>(id: string): T | undefined {
  return getPapers<T>().find((p) => (p as {paperId?: string}).paperId === id);
}

/** V13：按 stable ID 解析任意已注册内容（fixture/paper 仅开发/测试使用）。 */
export function resolveContentById<T = unknown>(id: string): T | undefined {
  for (const { pack } of packs.values()) {
    const hit = (pack.items as T[]).find((it) => (it as {id?: string}).id === id || (it as {paperId?: string}).paperId === id);
    if (hit) return hit;
  }
  return undefined;
}

export function resetRegistry(): void {
  packs.clear();
}
