/**
 * V10 统一内容层基础类型。
 * 原则：公共 Metadata + 专项数据结构；不强制所有专项字段一致。
 * 旧数据（V3–V7）通过 Adapter 注册为 ContentPack，UI 暂不强制改。
 */

/** 内容难度：与 reading/listening 现有 "easy|normal|hard" 对齐；vocabulary 1-5 映射后使用。 */
export type ContentDifficulty = "easy" | "normal" | "hard";

/** 内容生命周期状态。deprecated 不删，历史仍可显示。 */
export type ContentStatus = "draft" | "active" | "deprecated";

/**
 * V13 内容生命周期（完整管线）。
 * raw 原始输入 → normalized → validated → reviewed → publishable → published；
 * deprecated 表示下线但历史保留。V10 的 draft/active 与 raw/published 概念对齐，
 * 学习页消费只取 published/active（demo 模式对内置 mock 放行）。
 */
export type ContentLifecycle =
  | "raw"
  | "normalized"
  | "validated"
  | "reviewed"
  | "publishable"
  | "published"
  | "deprecated";

/** V13：权利状态。unknown / permission_required 默认禁止进入 production published pack。 */
export type ContentLicenseStatus =
  | "owned"
  | "licensed"
  | "official_public_material"
  | "permission_required"
  | "unknown"
  /** V13 Phase 2B：公有领域（CC0 / 已过保护期等）。与 owned 一样可 production（fail-closed 仍需 redistribution 确认）。 */
  | "public_domain";

/** 内容质量状态（V10 不做后台审核，仅预留字段）。 */
export type ContentQuality = "draft" | "reviewed" | "approved";

/** 内容来源类型。 */
export type ContentSourceType =
  | "original"
  | "official"
  | "licensed"
  | "user_provided"
  | "mock";

/** 授权类型。licenseType=unknown 的内容不进 production 内容池。 */
export type ContentLicense = "original" | "public" | "licensed" | "unknown";

/** V13：来源溯源元数据（扩展 ContentSource，不建平行体系）。 */
export interface ContentProvenance {
  sourceType: ContentSourceType;
  sourceTitle?: string;
  sourceUrl?: string;
  publisher?: string;
  rightsHolder?: string;
  publishedAt?: string;
  retrievedAt?: string;
  sourceDocumentId?: string;
  sourcePage?: string;
  importBatchId?: string;
  /** 原始输入指纹（deterministic），用于重复导入检测。 */
  sourceFingerprint?: string;
}

/** V13：权利 / License 元数据。每个可发布 Content Pack 必须有明确 rights。 */
export interface ContentRights {
  licenseStatus: ContentLicenseStatus;
  rightsHolder?: string;
  licenseName?: string;
  licenseUrl?: string;
  permissionEvidence?: string;
  allowedUses?: string[];
  attribution?: string;
  commercialUseAllowed?: boolean;
  redistributionAllowed?: boolean;
  derivativeAllowed?: boolean;
  verifiedAt?: string;
  notes?: string;
}

/** 内容来源登记。 */
export interface ContentSource {
  id: string;
  name: string;
  type: ContentSourceType;
  licenseType: ContentLicense;
  sourceUrl?: string;
  publisher?: string;
  year?: number;
  notes?: string;
  /** V13：来源溯源与权利元数据（可选，向后兼容）。 */
  provenance?: ContentProvenance;
  rights?: ContentRights;
}

/** 内容标签类别：topic 主题 + skill 技能点。 */
export interface ContentTags {
  topics?: string[];
  skillTags?: string[];
}

/** 所有正式内容共享的元信息。 */
export interface ContentMeta {
  /** 稳定 ID，一次生成不变。 */
  id: string;
  type: "vocabulary" | "reading" | "listening" | "translation" | "writing" | "paper";
  title: string;
  difficulty: ContentDifficulty;
  sourceId: string;
  tags: string[];
  skillTags?: string[];
  version: string;
  status: ContentStatus;
  qualityStatus?: ContentQuality;
  createdAt: string;
  updatedAt: string;
  /** 真题 / 原创 / 练习区分，杜绝把原创标成真题。 */
  authenticity: "original" | "practice" | "past_exam";
  /** V13：数据结构版本（区别于 contentVersion 内容修订）。 */
  schemaVersion?: string;
  /** V13：内容修订版本——修正 typo / 补充解析 / 修正 transcript 时递增，stable ID 不变。 */
  contentVersion?: string;
  /** V13：本次内容修订原因（随 contentVersion 记录）。 */
  changeReason?: string;
  /** V13：条目级权利元数据（缺省继承 pack/source）。 */
  rights?: ContentRights;
  /** V13：条目级来源溯源（缺省继承 pack/source）。 */
  provenance?: ContentProvenance;
}

/** 一个内容包。未来可拆成多个 pack。 */
export interface ContentPack<T = unknown> {
  id: string;
  name: string;
  version: string;
  contentType: ContentMeta["type"];
  sourceId: string;
  items: T[];
  createdAt: string;
  updatedAt: string;
  /** V13：pack 级结构版本。 */
  schemaVersion?: string;
  /** V13：pack 级权利元数据（可发布 pack 强制要求）。 */
  rights?: ContentRights;
  /** V13：pack 级来源溯源。 */
  provenance?: ContentProvenance;
}

/** 内容别名：旧 ID → 新 stable ID。当前 identity，但预留迁移能力。 */
export interface ContentAlias {
  legacyId: string;
  stableId: string;
}
