import { registerBuiltinPacks } from "../src/content/packs";
import { listContentPacks, getPublishableItems } from "../src/content/registry";
import { validateAll } from "../src/content/validator";
import { registerSyntheticPaperFixture, SYNTHETIC_PAPER_ID } from "../src/content/fixture/cet6-2025-12-synthetic";
import { MOCK_PAPER_001_ID, registerMockPaper001 } from "../src/content/papers/cet6-mock-paper-001";
import { getPaperById } from "../src/content/registry";

registerBuiltinPacks();
registerMockPaper001();
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

// V13 Phase 2C: Paper 001（完整原创模拟卷，staging）校验 + production 隔离
const paper001 = getPaperById(MOCK_PAPER_001_ID) as {
  paperId?: string; isPartial?: boolean; fixture?: boolean; status?: string; authenticity?: string;
} | undefined;
if (!paper001) {
  console.error(`  ERROR mock paper 001 not resolvable: ${MOCK_PAPER_001_ID}`);
  process.exit(1);
}
console.log(`Mock paper 001: ${paper001.paperId} isPartial=${paper001.isPartial} fixture=${paper001.fixture} status=${paper001.status} authenticity=${paper001.authenticity}`);

// V13 Final Acceptance: production pool 必须包含 Paper 001，且不得包含 fixture/staging/raw/draft 内容
const pubPool = getPublishableItems();
const pubPapers = pubPool.filter((it) => (it as { type?: string }).type === "paper");
const pubPaperIds = pubPapers.map((it) => (it as { paperId?: string }).paperId);
const fixtureInPool = pubPapers.filter((it) => (it as { fixture?: boolean }).fixture === true);
const stagingInPool = pubPapers.filter((it) => {
  const s = (it as { status?: string }).status;
  return s === "staging" || s === "raw" || s === "draft";
});

if (!pubPaperIds.includes(MOCK_PAPER_001_ID)) {
  console.error(`  ERROR production pool must contain Paper 001 (${MOCK_PAPER_001_ID}), found: ${pubPaperIds.join(", ") || "none"}`);
  process.exit(1);
}
if (fixtureInPool.length > 0) {
  console.error(`  ERROR production pool must NOT contain fixture papers (found ${fixtureInPool.length})`);
  process.exit(1);
}
if (stagingInPool.length > 0) {
  console.error(`  ERROR production pool must NOT contain staging/raw/draft papers (found ${stagingInPool.length})`);
  process.exit(1);
}
console.log(`Production pool: ${pubPapers.length} paper(s) — ${pubPaperIds.join(", ")} (fixture=0, staging=0)`);

process.exit(report.errors.length > 0 ? 1 : 0);
