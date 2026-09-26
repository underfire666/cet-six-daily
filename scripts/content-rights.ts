/**
 * V13: `npm run content:rights`（V13 Phase 1.1: Rights Hardening）
 * 对全部已注册 Pack（含 synthetic fixture）执行 Rights / License 校验，
 * 输出 PUBLISHABLE / BLOCKED / UNKNOWN 统计、licenseStatus 分布、
 * commercial / redistribution 限制标记与明细。
 *
 * 规则（v13.1.txt §6 / §8 / §11，fail closed）：
 * - owned → PUBLISHABLE（显式 redistributionAllowed=false → BLOCKED）
 * - licensed（licenseName/permissionEvidence/licenseUrl 任一）且 redistributionAllowed=true → PUBLISHABLE（warning 发布前复核）
 * - licensed 缺 evidence / redistribution 未确认 → BLOCKED / UNKNOWN（禁止进 production pool）
 * - official_public_material 必须有明确再利用依据（evidence）且 redistributionAllowed=true → PUBLISHABLE；
 *   无依据 / redistribution 未确认 → UNKNOWN；redistributionAllowed=false → BLOCKED
 * - permission_required / unknown / 缺失 → BLOCKED / UNKNOWN（禁止进 production pool）
 * - commercialUseAllowed 未确认 → 在报告中明确显示限制，不静默当作 unrestricted
 * - production 内容池（getPublishableItems）只含 PUBLISHABLE 项
 */
import { registerBuiltinPacks } from "../src/content/packs";
import { listContentPacks, getPackSource, getPublishableItems } from "../src/content/registry";
import { rightsVerdict, bucketOf, rightsIssues, type RightsVerdict } from "../src/content/rights";
import { registerSyntheticPaperFixture } from "../src/content/fixture/cet6-2025-12-synthetic";

registerBuiltinPacks();
registerSyntheticPaperFixture();

const verdictCounts: Record<RightsVerdict, number> = { allowed: 0, blocked: 0, unknown: 0 };
const bucketCounts: Record<string, number> = {};
const rows: string[] = [];
const restrictionRows: string[] = [];

for (const pack of listContentPacks()) {
  const src = getPackSource(pack.id);
  const sourceRights = src?.rights;
  const packRights = pack.rights ?? sourceRights;
  const verdict = rightsVerdict(packRights);
  verdictCounts[verdict]++;
  const bucket = bucketOf(packRights);
  bucketCounts[bucket] = (bucketCounts[bucket] ?? 0) + 1;
  // 权利范围未确认 → 明确显示限制（不静默当作 unrestricted）
  for (const issue of rightsIssues(packRights, { scope: "production" })) {
    if (issue.level === "warning") restrictionRows.push(`  [${pack.id}] ${issue.message}`);
  }
  rows.push(
    `${pack.id} (${pack.contentType}, ${pack.items.length} items) -> ${verdict.toUpperCase()} [licenseStatus=${bucket}]`,
  );
}

// paper item 级 rights 明细
const paperItems = listContentPacks()
  .filter((p) => p.contentType === "paper")
  .flatMap((p) => p.items as { paperId?: string; rights?: unknown }[]);
for (const paper of paperItems) {
  const v = rightsVerdict(paper.rights as never);
  rows.push(`  paper ${paper.paperId} -> ${v.toUpperCase()}`);
}

const pubPool = getPublishableItems();
const pubByType: Record<string, number> = {};
for (const item of pubPool as { type?: string }[]) {
  pubByType[item.type ?? "?"] = (pubByType[item.type ?? "?"] ?? 0) + 1;
}

console.log("=== Content Rights ===");
for (const r of rows) console.log(r);
console.log("--- Verdict counts ---");
console.log(`PUBLISHABLE (allowed): ${verdictCounts.allowed}`);
console.log(`BLOCKED:              ${verdictCounts.blocked}`);
console.log(`UNKNOWN:              ${verdictCounts.unknown}`);
console.log("--- By licenseStatus ---");
for (const [k, v] of Object.entries(bucketCounts)) console.log(`  ${k}: ${v}`);
console.log("--- Restrictions / warnings (commercial & redistribution not confirmed) ---");
if (restrictionRows.length === 0) console.log("  (none)");
for (const r of restrictionRows) console.log(r);
console.log("--- Production publishable pool (must be empty for this phase) ---");
console.log(JSON.stringify(pubByType));

// 失败条件：production publishable pool 中混入 blocked/unknown 内容。
// （raw/staging/audit 中存在 unknown/permission_required 是允许的——v13.1.txt §9）
const illegalInPool = pubPool.some((item) => {
  const rights = (item as { rights?: unknown }).rights as never;
  return rightsVerdict(rights) !== "allowed";
});

if (illegalInPool) {
  console.error("Rights check FAILED: blocked/unknown content must not enter production published pack.");
  process.exit(1);
}
console.log("Rights check PASS: production pool contains only allowed content.");
