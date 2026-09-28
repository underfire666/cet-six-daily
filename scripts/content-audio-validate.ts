/**
 * V13 Phase 2D：Audio Integrity Validator
 * 校验 Paper 音频资产（不做 OCR/语音识别，只做确定性文件/元数据检查）：
 * - placeholder（mock://）不得残留（Paper 001 音频已真实生成）
 * - 音频文件存在、size > 0、sizeBytes 与文件一致
 * - checksum 与文件 SHA-256 一致（从实际文件计算）
 * - duration 存在且 > 最小阈值
 * - mimeType / format / provenance / rights 元数据完整
 * - assetId 唯一（paper 内 + 全库）、group assetIds 引用可解析
 */
import * as fs from "node:fs";
import * as path from "node:path";
import * as crypto from "node:crypto";
import { registerBuiltinPacks } from "../src/content/packs";
import { listContentPacks } from "../src/content/registry";
import { registerSyntheticPaperFixture } from "../src/content/fixture/cet6-2025-12-synthetic";
import {  } from "../src/content/papers/cet6-mock-paper-001";
import { getPaperById } from "../src/content/registry";
import { MOCK_PAPER_001_ID } from "../src/content/papers/cet6-mock-paper-001";

const PUBLIC_ROOT = path.resolve(__dirname, "../public");
const MIN_DURATION_S = 30;

registerBuiltinPacks();
registerSyntheticPaperFixture();

const errors: string[] = [];
const warnings: string[] = [];
const seenAssetIds = new Map<string, string>();

function sha256File(p: string): string {
  const b = fs.readFileSync(p);
  return crypto.createHash("sha256").update(b).digest("hex");
}

function resolvePublicPath(source: string): string | null {
  if (!source.startsWith("/audio/")) return null;
  return path.join(PUBLIC_ROOT, source.replace(/^\//, ""));
}

const packs = listContentPacks();
let audioCount = 0;
let placeholderCount = 0;

for (const pack of packs) {
  for (const item of pack.items) {
    const paper = item as { paperId?: string; assets?: Array<Record<string, unknown>> };
    if (!paper.paperId || !Array.isArray(paper.assets)) continue;
    for (const asset of paper.assets) {
      if (asset.type !== "audio") continue;
      audioCount++;
      const assetId = String(asset.assetId ?? "");
      if (seenAssetIds.has(assetId)) {
        errors.push(`audio assetId 重复: ${assetId}（${seenAssetIds.get(assetId)} 与 ${paper.paperId}）`);
      } else {
        seenAssetIds.set(assetId, paper.paperId);
      }
      const source = String(asset.source ?? "");
      if (source.startsWith("mock://")) {
        placeholderCount++;
        // fixture（TEST FIXTURE）允许 placeholder；非 fixture 的 paper（如 Paper 001）必须为 0。
        const isFixture = String((item as { fixture?: boolean }).fixture ?? "") === "true";
        if (isFixture) {
          warnings.push(`${paper.paperId} audio ${assetId}: fixture placeholder mock://（允许，测试夹具）`);
        } else {
          errors.push(`${paper.paperId} audio ${assetId}: placeholder 残留 mock://（Phase 2D 应全部替换为真实音频）`);
        }
        continue;
      }
      const fp = resolvePublicPath(source);
      if (!fp || !fs.existsSync(fp)) {
        errors.push(`${paper.paperId} audio ${assetId}: 文件不存在 source=${source}`);
        continue;
      }
      const stat = fs.statSync(fp);
      if (stat.size <= 0) errors.push(`${paper.paperId} audio ${assetId}: 文件为空`);
      // checksum（从实际文件计算）
      if (asset.checksum) {
        const actual = sha256File(fp);
        if (actual !== String(asset.checksum)) {
          errors.push(`${paper.paperId} audio ${assetId}: checksum 不匹配（asset=${asset.checksum} actual=${actual}）`);
        }
      } else {
        errors.push(`${paper.paperId} audio ${assetId}: 缺少 checksum`);
      }
      // sizeBytes 与文件一致
      if (typeof asset.sizeBytes === "number" && asset.sizeBytes !== stat.size) {
        errors.push(`${paper.paperId} audio ${assetId}: sizeBytes 不匹配（asset=${asset.sizeBytes} actual=${stat.size}）`);
      }
      // duration
      const duration = Number(asset.duration ?? 0);
      if (!(duration > MIN_DURATION_S)) {
        errors.push(`${paper.paperId} audio ${assetId}: duration 缺失或过小（${duration}，min ${MIN_DURATION_S}s）`);
      }
      // mimeType / format
      if (asset.mimeType !== "audio/mpeg") {
        warnings.push(`${paper.paperId} audio ${assetId}: mimeType 非 audio/mpeg（${asset.mimeType}）`);
      }
      // provenance 完整
      for (const field of ["sizeBytes", "contentVersion", "generatedAt", "provider", "voice", "termsCheckedDate"]) {
        if (asset[field] === undefined || asset[field] === null || String(asset[field]) === "") {
          errors.push(`${paper.paperId} audio ${assetId}: 缺少 provenance 字段 ${field}`);
        }
      }
      // rights 完整
      const rights = asset.rights as { licenseStatus?: string; rightsHolder?: string; notes?: string } | undefined;
      if (!rights || !rights.licenseStatus || !rights.rightsHolder || !rights.notes) {
        errors.push(`${paper.paperId} audio ${assetId}: rights metadata 不完整`);
      }
    }
  }
}

// group assetIds 引用解析（cross-check）
const paper001 = getPaperById(MOCK_PAPER_001_ID) as {
  paperId?: string;
  assets?: Array<{ assetId: string; type?: string }>;
  sections?: Array<{ groups?: Array<{ groupId?: string; assetIds?: string[] }> }>;
} | undefined;
if (!paper001) {
  errors.push(`mock paper 001 无法解析: ${MOCK_PAPER_001_ID}`);
} else {
  const known = new Set((paper001.assets ?? []).map((a) => a.assetId));
  for (const sec of paper001.sections ?? []) {
    for (const g of sec.groups ?? []) {
      for (const aid of g.assetIds ?? []) {
        if (!known.has(aid)) errors.push(`group ${g.groupId} 引用未知 asset ${aid}`);
      }
    }
  }
  // V13 Phase 2D.1：Paper 001 应有 7 个音频（2 long conv + 2 passage + 3 lecture）且无 placeholder
  const audios = (paper001.assets ?? []).filter((a) => a.type === "audio");
  if (audios.length !== 7) errors.push(`mock paper 001 audio assets=${audios.length}（预期 7，官方 CET6 listening materials）`);
}

console.log("=== Content Audio Validate ===");
console.log(`Audio assets total: ${audioCount}`);
console.log(`Placeholders remaining: ${placeholderCount}`);
console.log(`Errors: ${errors.length}`);
console.log(`Warnings: ${warnings.length}`);
for (const e of errors) console.error(`  ERROR ${e}`);
for (const w of warnings) console.warn(`  WARN  ${w}`);
process.exit(errors.length > 0 ? 1 : 0);
