/**
 * V13: Rights / License Validation（V13 Phase 1.1: Rights Hardening）
 *
 * 原则（v13.1.txt §5 / §6 / §8 / §11）：
 * - “官方公开”（official_public_material）只说明来源/公开状态，
 *   本身不能自动证明 redistribution / commercial use / derivative 权限；
 *   不要因为 URL 是官方/政府/考试机构/学校就自动允许把完整内容重新发布进产品。
 * - Production publishable（可进入生产内容池）至少要求：
 *     A. owned；或
 *     B. licensed + 有效授权证据（licenseName/permissionEvidence/licenseUrl）且 redistributionAllowed=true；或
 *     C. official_public_material + 明确再利用依据（evidence）且 redistributionAllowed=true；或
 *     D. public_domain + redistributionAllowed=true + 明确公有领域证据（V13 Phase 2B.1 收紧）。
 * - Production 必须 fail closed：
 *     rights 缺失 / licenseStatus unknown / permission_required /
 *     official 无明确依据 / redistributionAllowed != true / licensed 缺 evidence
 *     一律不能进入 production pool。
 * - unknown / permission_required / unverified official 内容允许存在于
 *   raw / staging / audit（人工审查路径），但绝不能进入生产 Selector。
 * - 权利范围不清时 verdict = UNKNOWN 或 BLOCKED，而不是 allowed。
 * - commercialUseAllowed 未确认 → 在 rights report 中明确显示限制，不静默当作 unrestricted。
 */
import type { ContentRights } from "./types";
import { stableIdNamespace } from "./stable-id";
import type { CET6Paper } from "./papers";

export type RightsVerdict = "allowed" | "blocked" | "unknown";

export const BLOCKED_STATUSES = ["permission_required", "unknown"] as const;

function hasEvidence(rights: ContentRights): boolean {
  return Boolean(rights.licenseName || rights.permissionEvidence || rights.licenseUrl);
}

/**
 * 判断内容能否进入 production published pack（fail closed）。
 *
 * - owned：自有内容 → allowed；若显式 redistributionAllowed=false（所有者决定）→ blocked。
 * - public_domain：公有领域（CC0 / 已过保护期）→ redistributionAllowed=true 时 allowed；
 *   未确认 → unknown（不静默放行）。
 * - licensed：必须有有效授权证据，且 redistributionAllowed=true → allowed；
 *   缺证据 → blocked；证据存在但再分发未确认（!= true）→ unknown。
 * - official_public_material：必须有明确再利用依据（evidence）且 redistributionAllowed=true
 *   → allowed；redistributionAllowed=false → blocked；无依据 / 未确认 → unknown。
 * - permission_required → blocked；其余缺失 → unknown。
 */
export function rightsVerdict(rights: ContentRights | undefined | null): RightsVerdict {
  if (!rights || typeof rights !== "object") return "unknown";
  const status = rights.licenseStatus;
  if (status === "owned") {
    if (rights.redistributionAllowed === false) return "blocked";
    return "allowed";
  }
  if (status === "public_domain") {
    // V13 Phase 2B.1 收紧：production allowed 必须 redistributionAllowed=true 且存在明确 evidence
    // （permissionEvidence / licenseUrl / licenseName 等现有 schema 字段）；无 evidence → UNKNOWN → NOT production。
    if (rights.redistributionAllowed === false) return "blocked";
    if (rights.redistributionAllowed !== true || !hasEvidence(rights)) return "unknown";
    return "allowed";
  }
  if (status === "licensed") {
    if (!hasEvidence(rights)) return "blocked";
    if (rights.redistributionAllowed !== true) return "unknown"; // 再分发未确认 → 不能 production
    return "allowed";
  }
  if (status === "official_public_material") {
    if (rights.redistributionAllowed === false) return "blocked";
    // “官方公开”本身不授予再分发权利；必须有明确再利用依据 + redistribution 确认
    if (!hasEvidence(rights) || rights.redistributionAllowed !== true) return "unknown";
    return "allowed";
  }
  if (status === "permission_required") return "blocked";
  return "unknown";
}

/** 简化的可发布判断：rightsVerdict === "allowed"。 */
export function isPublishable(rights: ContentRights | undefined | null): boolean {
  return rightsVerdict(rights) === "allowed";
}

/** 按 licenseStatus 统计桶。 */
export type RightsBucket =
  | "owned"
  | "licensed"
  | "official_public_material"
  | "permission_required"
  | "public_domain"
  | "unknown";

export function bucketOf(rights: ContentRights | undefined | null): RightsBucket {
  if (!rights || typeof rights !== "object") return "unknown";
  return rights.licenseStatus;
}

/**
 * 内容权利校验问题。
 * - scope="production"：blocked / unknown / missing → error（不能进 production pool）；
 *   allowed 但 licensed / official（带依据）→ warning（发布前复核）；
 *   commercialUseAllowed 未确认 → warning（不得当作 unrestricted）。
 * - scope="audit"：missing → warning（staging/审计路径允许保存并提示人工审查）。
 */
export function rightsIssues(
  rights: ContentRights | undefined | null,
  opts: { scope: "production" | "audit" },
): { level: "error" | "warning"; message: string }[] {
  if (!rights || typeof rights !== "object") {
    return opts.scope === "production"
      ? [{ level: "error", message: "missing rights metadata (fail closed)" }]
      : [{ level: "warning", message: "missing rights metadata (staging/audit only)" }];
  }
  const verdict = rightsVerdict(rights);
  if (verdict === "blocked") {
    return [
      {
        level: "error",
        message: `rights blocked: licenseStatus=${rights.licenseStatus} (cannot enter production pool)`,
      },
    ];
  }
  if (verdict === "unknown") {
    return [
      {
        level: "error",
        message: `rights unknown: licenseStatus=${rights.licenseStatus} lacks explicit reuse evidence / redistribution confirmation (cannot enter production pool)`,
      },
    ];
  }
  const issues: { level: "error" | "warning"; message: string }[] = [];
  if (rights.licenseStatus === "licensed") {
    issues.push({
      level: "warning",
      message: "licensed content allowed with evidence (verify permissionEvidence before publish)",
    });
  }
  if (rights.licenseStatus === "official_public_material") {
    issues.push({
      level: "warning",
      message: "official public material allowed with explicit reuse evidence (verify before publish)",
    });
  }
  if (rights.licenseStatus === "public_domain") {
    issues.push({
      level: "warning",
      message: "public_domain claimed — verify CC0 / expiry evidence before publish",
    });
  }
  if (rights.commercialUseAllowed !== true) {
    issues.push({
      level: "warning",
      message: "commercialUseAllowed not confirmed — must not be treated as unrestricted",
    });
  }
  // V14：权利审查状态机。一旦记录了 rightsStatus，production 必须是 "cleared"；
  // unknown/researching/unverified/restricted/expired/revoked 一律 error（fail closed）。
  if (
    opts.scope === "production" &&
    rights.rightsStatus !== undefined &&
    rights.rightsStatus !== "cleared"
  ) {
    issues.push({
      level: "error",
      message: `rightsStatus=${rights.rightsStatus} is not cleared (V14 rights state machine) — cannot enter production pool`,
    });
  }
  return issues;
}

/**
 * V14：判断权利是否处于「已清结且当前有效」状态（fail closed）。
 * 条件：rightsStatus === "cleared"，且未被吊销，且未过期（expiresAt 缺省=永久；
 * 若 expiresAt 存在且早于当前日期 → false）。缺任何字段/非法日期 → false。
 */
export function isRightsCleared(rights: ContentRights | undefined | null): boolean {
  if (!rights || typeof rights !== "object") return false;
  if (rights.rightsStatus !== "cleared") return false;
  // 注：rightsStatus 为单字段状态机；值为 "cleared" 时不可能同时是 "revoked"（revoked 是另一状态值）。
  const now = Date.now();
  if (typeof rights.expiresAt === "string" && rights.expiresAt.trim().length > 0) {
    const exp = Date.parse(rights.expiresAt);
    if (!Number.isFinite(exp) || exp < now) return false;
  }
  return true;
}

/** 是否存在再利用证据（permissionEvidence / licenseName / licenseUrl 任一非空）。 */
function hasRightsEvidence(rights: ContentRights): boolean {
  return Boolean(
    (rights.permissionEvidence && rights.permissionEvidence.trim()) ||
      (rights.licenseName && rights.licenseName.trim()) ||
      (rights.licenseUrl && rights.licenseUrl.trim()),
  );
}

/**
 * V14：REAL Paper production 准入检查（REAL Production Guard）。
 *
 * 仅当全部满足时 eligible=true：
 *   - authenticity === "past_exam"
 *   - stableIdNamespace(paperId) === "real"
 *   - rights.rightsStatus === "cleared"（且未过期/未吊销，见 isRightsCleared）
 *   - rights.redistributionAllowed === true
 *   - rights.commercialUseAllowed === true（production 必须明确，不接受 undefined）
 *   - 证据存在（permissionEvidence / licenseName / licenseUrl 至少一个非空）
 *   - rights.effectiveAt 存在且 <= 当前日期；若有 expiresAt 必须 >= 当前日期
 *   - 内容结构校验 PASS（由调用方把 validatePaper 的 structuralErrors 传入；
 *     本函数不反向调用 validatePaper，避免与 validatePaper 的准入检查相互递归）
 *
 * 返回所有不满足原因（reasons 为空 = eligible）。
 */
export function realProductionEligible(
  paper: CET6Paper,
  structuralErrors?: string[],
): { eligible: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const rights = paper?.rights;

  if (paper?.authenticity !== "past_exam") {
    reasons.push(`authenticity must be "past_exam" for REAL production (got ${String(paper?.authenticity)})`);
  }
  if (stableIdNamespace(paper?.paperId ?? "") !== "real") {
    reasons.push(`paperId must use REAL namespace (cet6:<year>-<session>:set<N>), got ${String(paper?.paperId)}`);
  }
  if (!rights || typeof rights !== "object") {
    reasons.push("missing rights metadata (fail closed)");
  } else {
    if (rights.rightsStatus !== "cleared") {
      reasons.push(`rights.rightsStatus must be "cleared" (got ${String(rights.rightsStatus)})`);
    }
    if (!isRightsCleared(rights)) {
      reasons.push("rights not cleared: expired or revoked or rightsStatus!=cleared (fail closed)");
    }
    if (rights.redistributionAllowed !== true) {
      reasons.push(`rights.redistributionAllowed must be true (got ${String(rights.redistributionAllowed)})`);
    }
    if (rights.commercialUseAllowed !== true) {
      reasons.push(`rights.commercialUseAllowed must be explicitly true for production (got ${String(rights.commercialUseAllowed)})`);
    }
    if (!hasRightsEvidence(rights)) {
      reasons.push("rights evidence missing: permissionEvidence/licenseName/licenseUrl must have at least one");
    }
    // effectiveAt 必须存在且已生效；expiresAt 若存在必须尚未到期
    if (typeof rights.effectiveAt !== "string" || !rights.effectiveAt.trim()) {
      reasons.push("rights.effectiveAt missing (authorization effective date required)");
    } else {
      const eff = Date.parse(rights.effectiveAt);
      if (!Number.isFinite(eff)) {
        reasons.push(`rights.effectiveAt is not a valid ISO date: ${rights.effectiveAt}`);
      } else if (eff > Date.now()) {
        reasons.push(`rights.effectiveAt ${rights.effectiveAt} is in the future (not yet effective)`);
      }
    }
    if (typeof rights.expiresAt === "string" && rights.expiresAt.trim()) {
      const exp = Date.parse(rights.expiresAt);
      if (!Number.isFinite(exp)) {
        reasons.push(`rights.expiresAt is not a valid ISO date: ${rights.expiresAt}`);
      } else if (exp < Date.now()) {
        reasons.push(`rights.expiresAt ${rights.expiresAt} has passed (authorization expired)`);
      }
    }
  }
  if (Array.isArray(structuralErrors) && structuralErrors.length > 0) {
    for (const e of structuralErrors) reasons.push(`content validation failed: ${e}`);
  }
  return { eligible: reasons.length === 0, reasons };
}
