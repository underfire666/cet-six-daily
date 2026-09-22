import type { ContentPack, ContentSource } from "./types";
import { getSource } from "./sources";
import { validateAll, validatePack } from "./validator";

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
  const existing = new Set(getItems<{id:string}>().map(i=>i.id));
  const accepted: unknown[] = [];
  for (const item of Array.isArray(pack.items) ? pack.items : []) {
    if (validatePack({...pack,items:[...accepted,item]}).some(i=>i.level === "error")) continue;
    const id = (item as {id:string}).id;
    if (existing.has(id)) continue;
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

export function resetRegistry(): void {
  packs.clear();
}
