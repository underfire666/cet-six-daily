/** 词汇标准化：用于去重、查询、生词本合并。 */
export function normalizeWord(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[''"]/g, "'")
    .replace(/\s+/g, " ");
}

/** 内容 ID 稳定化：去除多余空白、统一小写。已稳定的 ID 直接返回。 */
export function canonicalContentId(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, "_");
}

/** 简易字符串 hash（确定性，用于 ContentSelector seed）。 */
export function hashString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
