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

/** V14.1：REAL production 可接受的明确授权依据。implied_by_terms 不在此列。 */
const CANONICAL_PERMISSION_BASIS = new Set(["signed_contract", "written_permission", "explicit_license"]);

/**
 * V14.1：检查单个 rights 对象是否满足 REAL production 准入（fail closed）。
 * 返回所有不满足原因（空数组 = 通过）。
 *
 * 检查项：
 *   - rights 对象存在
 *   - rightsStatus === "cleared"
 *   - permissionBasis 存在且为明确授权依据（非 implied_by_terms）
 *   - termType 存在（fixed | perpetual），不得根据缺失推断永久
 *   - fixed: effectiveAt + expiresAt 均存在且有效且未过期
 *   - perpetual: effectiveAt 存在且有效 + 明确永久证据（permissionEvidence 非空）
 *   - redistributionAllowed === true
 *   - commercialUseAllowed === true
 *   - 权利证据存在（permissionEvidence / licenseName / licenseUrl 至少一个）
 */
export function checkRightsProductionReady(
  rights: ContentRights | undefined | null,
  label: string,
): string[] {
  const reasons: string[] = [];
  if (!rights || typeof rights !== "object") {
    reasons.push(`${label}: missing rights object (fail closed)`);
    return reasons;
  }
  if (rights.rightsStatus !== "cleared") {
    reasons.push(`${label}: rightsStatus must be "cleared" (got ${String(rights.rightsStatus)})`);
  }
  // V14.1：permissionBasis 必须为明确授权依据；implied_by_terms 单独不足
  if (!rights.permissionBasis || !rights.permissionBasis.trim()) {
    reasons.push(`${label}: permissionBasis missing (explicit authorization basis required for REAL production)`);
  } else if (rights.permissionBasis === "implied_by_terms") {
    reasons.push(`${label}: permissionBasis=implied_by_terms is not sufficient for REAL production (requires signed_contract/written_permission/explicit_license)`);
  } else if (!CANONICAL_PERMISSION_BASIS.has(rights.permissionBasis)) {
    reasons.push(`${label}: permissionBasis="${rights.permissionBasis}" is not a canonical basis (accepted: signed_contract/written_permission/explicit_license)`);
  }
  // V14.1：termType 必须显式声明，不得根据缺失推断永久
  if (!rights.termType) {
    reasons.push(`${label}: termType missing (must be "fixed" or "perpetual"; missing term is NOT inferred as perpetual)`);
  } else if (rights.termType === "fixed") {
    if (typeof rights.effectiveAt !== "string" || !rights.effectiveAt.trim()) {
      reasons.push(`${label}: fixed term requires effectiveAt`);
    } else {
      const eff = Date.parse(rights.effectiveAt);
      if (!Number.isFinite(eff)) reasons.push(`${label}: effectiveAt is not a valid ISO date: ${rights.effectiveAt}`);
      else if (eff > Date.now()) reasons.push(`${label}: effectiveAt ${rights.effectiveAt} is in the future (not yet effective)`);
    }
    if (typeof rights.expiresAt !== "string" || !rights.expiresAt.trim()) {
      reasons.push(`${label}: fixed term requires expiresAt`);
    } else {
      const exp = Date.parse(rights.expiresAt);
      if (!Number.isFinite(exp)) reasons.push(`${label}: expiresAt is not a valid ISO date: ${rights.expiresAt}`);
      else if (exp < Date.now()) reasons.push(`${label}: expiresAt ${rights.expiresAt} has passed (authorization expired)`);
    }
  } else if (rights.termType === "perpetual") {
    if (typeof rights.effectiveAt !== "string" || !rights.effectiveAt.trim()) {
      reasons.push(`${label}: perpetual term requires effectiveAt`);
    } else {
      const eff = Date.parse(rights.effectiveAt);
      if (!Number.isFinite(eff)) reasons.push(`${label}: effectiveAt is not a valid ISO date: ${rights.effectiveAt}`);
      else if (eff > Date.now()) reasons.push(`${label}: effectiveAt ${rights.effectiveAt} is in the future (not yet effective)`);
    }
    // perpetual 需要明确永久证据（permissionEvidence 非空）
    if (!rights.permissionEvidence || !rights.permissionEvidence.trim()) {
      reasons.push(`${label}: perpetual term requires explicit perpetual evidence (permissionEvidence must be non-empty)`);
    }
  }
  if (rights.redistributionAllowed !== true) {
    reasons.push(`${label}: redistributionAllowed must be true (got ${String(rights.redistributionAllowed)})`);
  }
  if (rights.commercialUseAllowed !== true) {
    reasons.push(`${label}: commercialUseAllowed must be explicitly true for production (got ${String(rights.commercialUseAllowed)})`);
  }
  if (!hasRightsEvidence(rights)) {
    reasons.push(`${label}: rights evidence missing (permissionEvidence/licenseName/licenseUrl must have at least one)`);
  }
  return reasons;
}

/**
 * V14.1：判断 paper 是否含听力小节（long_conversation / passage / lecture），
 * 用于决定是否需要独立校验 listeningScriptRights。
 */
function hasListeningSections(paper: CET6Paper): boolean {
  if (!Array.isArray(paper.sections)) return false;
  return paper.sections.some((sec) =>
    Array.isArray(sec?.groups) &&
    sec.groups.some((g) => g?.type === "long_conversation" || g?.type === "passage" || g?.type === "lecture"),
  );
}

/**
 * V14.1：判断 paper 是否含音频 asset（type==="audio"），
 * 用于决定是否需要独立校验 audioRecordingRights。
 */
function hasAudioAssets(paper: CET6Paper): boolean {
  return Array.isArray(paper.assets) && paper.assets.some((a) => a?.type === "audio");
}

/**
 * V14：REAL Paper production 准入检查（REAL Production Guard）。
 *
 * V14.1 更新：
 *   - 授权期限模型（termType fixed|perpetual），缺 termType → fail closed
 *   - 三类 rights 独立校验：paperTextRights / listeningScriptRights / audioRecordingRights
 *     （对应内容存在时，各自必须满足 production 准入；缺省继承 paper.rights）
 *   - permissionBasis 限制：implied_by_terms 不足，必须为明确授权依据
 *
 * 仅当全部满足时 eligible=true：
 *   - authenticity === "past_exam"
 *   - stableIdNamespace(paperId) === "real"
 *   - paperTextRights（或继承 paper.rights）通过 checkRightsProductionReady
 *   - 若有听力小节：listeningScriptRights（或继承）通过 checkRightsProductionReady
 *   - 若有音频 asset：audioRecordingRights（或继承）通过 checkRightsProductionReady
 *   - 内容结构校验 PASS（由调用方把 validatePaper 的 structuralErrors 传入）
 *
 * 返回所有不满足原因（reasons 为空 = eligible）。
 */
export function realProductionEligible(
  paper: CET6Paper,
  structuralErrors?: string[],
): { eligible: boolean; reasons: string[] } {
  const reasons: string[] = [];

  if (paper?.authenticity !== "past_exam") {
    reasons.push(`authenticity must be "past_exam" for REAL production (got ${String(paper?.authenticity)})`);
  }
  if (stableIdNamespace(paper?.paperId ?? "") !== "real") {
    reasons.push(`paperId must use REAL namespace (cet6:<year>-<session>:set<N>), got ${String(paper?.paperId)}`);
  }

  // V14.1：三类 rights 独立校验。仅对 past_exam REAL paper 执行（MOCK/original 不触发）。
  if (paper?.authenticity === "past_exam") {
    // text 始终存在（paper 必有文本内容）
    const textRights = paper.paperTextRights ?? paper.rights;
    for (const r of checkRightsProductionReady(textRights, "paperTextRights")) reasons.push(r);

    if (hasListeningSections(paper)) {
      const scriptRights = paper.listeningScriptRights ?? paper.rights;
      for (const r of checkRightsProductionReady(scriptRights, "listeningScriptRights")) reasons.push(r);
    }

    if (hasAudioAssets(paper)) {
      const audioRights = paper.audioRecordingRights ?? paper.rights;
      for (const r of checkRightsProductionReady(audioRights, "audioRecordingRights")) reasons.push(r);
    }
  }

  if (Array.isArray(structuralErrors) && structuralErrors.length > 0) {
    for (const e of structuralErrors) reasons.push(`content validation failed: ${e}`);
  }
  return { eligible: reasons.length === 0, reasons };
}
