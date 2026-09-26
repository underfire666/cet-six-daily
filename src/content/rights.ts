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
 *     C. official_public_material + 明确再利用依据（evidence）且 redistributionAllowed=true。
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

export type RightsVerdict = "allowed" | "blocked" | "unknown";

export const BLOCKED_STATUSES = ["permission_required", "unknown"] as const;

function hasEvidence(rights: ContentRights): boolean {
  return Boolean(rights.licenseName || rights.permissionEvidence || rights.licenseUrl);
}

/**
 * 判断内容能否进入 production published pack（fail closed）。
 *
 * - owned：自有内容 → allowed；若显式 redistributionAllowed=false（所有者决定）→ blocked。
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
  if (rights.commercialUseAllowed !== true) {
    issues.push({
      level: "warning",
      message: "commercialUseAllowed not confirmed — must not be treated as unrestricted",
    });
  }
  return issues;
}
