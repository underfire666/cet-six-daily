/**
 * V14 Phase 0：权利 / 准入 synthetic fixtures（v14.1.1.txt §21）。
 *
 * 重要：全部内容为本文件原创占位文本（synthetic placeholder），
 * 不含任何真实 CET6 真题正文、真实听力脚本、官方解析或真实音频。
 * 这些 fixture 仅用于测试 rights 状态机 / REAL production guard / PRIVATE 隔离契约，
 * 不注册进 global registry（不进入 production pool / selector），
 * 不构成“已发布 REAL 卷”。
 *
 * 当前日期基准：2026-09-29（expiresAt/effectiveAt 比较）。
 */
import type { CET6Paper } from "../papers";
import type { ContentRights } from "../types";
import { mockPaperStableId, extendStableId, paperStableId } from "../stable-id";
import { privatePaperStableId, type PrivateContentMeta } from "../private-content";

const NOW = "2026-09-29T00:00:00.000Z";
/** past_exam REAL fixture 身份：cet6:2024-12:set1（占位，非真实可发布卷）。 */
const REAL_ID = paperStableId({ exam: "CET6", year: 2024, session: 12, set: 1 });
const REAL_SEC = extendStableId(REAL_ID, "writing");
const REAL_GROUP = extendStableId(REAL_SEC, "g1");
const REAL_Q = extendStableId(REAL_GROUP, "q1");

interface MinimalPaperOpts {
  paperId: string;
  year: number;
  session: 6 | 12;
  set: number;
  authenticity: CET6Paper["authenticity"];
  status: CET6Paper["status"];
  rights: ContentRights;
  examSpecId?: string;
  fixture?: boolean;
  audioRecordingRights?: CET6Paper["audioRecordingRights"];
  explanationAuthenticity?: CET6Paper["explanationAuthenticity"];
}

/** 构造最小合法 paper（1 writing section + 1 subjective question，isPartial=true 豁免 spec 题量）。 */
function minimalPaper(o: MinimalPaperOpts): CET6Paper {
  return {
    paperId: o.paperId,
    type: "paper",
    tags: [],
    examSpecId: o.examSpecId,
    exam: "CET6",
    level: "CET6",
    year: o.year,
    session: o.session,
    set: o.set,
    title: `V14 synthetic rights fixture (${o.paperId})`,
    sourceId: "src-v14-rights-fixture",
    rights: o.rights,
    sections: [
      {
        sectionId: extendStableId(o.paperId, "writing"),
        type: "writing",
        order: 1,
        groups: [
          {
            groupId: extendStableId(extendStableId(o.paperId, "writing"), "g1"),
            type: "writing",
            order: 1,
            prompt: "Write a short essay on a synthetic placeholder topic (no real exam content).",
            questions: [
              {
                questionId: extendStableId(extendStableId(extendStableId(o.paperId, "writing"), "g1"), "q1"),
                order: 1,
                prompt: "Write a short essay on a synthetic placeholder topic (no real exam content).",
                type: "subjective_writing",
                answerText: "Synthetic placeholder model essay (project-authored, no real exam content).",
              },
            ],
          },
        ],
      },
    ],
    schemaVersion: "1.0.0",
    isPartial: true,
    fixture: o.fixture,
    status: o.status,
    authenticity: o.authenticity,
    audioRecordingRights: o.audioRecordingRights,
    explanationAuthenticity: o.explanationAuthenticity,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

/** 一个“权利已清结”的完整 rights 模板（各 fixture 在此基础上改坏一个维度）。 */
const CLEARED_RIGHTS: ContentRights = {
  licenseStatus: "licensed",
  rightsHolder: "Synthetic Rights Holder (fixture only)",
  rightsStatus: "cleared",
  permissionBasis: "signed_contract",
  termType: "fixed",
  licenseName: "V14 Synthetic Evaluation License",
  licenseUrl: "https://rights.example.test/v14-fixture-license",
  permissionEvidence: "contract-ref:V14-SYNTHETIC-CLEARED",
  allowedUses: ["learning", "practice"],
  commercialUseAllowed: true,
  redistributionAllowed: true,
  derivativeAllowed: false,
  territory: "China mainland",
  effectiveAt: "2026-01-01T00:00:00.000Z",
  expiresAt: "2027-12-31T23:59:59.000Z",
  sourceRetrievedAt: "2026-09-20T00:00:00.000Z",
  reviewedAt: "2026-09-25T00:00:00.000Z",
  reviewNote: "Synthetic fixture only; does not represent a cleared real CET6 paper.",
  verifiedAt: "2026-09-25T00:00:00.000Z",
};

/** A. REAL + cleared rights → production allowed（结构合法 + 准入通过）。 */
export const V14_FIXTURE_REAL_CLEARED: CET6Paper = minimalPaper({
  paperId: REAL_ID,
  year: 2024,
  session: 12,
  set: 1,
  authenticity: "past_exam",
  status: "published",
  rights: { ...CLEARED_RIGHTS },
  examSpecId: "cet6-current-2026",
  explanationAuthenticity: "project_authored",
});

/** B. REAL + unverified rights → production rejected（rightsStatus != cleared）。 */
export const V14_FIXTURE_REAL_UNVERIFIED: CET6Paper = minimalPaper({
  paperId: REAL_ID,
  year: 2024,
  session: 12,
  set: 1,
  authenticity: "past_exam",
  status: "active",
  rights: { ...CLEARED_RIGHTS, rightsStatus: "unverified" },
  examSpecId: "cet6-current-2026",
});

/** C. REAL + cleared but redistribution=false → production rejected。 */
export const V14_FIXTURE_REAL_NO_REDISTRIBUTION: CET6Paper = minimalPaper({
  paperId: REAL_ID,
  year: 2024,
  session: 12,
  set: 1,
  authenticity: "past_exam",
  status: "active",
  rights: { ...CLEARED_RIGHTS, redistributionAllowed: false },
  examSpecId: "cet6-current-2026",
});

/** D. REAL + cleared but evidence missing → production rejected。 */
export const V14_FIXTURE_REAL_MISSING_EVIDENCE: CET6Paper = minimalPaper({
  paperId: REAL_ID,
  year: 2024,
  session: 12,
  set: 1,
  authenticity: "past_exam",
  status: "active",
  rights: {
    ...CLEARED_RIGHTS,
    licenseName: undefined,
    licenseUrl: undefined,
    permissionEvidence: undefined,
  },
  examSpecId: "cet6-current-2026",
});

/** E/F. PRIVATE owner A 的私有导入 meta（A 可访问，B 被拒）。 */
export const V14_FIXTURE_PRIVATE_OWNER_A: PrivateContentMeta = {
  ownerId: "user-a",
  ownerNamespace: "user:hash-a",
  visibility: "private",
  redistributable: false,
  productionEligible: false,
  globalSelectorEligible: false,
  shareEligible: false,
  paperId: privatePaperStableId("user-a", "imported-paper-001"),
  importedAt: NOW,
  rightsAcknowledgement: {
    acknowledged: true,
    acknowledgedAt: NOW,
    statementVersion: "v14.1",
  },
};

/** G. MOCK + owned rights → existing behavior unchanged（不触发 REAL guard）。 */
export const V14_FIXTURE_MOCK_UNCHANGED: CET6Paper = minimalPaper({
  paperId: mockPaperStableId("v14-regression-001"),
  year: 2026,
  session: 12,
  set: 1,
  authenticity: "original",
  status: "staging",
  rights: {
    licenseStatus: "owned",
    rightsHolder: "CET-6 Daily Project",
    commercialUseAllowed: true,
    redistributionAllowed: true,
    verifiedAt: NOW,
    notes: "V14 regression fixture: original mock, behavior unchanged.",
  },
});

/** 导出 REAL section/group/question ID 供测试断言（不参与发布）。 */
export const V14_FIXTURE_REAL_IDS = {
  paper: REAL_ID,
  section: REAL_SEC,
  group: REAL_GROUP,
  question: REAL_Q,
} as const;
