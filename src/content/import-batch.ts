/**
 * V13: Import Batch（导入批次 + deterministic / idempotent 导入）。
 *
 * 真实真题导入基础设施：每次导入同一原始源必须产生完全相同的 stable ID
 * （deterministic），重复导入同源同 ID 不得重复注册（idempotent）。
 *
 * batchId 规则：`import-<sourceId>-<inputFingerprint 前 12 位>`。
 * inputFingerprint 使用 hashString（V10 normalize.ts 已有，确定性）。
 */
import { hashString } from "./normalize";

export interface ImportBatch {
  batchId: string;
  sourceId: string;
  importedAt: string;
  importerVersion: string;
  inputFingerprint: string;
  itemCount: number;
  warnings: string[];
  errors: string[];
  status: "ok" | "failed" | "partial";
}

export const IMPORTER_VERSION = "v13.0.0";

/** 归一化输入文本（只影响指纹稳定性，不解析结构）。 */
function canonicalInput(raw: string): string {
  return raw.replace(/\r\n/g, "\n").trim();
}

/** 输入指纹：对归一化文本的确定性 hash。 */
export function inputFingerprint(raw: string): string {
  const h = hashString(canonicalInput(raw));
  return h.toString(16).padStart(8, "0") + "-" + canonicalInput(raw).length.toString(16);
}

/** 生成 deterministic batchId。 */
export function buildBatchId(sourceId: string, fingerprint: string): string {
  return `import-${sourceId}-${fingerprint.slice(0, 12)}`;
}

/** 创建批次记录（不注册任何内容）。 */
export function createImportBatch(opts: {
  sourceId: string;
  raw: string;
  itemCount: number;
}): ImportBatch {
  const fingerprint = inputFingerprint(opts.raw);
  return {
    batchId: buildBatchId(opts.sourceId, fingerprint),
    sourceId: opts.sourceId,
    importedAt: new Date().toISOString(),
    importerVersion: IMPORTER_VERSION,
    inputFingerprint: fingerprint,
    itemCount: opts.itemCount,
    warnings: [],
    errors: [],
    status: "ok",
  };
}

/** 已导入批次登记（幂等去重依据：同 sourceId + 同 fingerprint → 同 batchId）。 */
const importedBatches = new Map<string, ImportBatch>();

/** 查询已导入批次。 */
export function getImportBatch(batchId: string): ImportBatch | undefined {
  return importedBatches.get(batchId);
}

/** 列出全部已导入批次。 */
export function listImportBatches(): ImportBatch[] {
  return [...importedBatches.values()];
}

/** 登记批次（重复登记同 batchId 返回 false，表示幂等命中）。 */
export function recordImportBatch(batch: ImportBatch): boolean {
  if (importedBatches.has(batch.batchId)) return false;
  importedBatches.set(batch.batchId, batch);
  return true;
}

/** 是否已导入过该原始输入（幂等判定）。 */
export function wasImported(sourceId: string, raw: string): boolean {
  const fingerprint = inputFingerprint(raw);
  return importedBatches.has(buildBatchId(sourceId, fingerprint));
}

/** 测试用：清空批次登记。 */
export function resetImportBatches(): void {
  importedBatches.clear();
}
