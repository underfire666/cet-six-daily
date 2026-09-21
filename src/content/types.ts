/**
 * V10 统一内容层基础类型。
 * 原则：公共 Metadata + 专项数据结构；不强制所有专项字段一致。
 * 旧数据（V3–V7）通过 Adapter 注册为 ContentPack，UI 暂不强制改。
 */

/** 内容难度：与 reading/listening 现有 "easy|normal|hard" 对齐；vocabulary 1-5 映射后使用。 */
export type ContentDifficulty = "easy" | "normal" | "hard";

/** 内容生命周期状态。deprecated 不删，历史仍可显示。 */
export type ContentStatus = "draft" | "active" | "deprecated";

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
}

/** 内容别名：旧 ID → 新 stable ID。当前 identity，但预留迁移能力。 */
export interface ContentAlias {
  legacyId: string;
  stableId: string;
}
