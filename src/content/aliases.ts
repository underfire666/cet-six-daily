import type { ContentAlias } from "./types";

/**
 * 内容别名表：旧 ID → 新 stable ID。
 * V10 当前所有内容沿用旧 ID，identity mapping 即可。
 * 未来重命名时在这里登记，保证旧 ReviewItem/Session/XP 仍能查到。
 *
 * V13：支持运行时登记（registerAlias），配合未来 Deprecated ID mapping。
 */
const ALIASES: ContentAlias[] = [];

const map = new Map(ALIASES.map((a) => [a.legacyId, a.stableId]));

/** 登记别名（幂等：同 legacyId 后登记覆盖）。未来重命名使用。 */
export function registerAlias(alias: ContentAlias): void {
  const existing = ALIASES.findIndex((a) => a.legacyId === alias.legacyId);
  if (existing >= 0) ALIASES[existing] = alias;
  else ALIASES.push(alias);
  map.set(alias.legacyId, alias.stableId);
}

export function resolveAlias(legacyId: string): string {
  return map.get(legacyId) ?? legacyId;
}

export function listAliases(): ContentAlias[] {
  return [...ALIASES];
}
