import type { ContentAlias } from "./types";

/**
 * 内容别名表：旧 ID → 新 stable ID。
 * V10 当前所有内容沿用旧 ID，identity mapping 即可。
 * 未来重命名时在这里登记，保证旧 ReviewItem/Session/XP 仍能查到。
 */
const ALIASES: ContentAlias[] = [];

const map = new Map(ALIASES.map((a) => [a.legacyId, a.stableId]));

export function resolveAlias(legacyId: string): string {
  return map.get(legacyId) ?? legacyId;
}

export function listAliases(): ContentAlias[] {
  return [...ALIASES];
}
