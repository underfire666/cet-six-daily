/**
 * V13: Rights / License Validation
 *
 * 规则（v13.txt §6 / §15）：
 * - unknown / permission_required 的内容允许进入 raw / staging / audit，
 *   但默认禁止进入 production published pack。
 * - sourceType=official 不自动等价为 unrestricted redistribution。
 * - 测试必须覆盖：unknown → blocked；permission_required → blocked；
 *   owned → allowed；licensed + valid evidence → allowed。
 */
import type { ContentRights } from "./types";

export type RightsVerdict = "allowed" | "blocked" | "unknown";

export const BLOCKED_STATUSES = ["permission_required", "unknown"] as const;

/** 判断内容能否进入 production published pack。 */
export function rightsVerdict(rights: ContentRights | undefined | null): RightsVerdict {
  if (!rights || typeof rights !== "object") return "unknown";
  const status = rights.licenseStatus;
  if (status === "owned") return "allowed";
  if (status === "official_public_material") return "allowed";
  if (status === "licensed") {
    // licensed 必须有有效授权证据（licenseName 或 permissionEvidence）才 allowed
    const evidence = rights.licenseName || rights.permissionEvidence || rights.licenseUrl;
    if (evidence) return "allowed";
    return "blocked";
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

/** 生成内容权利校验问题（error 级：blocked/unknown 进 production；warning 级：licensed 缺证据但非生产）。 */
export function rightsIssues(
  rights: ContentRights | undefined | null,
  opts: { scope: "production" | "audit" },
): { level: "error" | "warning"; message: string }[] {
  if (!rights || typeof rights !== "object") {
    return opts.scope === "production"
      ? [{ level: "error", message: "missing rights metadata" }]
      : [{ level: "warning", message: "missing rights metadata" }];
  }
  const verdict = rightsVerdict(rights);
  if (verdict === "blocked") {
    return [
      {
        level: "error",
        message: `rights blocked: licenseStatus=${rights.licenseStatus} (permission_required/unknown cannot enter production pack)`,
      },
    ];
  }
  if (verdict === "unknown") {
    return [{ level: "error", message: "rights unknown: cannot enter production pack" }];
  }
  if (verdict === "allowed" && rights.licenseStatus === "licensed") {
    return [
      {
        level: "warning",
        message: "licensed content allowed with evidence (verify permissionEvidence before publish)",
      },
    ];
  }
  return [];
}
