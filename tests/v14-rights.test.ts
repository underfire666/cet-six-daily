/**
 * V14 Phase 0：REAL 内容来源 & 权利策略测试（v14.1.1.txt §22）。
 * 覆盖：
 *  - REAL namespace 校验（past_exam 必须 REAL namespace）
 *  - REAL production 必须 rightsStatus=cleared
 *  - 权利证据缺失 / redistribution=false / 过期 / 吊销 → fail closed
 *  - unknown/unverified fail closed
 *  - MOCK(Paper 001) / FIXTURE(synthetic) 行为不回归
 *  - PRIVATE 永不进 global selector + owner 隔离契约
 *  - audio rights 独立于 text rights
 *  - rights 状态机各状态判断
 *  - realProductionEligible 返回全部不满足原因
 *  - 7 个 fixture 各自预期行为
 *
 * 使用 node:test + assert（与 V13 测试一致）。
 */
import test from "node:test";
import assert from "node:assert/strict";
import type { CET6Paper } from "../src/content/papers";
import { validatePaper } from "../src/content/papers";
import { isRightsCleared, realProductionEligible, rightsIssues, rightsVerdict } from "../src/content/rights";
import { stableIdNamespace, extendStableId } from "../src/content/stable-id";
import {
  assertPrivateAccess,
  privatePaperStableId,
  isPrivateStableId,
  PRIVATE_NEVER_IN_GLOBAL_SELECTOR,
} from "../src/content/private-content";
import type { ContentRights } from "../src/content/types";
import {
  V14_FIXTURE_REAL_CLEARED,
  V14_FIXTURE_REAL_UNVERIFIED,
  V14_FIXTURE_REAL_NO_REDISTRIBUTION,
  V14_FIXTURE_REAL_MISSING_EVIDENCE,
  V14_FIXTURE_PRIVATE_OWNER_A,
  V14_FIXTURE_MOCK_UNCHANGED,
} from "../src/content/fixture/v14-rights-fixtures";
import { resetRegistry, getPublishableItems, getPaperById } from "../src/content/registry";
import { registerBuiltinPacks } from "../src/content/packs";
import { registerMockPaper001, MOCK_PAPER_001_ID } from "../src/content/papers/cet6-mock-paper-001";
import {
  registerSyntheticPaperFixture,
  SYNTHETIC_PAPER_ID,
} from "../src/content/fixture/cet6-2025-12-synthetic";

const clearedRights = (over: Partial<ContentRights> = {}): ContentRights => ({
  licenseStatus: "licensed",
  rightsHolder: "Synthetic",
  rightsStatus: "cleared",
  licenseName: "Lic",
  permissionEvidence: "ev",
  commercialUseAllowed: true,
  redistributionAllowed: true,
  effectiveAt: "2026-01-01T00:00:00.000Z",
  ...over,
});

test("1. REAL namespace validation: past_exam 必须用 REAL namespace", () => {
  assert.equal(stableIdNamespace(V14_FIXTURE_REAL_CLEARED.paperId), "real");
  // past_exam 却用 mock namespace → validatePaper 必须报错
  const bad: CET6Paper = {
    ...V14_FIXTURE_REAL_CLEARED,
    paperId: "cet6:mock:wrong-namespace",
    year: 2026,
    session: 6,
    set: 1,
    sections: V14_FIXTURE_REAL_CLEARED.sections.map((s) => ({ ...s, sectionId: extendStableId("cet6:mock:wrong-namespace", "writing") })),
  };
  const errors = validatePaper(bad);
  assert.ok(errors.some((e) => e.includes("past_exam") && e.includes("REAL namespace")), `应报 past_exam/REAL namespace: ${errors.join("; ")}`);
});

test("2. REAL production requires rights cleared（rightsStatus != cleared → reject）", () => {
  const r = realProductionEligible(V14_FIXTURE_REAL_UNVERIFIED);
  assert.equal(r.eligible, false);
  assert.ok(r.reasons.some((x) => x.includes("rightsStatus")));
});

test("3. rights evidence missing -> fail", () => {
  const r = realProductionEligible(V14_FIXTURE_REAL_MISSING_EVIDENCE);
  assert.equal(r.eligible, false);
  assert.ok(r.reasons.some((x) => x.toLowerCase().includes("evidence")), `应有 evidence reason: ${r.reasons.join("; ")}`);
  const errors = validatePaper(V14_FIXTURE_REAL_MISSING_EVIDENCE);
  assert.ok(errors.some((e) => e.includes("evidence")));
});

test("4. redistribution false -> fail", () => {
  const r = realProductionEligible(V14_FIXTURE_REAL_NO_REDISTRIBUTION);
  assert.equal(r.eligible, false);
  assert.ok(r.reasons.some((x) => x.toLowerCase().includes("redistribution")));
});

test("5. expired / revoked -> fail", () => {
  const expired = clearedRights({ expiresAt: "2020-01-01T00:00:00.000Z" });
  assert.equal(isRightsCleared(expired), false);
  const revoked = clearedRights({ rightsStatus: "revoked" });
  assert.equal(isRightsCleared(revoked), false);
  // 过期 paper 在 validatePaper 中必须报错
  const expiredPaper: CET6Paper = {
    ...V14_FIXTURE_REAL_CLEARED,
    rights: expired,
  };
  const errors = validatePaper(expiredPaper);
  assert.ok(errors.some((e) => e.includes("expired") || e.includes("expiresAt")), `应报 expired: ${errors.join("; ")}`);
});

test("6. unknown / unverified / researching fail closed", () => {
  assert.equal(isRightsCleared(undefined), false);
  assert.equal(isRightsCleared(null), false);
  assert.equal(isRightsCleared({ licenseStatus: "owned" }), false); // 缺 rightsStatus
  for (const s of ["unknown", "researching", "unverified", "restricted", "expired", "revoked"] as const) {
    assert.equal(isRightsCleared(clearedRights({ rightsStatus: s })), false, `${s} 不应 cleared`);
  }
  // rightsIssues production 范围：rightsStatus 存在但非 cleared → error
  const issues = rightsIssues(clearedRights({ rightsStatus: "unverified" }), { scope: "production" });
  assert.ok(issues.some((i) => i.level === "error" && i.message.includes("rightsStatus")));
});

test("7. MOCK behavior unchanged: Paper 001 仍然 publishable", () => {
  resetRegistry();
  registerBuiltinPacks();
  registerMockPaper001();
  const pool = getPublishableItems<{ paperId?: string }>("paper");
  const ids = pool.map((p) => p.paperId);
  assert.ok(ids.includes(MOCK_PAPER_001_ID), `production pool 必须仍含 Paper 001: ${ids.join(",")}`);
  // owned rights verdict 仍 allowed
  assert.equal(rightsVerdict(V14_FIXTURE_MOCK_UNCHANGED.rights), "allowed");
});

test("8. FIXTURE behavior unchanged: 现有 synthetic fixture 仍然 staging（不进 pool）", () => {
  resetRegistry();
  registerBuiltinPacks();
  registerMockPaper001();
  registerSyntheticPaperFixture();
  const f = getPaperById<{ paperId?: string; status?: string; fixture?: boolean }>(SYNTHETIC_PAPER_ID);
  assert.ok(f, "synthetic fixture 可 resolve");
  assert.equal(f!.status, "staging");
  assert.equal(f!.fixture, true);
  const pool = getPublishableItems<{ paperId?: string; fixture?: boolean }>("paper");
  assert.ok(!pool.some((p) => p.fixture === true), "fixture 不得进 production pool");
});

test("9. PRIVATE never in global production selector", () => {
  assert.equal(PRIVATE_NEVER_IN_GLOBAL_SELECTOR, true);
  const id = privatePaperStableId("user-a", "imported-paper-001");
  assert.ok(isPrivateStableId(id));
  assert.equal(stableIdNamespace(id), "private");
  // private id 不得被识别为 real/mock/fixture
  assert.notEqual(stableIdNamespace(id), "real");
  assert.notEqual(stableIdNamespace(id), "mock");
  assert.notEqual(stableIdNamespace(id), "fixture");
});

test("10. PRIVATE owner isolation contract: A accessible, B rejected", () => {
  assert.equal(assertPrivateAccess(V14_FIXTURE_PRIVATE_OWNER_A, "user-a"), true);
  assert.equal(assertPrivateAccess(V14_FIXTURE_PRIVATE_OWNER_A, "user-b"), false);
  assert.equal(assertPrivateAccess(V14_FIXTURE_PRIVATE_OWNER_A, ""), false);
  // meta 自身字段契约
  assert.equal(V14_FIXTURE_PRIVATE_OWNER_A.visibility, "private");
  assert.equal(V14_FIXTURE_PRIVATE_OWNER_A.productionEligible, false);
  assert.equal(V14_FIXTURE_PRIVATE_OWNER_A.globalSelectorEligible, false);
  assert.equal(V14_FIXTURE_PRIVATE_OWNER_A.redistributable, false);
  assert.equal(V14_FIXTURE_PRIVATE_OWNER_A.shareEligible, false);
});

test("11. audio rights independent from text rights（text cleared 但 audio 缺 audioRecordingRights → fail）", () => {
  const withAudio: CET6Paper = {
    ...V14_FIXTURE_REAL_CLEARED,
    audioRecordingRights: undefined, // 显式缺失
    assets: [
      {
        assetId: extendStableId(V14_FIXTURE_REAL_CLEARED.paperId, "listening", "lecture", "g1", "audio1"),
        type: "audio",
        source: "mock://synthetic/audio1.mp3",
        mimeType: "audio/mpeg",
        rights: { licenseStatus: "owned" },
      },
    ],
  };
  const errors = validatePaper(withAudio);
  assert.ok(
    errors.some((e) => e.includes("audioRecordingRights")),
    `past_exam + audio asset 缺 audioRecordingRights 应报错: ${errors.join("; ")}`,
  );
});

test("12. rightsStatus state machine transitions（cleared→expired→revoked 各状态判断）", () => {
  assert.equal(isRightsCleared(clearedRights({})), true); // cleared, 无 expiresAt = 永久
  assert.equal(isRightsCleared(clearedRights({ expiresAt: "2099-01-01T00:00:00.000Z" })), true); // 未来
  assert.equal(isRightsCleared(clearedRights({ expiresAt: "2020-01-01T00:00:00.000Z" })), false); // expired
  assert.equal(isRightsCleared(clearedRights({ rightsStatus: "expired" })), false);
  assert.equal(isRightsCleared(clearedRights({ rightsStatus: "revoked" })), false);
});

test("13. realProductionEligible 返回所有不满足原因", () => {
  const ok = realProductionEligible(V14_FIXTURE_REAL_CLEARED);
  assert.equal(ok.eligible, true);
  assert.equal(ok.reasons.length, 0);
  // 同时改坏多个维度 → reasons 应收集多条
  const broken: CET6Paper = {
    ...V14_FIXTURE_REAL_CLEARED,
    authenticity: "past_exam",
    rights: clearedRights({ rightsStatus: "unverified", redistributionAllowed: false, commercialUseAllowed: false, licenseName: undefined, licenseUrl: undefined, permissionEvidence: undefined }),
  };
  const r = realProductionEligible(broken);
  assert.equal(r.eligible, false);
  assert.ok(r.reasons.length >= 4, `应收集多条原因，实际: ${r.reasons.join(" | ")}`);
});

test("14. 7 个 fixtures 各自预期行为", () => {
  // A: cleared → production allowed（结构 0 error + 准入通过）
  const aErrors = validatePaper(V14_FIXTURE_REAL_CLEARED);
  assert.equal(aErrors.length, 0, `A 应结构合法: ${aErrors.join("; ")}`);
  assert.equal(realProductionEligible(V14_FIXTURE_REAL_CLEARED).eligible, true);
  // B/C/D: rejected
  assert.equal(realProductionEligible(V14_FIXTURE_REAL_UNVERIFIED).eligible, false);
  assert.equal(realProductionEligible(V14_FIXTURE_REAL_NO_REDISTRIBUTION).eligible, false);
  assert.equal(realProductionEligible(V14_FIXTURE_REAL_MISSING_EVIDENCE).eligible, false);
  // E/F: private isolation
  assert.equal(assertPrivateAccess(V14_FIXTURE_PRIVATE_OWNER_A, "user-a"), true);
  assert.equal(assertPrivateAccess(V14_FIXTURE_PRIVATE_OWNER_A, "user-b"), false);
  // G: mock unchanged → 结构合法，不触发 REAL guard
  const gErrors = validatePaper(V14_FIXTURE_MOCK_UNCHANGED);
  assert.equal(gErrors.length, 0, `G mock 应保持合法: ${gErrors.join("; ")}`);
});
