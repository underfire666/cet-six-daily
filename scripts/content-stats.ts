import { registerBuiltinPacks } from "../src/content/packs";
import { listContentPacks, getPackSource } from "../src/content/registry";
import { unifiedDifficulty } from "../src/content/difficulty";
import { registerSyntheticPaperFixture } from "../src/content/fixture/cet6-2025-12-synthetic";
import { bucketOf } from "../src/content/rights";
import type { CET6Paper } from "../src/content/papers";

registerBuiltinPacks();
registerSyntheticPaperFixture();
const packs = listContentPacks();

const byType: Record<string, number> = {};
const bySource: Record<string, number> = {};
const byDifficulty: Record<string, number> = {};
const byRights: Record<string, number> = {};
let deprecated = 0;
let sections = 0;
let groups = 0;
let questions = 0;

for (const pack of packs) {
  byType[pack.contentType] = (byType[pack.contentType] ?? 0) + pack.items.length;
  const src = getPackSource(pack.id);
  const key = src ? `${src.type}/${src.licenseType}` : "unknown";
  bySource[key] = (bySource[key] ?? 0) + pack.items.length;
  const packRights = pack.rights ?? src?.rights;
  const bucket = bucketOf(packRights);
  byRights[bucket] = (byRights[bucket] ?? 0) + 1;
  for (const item of pack.items as { type?: string; difficulty?: unknown; status?: string }[]) {
    const difficulty = unifiedDifficulty(item);
    byDifficulty[difficulty] = (byDifficulty[difficulty] ?? 0) + 1;
    if (item.status === "deprecated") deprecated++;
  }
  if (pack.contentType === "paper") {
    for (const p of pack.items as CET6Paper[]) {
      sections += p.sections.length;
      for (const s of p.sections) {
        groups += s.groups.length;
        for (const g of s.groups) questions += (g.questions?.length ?? 0) + (g.questionRefs?.length ?? 0);
      }
    }
  }
}

console.log("=== Content Stats ===");
console.log("By type:");
for (const [k, v] of Object.entries(byType)) console.log(`  ${k}: ${v}`);
console.log("By source:");
for (const [k, v] of Object.entries(bySource)) console.log(`  ${k}: ${v}`);
console.log("By difficulty (unified):");
for (const [key, count] of Object.entries(byDifficulty)) console.log(`  ${key}: ${count}`);
console.log("By rights (licenseStatus):");
for (const [key, count] of Object.entries(byRights)) console.log(`  ${key}: ${count}`);
console.log(`Deprecated: ${deprecated}`);
console.log(`Paper sections: ${sections}`);
console.log(`Paper groups:   ${groups}`);
console.log(`Paper questions (inline+refs): ${questions}`);
