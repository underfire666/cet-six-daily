import { registerBuiltinPacks } from "../src/content/packs";
import { listContentPacks, getPublishableItems } from "../src/content/registry";
import { validateAll } from "../src/content/validator";
import { registerSyntheticPaperFixture, SYNTHETIC_PAPER_ID } from "../src/content/fixture/cet6-2025-12-synthetic";
import { getPaperById } from "../src/content/registry";

registerBuiltinPacks();
registerSyntheticPaperFixture();
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

// V13: paper fixture 校验 + production 隔离验证
const paper = getPaperById(SYNTHETIC_PAPER_ID) as { paperId?: string; isPartial?: boolean; fixture?: boolean; status?: string } | undefined;
if (!paper) {
  console.error(`  ERROR synthetic paper fixture not resolvable: ${SYNTHETIC_PAPER_ID}`);
  process.exit(1);
}
console.log(`Synthetic paper fixture: ${paper.paperId} isPartial=${paper.isPartial} fixture=${paper.fixture} status=${paper.status}`);

const pubPool = getPublishableItems();
const pubPapers = pubPool.filter((it) => (it as { type?: string }).type === "paper");
if (pubPapers.length > 0) {
  console.error(`  ERROR production publishable pool must NOT contain staging fixture papers (found ${pubPapers.length})`);
  process.exit(1);
}

process.exit(report.errors.length > 0 ? 1 : 0);
