/**
 * V10: Content Importer
 * Raw JSON → Parse → Normalize → Validate → Duplicate Check → ContentPack → Registry
 *
 * 定位：给项目一份合法、结构正确的 ContentPack JSON，无需修改五大学习页面即可导入。
 * 只做代码层入口，不做 CSV/TXT UI、后台上传页、数据库或远程 API。
 *
 * 拒绝：invalid JSON / missing id / unknown source / duplicate id /
 *       invalid correctAnswer / invalid contentType。
 * 纯元数据（createdAt/updatedAt/version/status/authenticity/sourceId/type）缺失时补合理默认，
 * 其余关键字段一律交给 ContentValidator 严格校验。
 */
import type { ContentPack, ContentMeta } from "./types";
import { registerContentPack } from "./registry";
import { validatePack } from "./validator";
import { createImportBatch, recordImportBatch, wasImported, type ImportBatch } from "./import-batch";

export class ContentImportError extends Error {
  readonly issues: string[];
  constructor(message: string, issues: string[] = []) {
    super(message);
    this.name = "ContentImportError";
    this.issues = issues;
  }
}

const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);

const CONTENT_TYPES: ContentMeta["type"][] = [
  "vocabulary",
  "reading",
  "listening",
  "translation",
  "writing",
  "paper",
];

/** 解析 Raw JSON，拒绝语法错误。 */
function parseJson(raw: string): unknown {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new ContentImportError("invalid JSON: cannot parse raw content pack");
  }
  return value;
}

/** 轻量归一化：校验顶层结构 + 补齐纯元数据默认值。不掩盖关键字段缺失。 */
export function normalizeImportedPack(value: unknown): ContentPack {
  if (!object(value)) {
    throw new ContentImportError("content pack must be a JSON object");
  }
  for (const key of ["id", "name", "version", "contentType", "sourceId", "items"]) {
    if (value[key] === undefined || value[key] === null) {
      throw new ContentImportError(`missing pack field: ${key}`);
    }
  }
  const contentType = String(value.contentType);
  if (!CONTENT_TYPES.includes(contentType as ContentMeta["type"])) {
    throw new ContentImportError(`invalid contentType: ${contentType}`);
  }
  if (!Array.isArray(value.items)) {
    throw new ContentImportError("items must be an array");
  }
  const now = new Date().toISOString();
  const pack = value as unknown as ContentPack;
  const items: unknown[] = pack.items.map((item) => {
    if (!object(item)) return item;
    const normalized: Record<string, unknown> = {
      // 关键元数据：条目缺失时继承 pack 的合理默认（不伪造内容本身）
      ...(item.createdAt === undefined ? { createdAt: pack.createdAt ?? now } : {}),
      ...(item.updatedAt === undefined ? { updatedAt: pack.updatedAt ?? now } : {}),
      ...(item.version === undefined ? { version: pack.version } : {}),
      ...(item.sourceId === undefined ? { sourceId: pack.sourceId } : {}),
      ...(item.status === undefined ? { status: "active" } : {}),
      ...(item.authenticity === undefined ? { authenticity: "practice" } : {}),
      ...(item.type === undefined ? { type: pack.contentType } : {}),
      // vocabulary 允许空 secondaryMeanings，缺省时补空数组（合法结构默认，不伪造内容）
      ...((item.type ?? pack.contentType) === "vocabulary" &&
      item.secondaryMeanings === undefined
        ? { secondaryMeanings: [] }
        : {}),
      // tags 允许为空
      ...(item.tags === undefined ? { tags: [] } : {}),
      ...item,
    };
    return normalized;
  });
  return {
    ...pack,
    items,
    createdAt: pack.createdAt ?? now,
    updatedAt: pack.updatedAt ?? now,
  } as ContentPack;
}

/**
 * Raw JSON → ContentPack（校验通过才返回；任何 error 级问题直接抛 ContentImportError）。
 * 此步不注册，调用方可先检查再决定是否入库。
 */
export function importContentPackFromJson(raw: string): ContentPack {
  const pack = normalizeImportedPack(parseJson(raw));
  const issues = validatePack(pack);
  if (issues.length > 0) {
    throw new ContentImportError(
      `content pack validation failed (${issues.length} error(s))`,
      issues.map((i) => `${i.itemId ?? i.packId}: ${i.message}`),
    );
  }
  return pack;
}

/**
 * Raw JSON → ContentPack → Registry（跨 pack 重复 id、重复 pack id、unknown source
 * 由 registerContentPack 抛出；默认 strict，生产环境可显式放宽到 strict:false 以隔离坏记录）。
 */
export function importAndRegisterContentPack(
  raw: string,
  options: { strict?: boolean } = {},
): ContentPack {
  const pack = importContentPackFromJson(raw);
  registerContentPack(pack, options);
  return pack;
}

/**
 * V13：带 Import Batch 的确定性 + 幂等导入。
 * - deterministic：同一原始输入（raw 文本）永远产生相同 inputFingerprint / batchId，
 *   内容 stable ID 由导入方按源内容确定性给出（同一源同一题永远同 ID）。
 * - idempotent：同一 sourceId + 同一 fingerprint 已导入时，默认跳过重复注册
 *   （skipIfImported: true），不产生重复 pack / 重复内容。
 * - 返回 { pack, batch, imported }：imported=false 表示幂等命中，未重复注册。
 */
export interface ImportWithBatchResult {
  pack: ContentPack;
  batch: ImportBatch;
  imported: boolean;
}

export function importContentPackWithBatch(
  raw: string,
  options: { strict?: boolean; skipIfImported?: boolean } = {},
): ImportWithBatchResult {
  const pack = importContentPackFromJson(raw);
  const batch = createImportBatch({
    sourceId: pack.sourceId,
    raw,
    itemCount: Array.isArray(pack.items) ? pack.items.length : 0,
  });
  const skip = options.skipIfImported ?? true;
  if (skip && wasImported(pack.sourceId, raw)) {
    return { pack, batch, imported: false };
  }
  registerContentPack(pack, options);
  recordImportBatch(batch);
  return { pack, batch, imported: true };
}
