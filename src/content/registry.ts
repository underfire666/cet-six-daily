import type { ContentPack, ContentSource } from "./types";
import { getSource } from "./sources";

type PackRecord = { pack: ContentPack; source: ContentSource };

const packs = new Map<string, PackRecord>();

export function registerContentPack(pack: ContentPack): void {
  const source = getSource(pack.sourceId);
  if (!source) {
    throw new Error(`[content] unknown sourceId: ${pack.sourceId} (pack=${pack.id})`);
  }
  if (packs.has(pack.id)) {
    throw new Error(`[content] duplicate pack id: ${pack.id}`);
  }
  packs.set(pack.id, { pack, source });
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
export function getActiveItems<T = unknown>(type?: string): T[] {
  const out: T[] = [];
  for (const { pack } of packs.values()) {
    if (type && pack.contentType !== type) continue;
    out.push(...(pack.items as T[]));
  }
  return out;
}

export function resetRegistry(): void {
  packs.clear();
}
