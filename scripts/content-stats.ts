import { registerBuiltinPacks } from "../src/content/packs";
import { listContentPacks, getPackSource } from "../src/content/registry";

registerBuiltinPacks();
const packs = listContentPacks();

const byType: Record<string, number> = {};
const bySource: Record<string, number> = {};

for (const pack of packs) {
  byType[pack.contentType] = (byType[pack.contentType] ?? 0) + pack.items.length;
  const src = getPackSource(pack.id);
  const key = src ? `${src.type}/${src.licenseType}` : "unknown";
  bySource[key] = (bySource[key] ?? 0) + pack.items.length;
}

console.log("=== Content Stats ===");
console.log("By type:");
for (const [k, v] of Object.entries(byType)) console.log(`  ${k}: ${v}`);
console.log("By source:");
for (const [k, v] of Object.entries(bySource)) console.log(`  ${k}: ${v}`);
console.log("Deprecated: 0 (V10 no deprecated content yet)");
