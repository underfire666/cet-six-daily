/**
 * V13: `npm run content:rights`
 * 对全部已注册 Pack（含 synthetic fixture）执行 Rights / License 校验，
 * 输出 PUBLISHABLE / BLOCKED / UNKNOWN 统计与明细。
 *
 * 规则：
 * - owned / official_public_material → PUBLISHABLE
 * - licensed（有授权证据）→ PUBLISHABLE（warning 提示发布前复核）
 * - permission_required / unknown / 缺失 → BLOCKED / UNKNOWN（禁止进 production pack）
 * - production 内容池（getPublishableItems）只含 PUBLISHABLE 项
 */
import { registerBuiltinPacks } from "../src/content/packs";
import { listContentPacks, getPackSource, getPublishableItems } from "../src/content/registry";
import { rightsVerdict, bucketOf, type RightsVerdict } from "../src/content/rights";
import { registerSyntheticPaperFixture } from "../src/content/fixture/cet6-2025-12-synthetic";

registerBuiltinPacks();
registerSyntheticPaperFixture();

const verdictCounts: Record<RightsVerdict, number> = { allowed: 0, blocked: 0, unknown: 0 };
const bucketCounts: Record<string, number> = {};
const rows: string[] = [];

for (const pack of listContentPacks()) {
  const src = getPackSource(pack.id);
  const sourceRights = src?.rights;
  const packRights = pack.rights ?? sourceRights;
  const verdict = rightsVerdict(packRights);
  verdictCounts[verdict]++;
  const bucket = bucketOf(packRights);
  bucketCounts[bucket] = (bucketCounts[bucket] ?? 0) + 1;
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
console.log("--- Production publishable pool (must be empty for this phase) ---");
console.log(JSON.stringify(pubByType));

// 失败条件：production publishable pool 中混入 blocked/unknown 内容。
// （raw/staging/audit 中存在 unknown/permission_required 是允许的——v13.txt §15）
const illegalInPool = pubPool.some((item) => {
  const rights = (item as { rights?: unknown }).rights as never;
  return rightsVerdict(rights) !== "allowed";
});

if (illegalInPool) {
  console.error("Rights check FAILED: blocked/unknown content must not enter production published pack.");
  process.exit(1);
}
console.log("Rights check PASS: production pool contains only allowed content.");
