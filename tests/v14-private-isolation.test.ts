/**
 * V14 Phase 1A：PRIVATE Content Isolation 测试。
 *
 * 覆盖：
 *  - validatePrivatePaper() 校验（合法 / 各维度不合法）
 *  - isPrivateContent() 检测
 *  - owner 访问隔离（assertPrivateAccess）
 *  - PRIVATE 永不进入 production selector（getPublishableItems）
 *  - privatePaperStableId 格式与 collision safety
 *  - isValidOwnerScopedId 格式校验
 *  - rights acknowledgement 要求
 *
 * 使用 node:test + assert。
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  assertPrivateAccess,
  isPrivateContent,
  isValidOwnerScopedId,
  privatePaperStableId,
  validatePrivatePaper,
  SOURCE_D_PRIVATE_USER_IMPORT,
  PRIVATE_NEVER_IN_GLOBAL_SELECTOR,
  type PrivateContentMeta,
} from "../src/content/private-content";
import { stableIdNamespace } from "../src/content/stable-id";
import {
  registerContentPack,
  getPublishableItems,
  resetRegistry,
} from "../src/content/registry";
import type { CET6Paper } from "../src/content/papers";
import type { ContentRights } from "../src/content/types";

// ============================================================================
// 辅助：构造一个合法的 PRIVATE paper
// ============================================================================
function makeValidPrivatePaper(over: Partial<CET6Paper> = {}): CET6Paper {
  const ownerScopedId = "user-hash-a1b2c3";
  const paperLocalId = "imported-001";
  const pid = privatePaperStableId(ownerScopedId, paperLocalId);
  return {
    paperId: pid,
    type: "paper",
    title: "My Imported Paper",
    difficulty: "medium",
    sourceId: "src-cet6-mock-paper-001",
    tags: [],
    version: "1.0.0",
    status: "active",
    createdAt: "2026-09-30T00:00:00.000Z",
    updatedAt: "2026-09-30T00:00:00.000Z",
    authenticity: "user_import",
    visibility: "private",
    ownerId: "user-a-internal-id",
    schemaVersion: "1.0.0",
    contentVersion: "1.0.0",
    examSpecId: "cet6-spec-v1",
    exam: "CET6",
    level: "CET6",
    year: 0,
    session: 0,
    set: 0,
    sourceNote: "User imported from personal notes",
    sections: [],
    rights: { licenseStatus: "owned", redistributionAllowed: false },
    rightsAcknowledgement: {
      acknowledged: true,
      acknowledgedAt: "2026-09-30T00:00:00.000Z",
      statementVersion: "1.0",
    },
    ...over,
  } as unknown as CET6Paper;
}

// ============================================================================
// 1. validatePrivatePaper — 合法 paper 通过
// ============================================================================
test("1. validatePrivatePaper: valid private paper passes", () => {
  const paper = makeValidPrivatePaper();
  const errors = validatePrivatePaper(paper);
  assert.equal(errors.length, 0, `valid paper should pass, got: ${errors.join("; ")}`);
});

// ============================================================================
// 2. validatePrivatePaper — visibility 不是 private
// ============================================================================
test("2. validatePrivatePaper: visibility != private → reject", () => {
  const paper = makeValidPrivatePaper({ visibility: "public" });
  const errors = validatePrivatePaper(paper);
  assert.ok(errors.some((e) => e.includes("visibility must be")), `应报 visibility: ${errors.join("; ")}`);
});

// ============================================================================
// 3. validatePrivatePaper — authenticity 不合法
// ============================================================================
test("3. validatePrivatePaper: authenticity=original → reject", () => {
  const paper = makeValidPrivatePaper({ authenticity: "original" });
  const errors = validatePrivatePaper(paper);
  assert.ok(errors.some((e) => e.includes("authenticity must be")), `应报 authenticity: ${errors.join("; ")}`);
});

test("3b. validatePrivatePaper: authenticity=user_import → allowed", () => {
  const paper = makeValidPrivatePaper({ authenticity: "user_import" });
  const errors = validatePrivatePaper(paper);
  assert.ok(!errors.some((e) => e.includes("authenticity")), `user_import 应通过 authenticity 检查: ${errors.join("; ")}`);
});

// ============================================================================
// 4. validatePrivatePaper — ownerId 缺失
// ============================================================================
test("4. validatePrivatePaper: ownerId missing → reject", () => {
  const paper = makeValidPrivatePaper({ ownerId: undefined });
  const errors = validatePrivatePaper(paper);
  assert.ok(errors.some((e) => e.includes("ownerId required")), `应报 ownerId: ${errors.join("; ")}`);
});

// ============================================================================
// 5. validatePrivatePaper — paperId 不是 private namespace
// ============================================================================
test("5. validatePrivatePaper: paperId not private namespace → reject", () => {
  const paper = makeValidPrivatePaper({ paperId: "cet6:mock:paper-001" });
  const errors = validatePrivatePaper(paper);
  assert.ok(errors.some((e) => e.includes("paperId must use private namespace")), `应报 paperId namespace: ${errors.join("; ")}`);
});

// ============================================================================
// 6. validatePrivatePaper — productionEligible=true
// ============================================================================
test("6. validatePrivatePaper: productionEligible=true → reject", () => {
  const paper = makeValidPrivatePaper({ productionEligible: true } as unknown as Partial<CET6Paper>);
  const errors = validatePrivatePaper(paper);
  assert.ok(errors.some((e) => e.includes("productionEligible must be false")), `应报 productionEligible: ${errors.join("; ")}`);
});

// ============================================================================
// 7. validatePrivatePaper — redistributionAllowed=true
// ============================================================================
test("7. validatePrivatePaper: redistributionAllowed=true → reject", () => {
  const paper = makeValidPrivatePaper({
    rights: { licenseStatus: "licensed", redistributionAllowed: true } as ContentRights,
  });
  const errors = validatePrivatePaper(paper);
  assert.ok(errors.some((e) => e.includes("redistributionAllowed must be false")), `应报 redistribution: ${errors.join("; ")}`);
});

// ============================================================================
// 8. validatePrivatePaper — rights acknowledgement 缺失
// ============================================================================
test("8. validatePrivatePaper: rightsAcknowledgement missing → reject", () => {
  const paper = makeValidPrivatePaper({ rightsAcknowledgement: undefined } as unknown as Partial<CET6Paper>);
  const errors = validatePrivatePaper(paper);
  assert.ok(errors.some((e) => e.includes("rightsAcknowledgement.acknowledged must be true")), `应报 acknowledgement: ${errors.join("; ")}`);
});

test("8b. validatePrivatePaper: acknowledgement not acknowledged → reject", () => {
  const paper = makeValidPrivatePaper({
    rightsAcknowledgement: { acknowledged: false, acknowledgedAt: "", statementVersion: "1.0" },
  } as unknown as Partial<CET6Paper>);
  const errors = validatePrivatePaper(paper);
  assert.ok(errors.some((e) => e.includes("acknowledged must be true")), `应报 acknowledged=false: ${errors.join("; ")}`);
});

// ============================================================================
// 9. isPrivateContent 检测
// ============================================================================
test("9. isPrivateContent: visibility=private → true", () => {
  assert.equal(isPrivateContent({ visibility: "private" }), true);
});

test("9b. isPrivateContent: private namespace id → true", () => {
  assert.equal(isPrivateContent({ id: "private:user-a:paper-001" }), true);
  assert.equal(isPrivateContent({ paperId: "private:user-a:paper-001" }), true);
});

test("9c. isPrivateContent: public content → false", () => {
  assert.equal(isPrivateContent({ visibility: "public", id: "cet6:mock:paper-001" }), false);
  assert.equal(isPrivateContent({ id: "cet6:2024-6:set1" }), false);
  assert.equal(isPrivateContent({}), false);
});

// ============================================================================
// 10. owner 访问隔离（assertPrivateAccess）
// ============================================================================
test("10. assertPrivateAccess: owner can access own paper", () => {
  const meta: PrivateContentMeta = {
    ownerId: "user-a",
    ownerNamespace: "user:hash-a",
    visibility: "private",
    redistributable: false,
    productionEligible: false,
    globalSelectorEligible: false,
    shareEligible: false,
    paperId: privatePaperStableId("user-a", "p1"),
    importedAt: "2026-09-30T00:00:00.000Z",
    rightsAcknowledgement: { acknowledged: true, acknowledgedAt: "2026-09-30T00:00:00.000Z", statementVersion: "1.0" },
  };
  assert.equal(assertPrivateAccess(meta, "user-a"), true);
});

test("10b. assertPrivateAccess: other user cannot access", () => {
  const meta: PrivateContentMeta = {
    ownerId: "user-a",
    ownerNamespace: "user:hash-a",
    visibility: "private",
    redistributable: false,
    productionEligible: false,
    globalSelectorEligible: false,
    shareEligible: false,
    paperId: privatePaperStableId("user-a", "p1"),
    importedAt: "2026-09-30T00:00:00.000Z",
    rightsAcknowledgement: { acknowledged: true, acknowledgedAt: "2026-09-30T00:00:00.000Z", statementVersion: "1.0" },
  };
  assert.equal(assertPrivateAccess(meta, "user-b"), false);
});

test("10c. assertPrivateAccess: invalid session → reject", () => {
  const meta: PrivateContentMeta = {
    ownerId: "user-a",
    ownerNamespace: "user:hash-a",
    visibility: "private",
    redistributable: false,
    productionEligible: false,
    globalSelectorEligible: false,
    shareEligible: false,
    paperId: privatePaperStableId("user-a", "p1"),
    importedAt: "2026-09-30T00:00:00.000Z",
    rightsAcknowledgement: { acknowledged: true, acknowledgedAt: "2026-09-30T00:00:00.000Z", statementVersion: "1.0" },
  };
  assert.equal(assertPrivateAccess(meta, ""), false);
  assert.equal(assertPrivateAccess(meta, null as unknown as string), false);
});

// ============================================================================
// 11. PRIVATE 永不进入 production selector
// ============================================================================
test("11. PRIVATE paper never appears in getPublishableItems", () => {
  resetRegistry();
  // 构造一个结构完整的 public mock paper
  const pubPaper = {
    paperId: "cet6:mock:test-pub",
    id: "cet6:mock:test-pub",
    type: "paper",
    title: "Public Mock",
    difficulty: "easy" as const,
    sourceId: "src-cet6-mock-paper-001",
    tags: [],
    version: "1.0.0",
    status: "active" as const,
    createdAt: "2026-09-30T00:00:00.000Z",
    updatedAt: "2026-09-30T00:00:00.000Z",
    authenticity: "original" as const,
    exam: "CET6" as const,
    level: "CET6" as const,
    year: 2026,
    session: 6 as const,
    set: 1,
    examSpecId: "cet6-current-2026",
    schemaVersion: "1.0.0",
    contentVersion: "1.0.0",
    rights: { licenseStatus: "owned", rightsHolder: "test", redistributionAllowed: true, commercialUseAllowed: true },
    sections: [
      {
        sectionId: "cet6:mock:test-pub:writing",
        type: "writing" as const,
        order: 1,
        groups: [
          {
            groupId: "cet6:mock:test-pub:writing:g1",
            type: "writing" as const,
            order: 1,
            prompt: "Write an essay.",
            questions: [
              {
                questionId: "cet6:mock:test-pub:writing:g1:q1",
                order: 1,
                prompt: "Write an essay.",
                type: "subjective_writing" as const,
                answerText: "Sample.",
                answerKey: { value: "Sample.", source: "test" },
              },
            ],
          },
        ],
      },
    ],
  };
  // 构造一个结构完整的 private paper（visibility=private，authenticity=original 以通过 validator）
  const privPaper = {
    ...pubPaper,
    paperId: "cet6:mock:test-priv",
    id: "cet6:mock:test-priv",
    title: "Private Paper",
    visibility: "private" as const,
    ownerId: "user-a",
    sections: [
      {
        sectionId: "cet6:mock:test-priv:writing",
        type: "writing" as const,
        order: 1,
        groups: [
          {
            groupId: "cet6:mock:test-priv:writing:g1",
            type: "writing" as const,
            order: 1,
            prompt: "Write an essay.",
            questions: [
              {
                questionId: "cet6:mock:test-priv:writing:g1:q1",
                order: 1,
                prompt: "Write an essay.",
                type: "subjective_writing" as const,
                answerText: "Sample.",
                answerKey: { value: "Sample.", source: "test" },
              },
            ],
          },
        ],
      },
    ],
  };
  registerContentPack({
    id: "test-mixed-pack",
    name: "Mixed Pack",
    version: "1.0.0",
    contentType: "paper",
    sourceId: "src-cet6-mock-paper-001",
    items: [pubPaper, privPaper],
    createdAt: "2026-09-30T00:00:00.000Z",
    updatedAt: "2026-09-30T00:00:00.000Z",
    rights: { licenseStatus: "owned", rightsHolder: "test", redistributionAllowed: true, commercialUseAllowed: true },
  } as never);

  const publishable = getPublishableItems("paper") as { paperId?: string }[];
  assert.ok(publishable.some((p) => p.paperId === "cet6:mock:test-pub"), "public paper should be publishable");
  assert.ok(!publishable.some((p) => p.paperId === "cet6:mock:test-priv"), "PRIVATE paper must NOT be in production selector");
  resetRegistry();
});

// ============================================================================
// 12. privatePaperStableId 格式
// ============================================================================
test("12. privatePaperStableId: correct format and namespace", () => {
  const id = privatePaperStableId("user-hash-abc", "my-paper-001");
  assert.equal(id, "private:user-hash-abc:my-paper-001");
  assert.equal(stableIdNamespace(id), "private");
});

test("12b. privatePaperStableId: rejects empty ownerScopedId", () => {
  assert.throws(() => privatePaperStableId("", "p1"), /ownerScopedId required/);
});

test("12c. privatePaperStableId: rejects colon in ownerScopedId", () => {
  assert.throws(() => privatePaperStableId("user:a", "p1"), /must not contain ':'/);
});

test("12d. privatePaperStableId: different owners never collide", () => {
  const idA = privatePaperStableId("owner-a", "paper-001");
  const idB = privatePaperStableId("owner-b", "paper-001");
  assert.notEqual(idA, idB);
});

// ============================================================================
// 13. isValidOwnerScopedId
// ============================================================================
test("13. isValidOwnerScopedId: valid hash-like id passes", () => {
  assert.equal(isValidOwnerScopedId("user-hash-a1b2c3"), true);
  assert.equal(isValidOwnerScopedId("u_abc123"), true);
});

test("13b. isValidOwnerScopedId: rejects email format", () => {
  assert.equal(isValidOwnerScopedId("user@example.com"), false);
});

test("13c. isValidOwnerScopedId: rejects colon", () => {
  assert.equal(isValidOwnerScopedId("user:abc"), false);
});

test("13d. isValidOwnerScopedId: rejects empty/too short", () => {
  assert.equal(isValidOwnerScopedId(""), false);
  assert.equal(isValidOwnerScopedId("ab"), false);
});

// ============================================================================
// 14. 常量确认
// ============================================================================
test("14. PRIVATE constants", () => {
  assert.equal(PRIVATE_NEVER_IN_GLOBAL_SELECTOR, true);
  assert.equal(SOURCE_D_PRIVATE_USER_IMPORT, "SOURCE_D_PRIVATE_USER_IMPORT");
});

// ============================================================================
// 15. validatePrivatePaper — null/undefined paper
// ============================================================================
test("15. validatePrivatePaper: null paper → reject", () => {
  assert.ok(validatePrivatePaper(null as unknown as object).length > 0);
  assert.ok(validatePrivatePaper(undefined as unknown as object).length > 0);
});
