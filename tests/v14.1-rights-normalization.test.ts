/**
 * V14 Phase 0.1：Rights Contract Normalization 测试（v14.1.2.txt）。
 *
 * 覆盖：
 *  - canonical source taxonomy（5 类，D=PRIVATE_USER_IMPORT，E=UNVERIFIED_WEB）
 *  - termType fail-closed（missing → reject；fixed 需 expiresAt；perpetual 需明确证据）
 *  - 三类 rights 独立校验（paperTextRights / listeningScriptRights / audioRecordingRights）
 *  - permissionBasis 限制（implied_by_terms 不足；非 canonical basis 拒绝）
 *  - MOCK / PRIVATE 行为不回归
 *
 * 使用 node:test + assert。
 */
import test from "node:test";
import assert from "node:assert/strict";
import type { CET6Paper } from "../src/content/papers";
import type { ContentRights } from "../src/content/types";
import {
  checkRightsProductionReady,
  realProductionEligible,
} from "../src/content/rights";
import { extendStableId, paperStableId, stableIdNamespace } from "../src/content/stable-id";
import {
  V14_FIXTURE_REAL_CLEARED,
  V14_FIXTURE_MOCK_UNCHANGED,
  V14_FIXTURE_PRIVATE_OWNER_A,
} from "../src/content/fixture/v14-rights-fixtures";
import { assertPrivateAccess, PRIVATE_NEVER_IN_GLOBAL_SELECTOR } from "../src/content/private-content";

// ============================================================================
// 辅助：构造一个 production-ready 的 rights 对象（各测试在此基础上改坏）
// ============================================================================
const readyRights = (over: Partial<ContentRights> = {}): ContentRights => ({
  licenseStatus: "licensed",
  rightsHolder: "Synthetic",
  rightsStatus: "cleared",
  permissionBasis: "signed_contract",
  termType: "fixed",
  licenseName: "Lic",
  permissionEvidence: "contract-ref:TEST",
  commercialUseAllowed: true,
  redistributionAllowed: true,
  effectiveAt: "2026-01-01T00:00:00.000Z",
  expiresAt: "2099-12-31T23:59:59.000Z",
  ...over,
});

const REAL_ID = paperStableId({ exam: "CET6", year: 2024, session: 12, set: 1 });

/** 构造一个含听力小节 + 音频 asset 的 minimal past_exam paper。 */
function paperWithListeningAndAudio(over: Partial<CET6Paper> = {}): CET6Paper {
  const base = V14_FIXTURE_REAL_CLEARED;
  const listeningSection = {
    sectionId: extendStableId(REAL_ID, "listening"),
    type: "listening" as const,
    order: 2,
    groups: [
      {
        groupId: extendStableId(extendStableId(REAL_ID, "listening"), "lecture-g1"),
        type: "lecture" as const,
        order: 1,
        transcript: "Synthetic placeholder transcript (no real exam content).",
        questions: [
          {
            questionId: extendStableId(extendStableId(extendStableId(REAL_ID, "listening"), "lecture-g1"), "q1"),
            order: 1,
            prompt: "Synthetic question?",
            type: "choice" as const,
            options: [{ id: "a", text: "A" }, { id: "b", text: "B" }, { id: "c", text: "C" }, { id: "d", text: "D" }],
            answerIndex: 0,
          },
        ],
      },
    ],
  };
  return {
    ...base,
    paperId: REAL_ID,
    sections: [...base.sections, listeningSection],
    assets: [
      {
        assetId: extendStableId(REAL_ID, "listening", "lecture", "g1", "audio1"),
        type: "audio",
        source: "mock://synthetic/audio1.mp3",
        mimeType: "audio/mpeg",
        rights: { licenseStatus: "owned" },
      },
    ],
    ...over,
  };
}

// ============================================================================
// 1. Canonical Source Taxonomy
// ============================================================================
test("1. canonical source taxonomy: 5 classes, D=PRIVATE_USER_IMPORT, E=UNVERIFIED_WEB", () => {
  // 验证 canonical source class 常量语义（通过 PRIVATE 隔离契约和 SOURCE_E 默认拒绝行为间接验证）
  assert.equal(PRIVATE_NEVER_IN_GLOBAL_SELECTOR, true);
  // D = PRIVATE_USER_IMPORT：private id 进 private namespace
  const privateId = V14_FIXTURE_PRIVATE_OWNER_A.paperId;
  assert.equal(stableIdNamespace(privateId), "private");
  // E = UNVERIFIED_WEB：默认 REJECT_PUBLICATION（通过 rightsVerdict unknown 验证）
  const unverified: ContentRights = { licenseStatus: "unknown" };
  assert.notEqual(checkRightsProductionReady(unverified, "test").length, 0);
});

// ============================================================================
// 2. Term Model: missing termType → fail closed
// ============================================================================
test("2. cleared + no termType => reject (missing term is NOT inferred as perpetual)", () => {
  const noTerm = readyRights({ termType: undefined });
  const reasons = checkRightsProductionReady(noTerm, "test");
  assert.ok(reasons.some((r) => r.includes("termType missing")), `应报 termType missing: ${reasons.join("; ")}`);
});

// ============================================================================
// 3. fixed term requires expiresAt
// ============================================================================
test("3. fixed + no expiresAt => reject", () => {
  const noExp = readyRights({ expiresAt: undefined });
  const reasons = checkRightsProductionReady(noExp, "test");
  assert.ok(reasons.some((r) => r.includes("fixed term requires expiresAt")), `应报 fixed requires expiresAt: ${reasons.join("; ")}`);
});

test("3b. fixed + expired => reject", () => {
  const expired = readyRights({ expiresAt: "2020-01-01T00:00:00.000Z" });
  const reasons = checkRightsProductionReady(expired, "test");
  assert.ok(reasons.some((r) => r.includes("expired")), `应报 expired: ${reasons.join("; ")}`);
});

// ============================================================================
// 4. perpetual term requires explicit evidence
// ============================================================================
test("4. perpetual + no explicit evidence => reject", () => {
  const perpetualNoEv = readyRights({
    termType: "perpetual",
    expiresAt: undefined,
    permissionEvidence: undefined,
    licenseName: undefined,
    licenseUrl: undefined,
  });
  const reasons = checkRightsProductionReady(perpetualNoEv, "test");
  assert.ok(reasons.some((r) => r.includes("perpetual term requires explicit perpetual evidence")), `应报 perpetual requires evidence: ${reasons.join("; ")}`);
});

test("4b. perpetual + explicit evidence => allowed", () => {
  const perpetualOk = readyRights({
    termType: "perpetual",
    expiresAt: undefined,
    permissionEvidence: "perpetual-license-ref:TEST-PERPETUAL",
  });
  const reasons = checkRightsProductionReady(perpetualOk, "test");
  assert.equal(reasons.length, 0, `perpetual+evidence 应通过，实际: ${reasons.join("; ")}`);
});

// ============================================================================
// 5. paperTextRights independent
// ============================================================================
test("5. text cleared + paperTextRights explicitly unverified => reject", () => {
  const paper: CET6Paper = {
    ...V14_FIXTURE_REAL_CLEARED,
    paperTextRights: { ...readyRights(), rightsStatus: "unverified" },
  };
  const r = realProductionEligible(paper);
  assert.equal(r.eligible, false);
  assert.ok(r.reasons.some((x) => x.includes("paperTextRights") && x.includes("rightsStatus")), `应报 paperTextRights rightsStatus: ${r.reasons.join("; ")}`);
});

test("5b. paperTextRights absent inherits paper.rights (cleared) => allowed for text-only paper", () => {
  // V14_FIXTURE_REAL_CLEARED 只有 writing section，无 listening/audio
  const r = realProductionEligible(V14_FIXTURE_REAL_CLEARED);
  assert.equal(r.eligible, true, `text-only cleared paper 应通过，实际: ${r.reasons.join("; ")}`);
});

// ============================================================================
// 6. listeningScriptRights independent
// ============================================================================
test("6. text/script cleared + listeningScriptRights explicitly unverified => reject", () => {
  const paper = paperWithListeningAndAudio({
    listeningScriptRights: { ...readyRights(), rightsStatus: "unverified" },
  });
  const r = realProductionEligible(paper);
  assert.equal(r.eligible, false);
  assert.ok(r.reasons.some((x) => x.includes("listeningScriptRights")), `应报 listeningScriptRights: ${r.reasons.join("; ")}`);
});

// ============================================================================
// 7. audioRecordingRights independent
// ============================================================================
test("7. text/script cleared + audioRecordingRights unverified => reject", () => {
  const paper = paperWithListeningAndAudio({
    audioRecordingRights: { ...readyRights(), rightsStatus: "unverified" },
  });
  const r = realProductionEligible(paper);
  assert.equal(r.eligible, false);
  assert.ok(r.reasons.some((x) => x.includes("audioRecordingRights")), `应报 audioRecordingRights: ${r.reasons.join("; ")}`);
});

test("7b. audio licensed but redistribution=false => reject", () => {
  const paper = paperWithListeningAndAudio({
    audioRecordingRights: { ...readyRights(), redistributionAllowed: false },
  });
  const r = realProductionEligible(paper);
  assert.equal(r.eligible, false);
  assert.ok(r.reasons.some((x) => x.includes("audioRecordingRights") && x.includes("redistributionAllowed")), `应报 audio redistribution: ${r.reasons.join("; ")}`);
});

test("7c. audio cleared but evidence missing => reject", () => {
  const paper = paperWithListeningAndAudio({
    audioRecordingRights: {
      ...readyRights(),
      permissionEvidence: undefined,
      licenseName: undefined,
      licenseUrl: undefined,
    },
  });
  const r = realProductionEligible(paper);
  assert.equal(r.eligible, false);
  assert.ok(r.reasons.some((x) => x.includes("audioRecordingRights") && x.includes("evidence missing")), `应报 audio evidence: ${r.reasons.join("; ")}`);
});

test("7d. all 3 rights cleared => eligible", () => {
  const allCleared = readyRights();
  const paper = paperWithListeningAndAudio({
    paperTextRights: { ...allCleared },
    listeningScriptRights: { ...allCleared },
    audioRecordingRights: { ...allCleared },
  });
  const r = realProductionEligible(paper);
  assert.equal(r.eligible, true, `all 3 cleared 应通过，实际: ${r.reasons.join("; ")}`);
});

// ============================================================================
// 8. permissionBasis restriction
// ============================================================================
test("8. rightsStatus=cleared + permissionBasis=implied_by_terms => production reject", () => {
  const implied = readyRights({ permissionBasis: "implied_by_terms" });
  const reasons = checkRightsProductionReady(implied, "test");
  assert.ok(reasons.some((r) => r.includes("implied_by_terms")), `应报 implied_by_terms not sufficient: ${reasons.join("; ")}`);
});

test("8b. non-canonical permissionBasis => reject", () => {
  const weird = readyRights({ permissionBasis: "some_random_basis" });
  const reasons = checkRightsProductionReady(weird, "test");
  assert.ok(reasons.some((r) => r.includes("not a canonical basis")), `应报 non-canonical: ${reasons.join("; ")}`);
});

test("8c. missing permissionBasis => reject", () => {
  const noBasis = readyRights({ permissionBasis: undefined });
  const reasons = checkRightsProductionReady(noBasis, "test");
  assert.ok(reasons.some((r) => r.includes("permissionBasis missing")), `应报 permissionBasis missing: ${reasons.join("; ")}`);
});

test("8d. canonical basis signed_contract => allowed", () => {
  const ok = readyRights({ permissionBasis: "signed_contract" });
  const reasons = checkRightsProductionReady(ok, "test");
  assert.equal(reasons.length, 0, `signed_contract 应通过: ${reasons.join("; ")}`);
});

test("8e. canonical basis written_permission => allowed", () => {
  const ok = readyRights({ permissionBasis: "written_permission" });
  const reasons = checkRightsProductionReady(ok, "test");
  assert.equal(reasons.length, 0, `written_permission 应通过: ${reasons.join("; ")}`);
});

test("8f. canonical basis explicit_license => allowed", () => {
  const ok = readyRights({ permissionBasis: "explicit_license" });
  const reasons = checkRightsProductionReady(ok, "test");
  assert.equal(reasons.length, 0, `explicit_license 应通过: ${reasons.join("; ")}`);
});

// ============================================================================
// 9. MOCK unchanged
// ============================================================================
test("9. MOCK behavior unchanged: original mock paper does not trigger REAL guard", () => {
  // MOCK paper authenticity=original → realProductionEligible 报 authenticity 错误（不触发 rights 检查）
  const r = realProductionEligible(V14_FIXTURE_MOCK_UNCHANGED);
  assert.equal(r.eligible, false);
  assert.ok(r.reasons.some((x) => x.includes("authenticity must be")), `MOCK 应只报 authenticity: ${r.reasons.join("; ")}`);
  // MOCK paper 不应出现 rights 相关错误（因为 REAL guard 不适用）
  assert.ok(!r.reasons.some((x) => x.includes("paperTextRights")), `MOCK 不应触发 paperTextRights 检查`);
});

// ============================================================================
// 10. PRIVATE unchanged
// ============================================================================
test("10. PRIVATE owner isolation unchanged: A accessible, B rejected", () => {
  assert.equal(assertPrivateAccess(V14_FIXTURE_PRIVATE_OWNER_A, "user-a"), true);
  assert.equal(assertPrivateAccess(V14_FIXTURE_PRIVATE_OWNER_A, "user-b"), false);
  assert.equal(PRIVATE_NEVER_IN_GLOBAL_SELECTOR, true);
  assert.equal(V14_FIXTURE_PRIVATE_OWNER_A.visibility, "private");
  assert.equal(V14_FIXTURE_PRIVATE_OWNER_A.productionEligible, false);
});

// ============================================================================
// 11. checkRightsProductionReady: missing rights object → reject
// ============================================================================
test("11. missing rights object => reject", () => {
  assert.ok(checkRightsProductionReady(undefined, "test").length > 0);
  assert.ok(checkRightsProductionReady(null, "test").length > 0);
});

// ============================================================================
// 12. realProductionEligible: past_exam but wrong namespace → reject
// ============================================================================
test("12. past_exam with mock namespace => reject", () => {
  const bad: CET6Paper = {
    ...V14_FIXTURE_REAL_CLEARED,
    paperId: "cet6:mock:wrong",
    year: 2026,
    session: 6,
    set: 1,
  };
  const r = realProductionEligible(bad);
  assert.equal(r.eligible, false);
  assert.ok(r.reasons.some((x) => x.includes("REAL namespace")));
});
