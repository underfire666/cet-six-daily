import type { ContentSource } from "./types";

/** 内置来源：当前所有内容均为项目原创 Mock。licenseType=unknown 不进 production 内容池。 */
export const MOCK_SOURCE: ContentSource = {
  id: "src-mock-original",
  name: "Project Mock Content (Original)",
  type: "mock",
  licenseType: "unknown",
  notes: "V10 阶段内置示例内容，非真题、非商业题库。",
};

/**
 * V13：首份原创 synthetic CET6 Paper 来源。
 * 全部内容为本项目原创编写（原创范文/原创听力脚本/原创题目），
 * 不包含任何真实真题原文或真实音频，rights=owned。
 */
export const SYNTHETIC_PAPER_SOURCE: ContentSource = {
  id: "src-cet6-synthetic",
  name: "CET6 Synthetic Paper (Original)",
  type: "original",
  licenseType: "original",
  notes: "V13 原创仿真 CET6 试卷 fixture：结构参照官方公开考试结构，内容全部原创，供导入管线验证使用。",
  rights: {
    licenseStatus: "owned",
    rightsHolder: "CET-6 Daily Project",
    commercialUseAllowed: true,
    redistributionAllowed: true,
    derivativeAllowed: true,
    verifiedAt: "2026-09-26T00:00:00.000Z",
    notes: "原创 fixture 内容，本项目自有版权。",
  },
  provenance: {
    sourceType: "original",
    sourceTitle: "CET6 Synthetic Paper (Original Fixture)",
  },
};

/**
 * V13 Phase 2C：Paper 001（cet6:mock:paper-001）来源。
 * 全部内容为项目自研原创（原创写作任务、原创听力脚本与题目、原创阅读篇章与题目、
 * 原创翻译段落与参考译文、原创解析），不含任何真实真题原文、第三方解析或真实音频。
 * authenticity=original，rights=owned。
 */
export const MOCK_PAPER_001_SOURCE: ContentSource = {
  id: "src-cet6-mock-paper-001",
  name: "CET6 Original Mock Paper 001 (Project-authored)",
  type: "original",
  licenseType: "original",
  notes:
    "V13 Phase 2C 原创高仿真模拟卷：结构与题型参照 CET6 官方公开考试结构，正文全部由本项目编写（project-authored），非真题、非第三方资料。",
  rights: {
    licenseStatus: "owned",
    rightsHolder: "CET-6 Daily Project",
    commercialUseAllowed: true,
    redistributionAllowed: true,
    derivativeAllowed: true,
    verifiedAt: "2026-09-28T00:00:00.000Z",
    notes: "原创生产内容，本项目自有版权；不含真实真题、真实音频与第三方材料。",
  },
  provenance: {
    sourceType: "original",
    sourceTitle: "CET6 Original Mock Paper 001",
    publisher: "CET-6 Daily Project",
    rightsHolder: "CET-6 Daily Project",
    publishedAt: "2026-09-28T00:00:00.000Z",
  },
};

export const CONTENT_SOURCES: Record<string, ContentSource> = {
  [MOCK_SOURCE.id]: MOCK_SOURCE,
  [SYNTHETIC_PAPER_SOURCE.id]: SYNTHETIC_PAPER_SOURCE,
  [MOCK_PAPER_001_SOURCE.id]: MOCK_PAPER_001_SOURCE,
};

export function getSource(id: string): ContentSource | undefined {
  return CONTENT_SOURCES[id];
}
