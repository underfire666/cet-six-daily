/**
 * V14：PRIVATE 用户导入合约（Phase 0 —— 仅类型 + 验证函数，不实现 UI / 存储 / 服务端）。
 *
 * 核心原则（v14.1.1.txt §10–§13）：
 * - 用户自行上传的内容（PDF / 图片 / 文本 / 音频）仅属于该用户的 private workspace。
 * - server 必须从 auth session 派生 ownerId，绝不能信任 client 提供的 ownerId。
 * - PRIVATE 内容：redistributable=false / productionEligible=false /
 *   globalSelectorEligible=false / shareEligible=false（V14 初版）。
 * - 不得进入 global registry / public REAL 列表 / 其他用户 sync snapshot / production pool。
 * - A 用户不得访问 B 用户的 private paper（assertPrivateAccess 在 review replay / sync 前强制）。
 *
 * Phase 0 只形成明确 contract；不开始 21-Day Sprint UI / AI / 真实导入。
 */
import { stableIdNamespace } from "./stable-id";

/** Phase 0：仅 private（未来可能扩展 shared/org 等，本期不实现）。 */
export type PrivateVisibility = "private";

/** V14 PRIVATE 内容永不进入 global production selector（编译期常量）。 */
export const PRIVATE_NEVER_IN_GLOBAL_SELECTOR = true as const;

/** 用户导入权利确认（用户声明对上传内容拥有合法使用权，仅用于个人学习）。 */
export interface PrivateRightsAcknowledgement {
  /** 用户是否已确认权利声明。 */
  acknowledged: boolean;
  /** 确认时间（ISO 8601，server 记录）。 */
  acknowledgedAt: string;
  /** 声明文案版本号（未来文案变更时要求重新确认）。 */
  statementVersion: string;
}

/**
 * V14 PRIVATE 用户导入内容元数据。
 * paperId 格式：private:<owner-scoped-id>:<paper-id>（owner scoped，不直接暴露敏感身份）。
 */
export interface PrivateContentMeta {
  /** server 从 auth session 派生，不信任 client 提供。 */
  ownerId: string;
  /** owner 命名空间（如 "user:<hash>"），不直接暴露敏感身份。 */
  ownerNamespace: string;
  visibility: PrivateVisibility;
  /** 私有内容不可再分发。 */
  redistributable: false;
  /** 私有内容永不进入 production pool。 */
  productionEligible: false;
  /** 私有内容永不进入 global selector。 */
  globalSelectorEligible: false;
  /** V14 初版不可分享。 */
  shareEligible: false;
  /** stable ID：private:<owner-scoped-id>:<paper-id>。 */
  paperId: string;
  /** 导入时间（ISO 8601）。 */
  importedAt: string;
  /** 用户权利使用确认。 */
  rightsAcknowledgement: PrivateRightsAcknowledgement;
}

/**
 * 生成 PRIVATE paper stable ID：private:<owner-scoped-id>:<paper-id>。
 * ownerScopedId 为不含冒号的 owner 作用域标识（如 "user-a" / "u-<hash>"）。
 */
export function privatePaperStableId(ownerScopedId: string, paperId: string): string {
  if (typeof ownerScopedId !== "string" || !ownerScopedId.trim()) {
    throw new Error("privatePaperStableId: ownerScopedId required");
  }
  if (ownerScopedId.includes(":")) {
    throw new Error("privatePaperStableId: ownerScopedId must not contain ':'");
  }
  if (typeof paperId !== "string" || !paperId.trim()) {
    throw new Error("privatePaperStableId: paperId required");
  }
  return `private:${ownerScopedId}:${paperId}`;
}

/** 判断 id 是否为 PRIVATE namespace stable ID。 */
export function isPrivateStableId(id: string): boolean {
  return stableIdNamespace(id) === "private";
}

/**
 * owner 访问授权：A 用户不得访问 B 用户的 private paper。
 * sessionOwnerId 必须由 server 从 auth session 派生后传入（不信任 client）。
 */
export function assertPrivateAccess(content: PrivateContentMeta, sessionOwnerId: string): boolean {
  if (!content || typeof content !== "object") return false;
  if (typeof sessionOwnerId !== "string" || !sessionOwnerId) return false;
  return content.ownerId === sessionOwnerId;
}

// ============================================================================
// V14 Phase 1A：PRIVATE Paper 校验与隔离合约
// ============================================================================

/** SOURCE_D_PRIVATE_USER_IMPORT：用户个人导入内容的 canonical source class。 */
export const SOURCE_D_PRIVATE_USER_IMPORT = "SOURCE_D_PRIVATE_USER_IMPORT" as const;

/**
 * 判断一个内容项是否为 PRIVATE（visibility=private 或 stable ID namespace=private）。
 * 用于 production selector / public search / sync 等场景的排除判断。
 */
export function isPrivateContent(item: { visibility?: string; id?: string; paperId?: string }): boolean {
  if (!item || typeof item !== "object") return false;
  if (item.visibility === "private") return true;
  const id = item.paperId ?? item.id;
  if (typeof id === "string" && stableIdNamespace(id) === "private") return true;
  return false;
}

/**
 * V14 Phase 1A：PRIVATE Paper 校验（validatePrivatePaper）。
 *
 * 检查项（任一不满足 → 拒绝保存）：
 * 1. visibility === "private"
 * 2. authenticity === "user_import"（或 past_exam 但明确标记为 private owner import）
 * 3. ownerId 存在且非空（由 server 从 auth session 派生）
 * 4. paperId namespace === "private"
 * 5. productionEligible === false（或未设置，PRIVATE 永不 production）
 * 6. globalSelectorEligible === false
 * 7. redistributionAllowed === false（或 rights.redistributionAllowed !== true）
 * 8. rightsAcknowledgement 已确认（acknowledged=true + acknowledgedAt 存在）
 *
 * 返回所有不满足原因（空数组 = 通过）。
 */
export function validatePrivatePaper(paper: {
  visibility?: string;
  authenticity?: string;
  ownerId?: string;
  paperId?: string;
  id?: string;
  productionEligible?: boolean;
  globalSelectorEligible?: boolean;
  rights?: { redistributionAllowed?: boolean };
  rightsAcknowledgement?: { acknowledged?: boolean; acknowledgedAt?: string };
}): string[] {
  const errors: string[] = [];
  if (!paper || typeof paper !== "object") {
    errors.push("private paper: paper object required");
    return errors;
  }
  // 1. visibility
  if (paper.visibility !== "private") {
    errors.push(`private paper: visibility must be "private" (got ${String(paper.visibility)})`);
  }
  // 2. authenticity
  if (paper.authenticity !== "user_import" && paper.authenticity !== "past_exam") {
    errors.push(`private paper: authenticity must be "user_import" or "past_exam" (got ${String(paper.authenticity)})`);
  }
  // 3. ownerId
  if (typeof paper.ownerId !== "string" || !paper.ownerId.trim()) {
    errors.push("private paper: ownerId required (must be derived from server auth session)");
  }
  // 4. paperId namespace
  const pid = paper.paperId ?? paper.id;
  if (typeof pid !== "string" || stableIdNamespace(pid) !== "private") {
    errors.push(`private paper: paperId must use private namespace (got ${String(pid)})`);
  }
  // 5. productionEligible
  if (paper.productionEligible === true) {
    errors.push("private paper: productionEligible must be false");
  }
  // 6. globalSelectorEligible
  if (paper.globalSelectorEligible === true) {
    errors.push("private paper: globalSelectorEligible must be false");
  }
  // 7. redistribution
  if (paper.rights && paper.rights.redistributionAllowed === true) {
    errors.push("private paper: redistributionAllowed must be false");
  }
  // 8. rights acknowledgement
  if (!paper.rightsAcknowledgement || paper.rightsAcknowledgement.acknowledged !== true) {
    errors.push("private paper: rightsAcknowledgement.acknowledged must be true");
  } else if (typeof paper.rightsAcknowledgement.acknowledgedAt !== "string" || !paper.rightsAcknowledgement.acknowledgedAt.trim()) {
    errors.push("private paper: rightsAcknowledgement.acknowledgedAt required");
  }
  return errors;
}

/**
 * 从 ownerId 派生 owner-scoped namespace（不直接暴露 email / 敏感身份）。
 * 实际实现中应使用 server-side hash（如 SHA-256 of user internal id + salt），
 * 此处提供 contract 级别的格式校验函数。
 */
export function isValidOwnerScopedId(id: string): boolean {
  if (typeof id !== "string" || !id.trim()) return false;
  if (id.includes(":")) return false;
  // 不允许直接暴露 email 格式（含 @）
  if (id.includes("@")) return false;
  return id.length >= 3 && id.length <= 128;
}