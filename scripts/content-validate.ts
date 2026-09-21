import { registerBuiltinPacks } from "../src/content/packs";
import { listContentPacks } from "../src/content/registry";
import { validateAll } from "../src/content/validator";

registerBuiltinPacks();
const report = validateAll(listContentPacks());

console.log("=== Content Validation ===");
console.log(`Vocabulary: ${report.counts.vocabulary}`);
console.log(`Reading:    ${report.counts.reading}`);
console.log(`Listening:  ${report.counts.listening}`);
console.log(`Translation:${report.counts.translation}`);
console.log(`Writing:    ${report.counts.writing}`);
console.log(`Paper:      ${report.counts.paper}`);
console.log(`Errors:   ${report.errors.length}`);
console.log(`Warnings: ${report.warnings.length}`);

for (const e of report.errors) console.error(`  ERROR [${e.packId}] ${e.itemId ?? ""} ${e.message}`);
for (const w of report.warnings) console.warn(`  WARN  [${w.packId}] ${w.itemId ?? ""} ${w.message}`);

process.exit(report.errors.length > 0 ? 1 : 0);
