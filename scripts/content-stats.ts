import { registerBuiltinPacks } from "../src/content/packs";
import { listContentPacks, getPackSource } from "../src/content/registry";
import { unifiedDifficulty } from "../src/content/difficulty";

registerBuiltinPacks();
const packs = listContentPacks();

const byType: Record<string, number> = {};
const bySource: Record<string, number> = {};
const byDifficulty: Record<string, number> = {};
let deprecated = 0;

for (const pack of packs) {
  byType[pack.contentType] = (byType[pack.contentType] ?? 0) + pack.items.length;
  const src = getPackSource(pack.id);
  const key = src ? `${src.type}/${src.licenseType}` : "unknown";
  bySource[key] = (bySource[key] ?? 0) + pack.items.length;
  for (const item of pack.items as { type?: string; difficulty?: unknown; status?: string }[]) {
    // 统一难度：词汇 1-5 经 Adapter 映射，translation/writing 无难度字段按 normal 计，
    // 因此不存在无意义的 unspecified。
    const difficulty = unifiedDifficulty(item);
    byDifficulty[difficulty] = (byDifficulty[difficulty] ?? 0) + 1;
    if (item.status === "deprecated") deprecated++;
  }
}

console.log("=== Content Stats ===");
console.log("By type:");
for (const [k, v] of Object.entries(byType)) console.log(`  ${k}: ${v}`);
console.log("By source:");
for (const [k, v] of Object.entries(bySource)) console.log(`  ${k}: ${v}`);
console.log("By difficulty (unified):");
for (const [key, count] of Object.entries(byDifficulty)) console.log(`  ${key}: ${count}`);
console.log(`Deprecated: ${deprecated}`);
