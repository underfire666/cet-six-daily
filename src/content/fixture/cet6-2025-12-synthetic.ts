/**
 * V13: 首份原创 Synthetic CET6 Paper Fixture（V13 Phase 1.1: Identity Hardening）
 *
 * - 结构参照 CET6_EXAM_SPEC 官方公开考试结构（题型/小节划分），
 * - 内容全部原创（原创写作 prompt、原创听力脚本、原创阅读 passage、原创翻译句、原创题目），
 * - 不含任何真实历年真题原文 / 培训机构 PDF / 真实听力音频；
 * - isPartial=true（不是完整真题卷），fixture=true（合成标记），status="staging"
 *   （不进入 production published 池，不暴露给学习页 Selector，仅开发/测试 resolve）。
 *
 * IDENTITY（V13 Phase 1.1）：
 * - 本 fixture 使用 FIXTURE namespace：`cet6:fixture:<fixtureId>`（fixtureId=synthetic-001）。
 * - REAL paper namespace（cet6:2025-12:set1…）是真实试卷的保留命名空间，
 *   未来导入真实 2025-12 set1 时与 synthetic fixture 结构上不可能冲突：
 *   stable ID、paper identity、duplicate detector、alias 全部隔离。
 * - 交叉校验：fixture=true 必须使用 fixture namespace（papers.ts validatePaper 强制）。
 *
 * 同时演示 Paper 树的两种 question 组织方式：
 *   A) questionRefs：引用已注册内容 item 内题目（如 r-ai-screening / l-campus-meeting）
 *   B) questions：paper 内联题（带 paper 作用域 stable ID）
 */
import { registerContentPack } from "../registry";
import { SYNTHETIC_PAPER_SOURCE } from "../sources";
import type { ContentPack } from "../types";
import type { CET6Paper } from "../papers";
import { extendStableId, fixturePaperStableId } from "../stable-id";

export const SYNTHETIC_FIXTURE_ID = "synthetic-001";
export const SYNTHETIC_PAPER_ID = fixturePaperStableId(SYNTHETIC_FIXTURE_ID); // cet6:fixture:synthetic-001
export const SYNTHETIC_PACK_ID = "pack-paper-cet6-2025-12-synthetic";

// FIXTURE namespace 下的 section / group / question / asset 稳定 ID
const base = fixturePaperStableId(SYNTHETIC_FIXTURE_ID);

const secWriting = extendStableId(base, "writing");
const secListening = extendStableId(base, "listening");
const secReading = extendStableId(base, "reading");
const secTranslation = extendStableId(base, "translation");

const gWriting = extendStableId(secWriting, "g1");
const gConversation = extendStableId(secListening, "long_conversation", "g1");
const gLecture = extendStableId(secListening, "lecture", "g2");
const gCloze = extendStableId(secReading, "cloze", "g1");
const gMatching = extendStableId(secReading, "matching", "g2");
const gCareful = extendStableId(secReading, "careful_reading", "g3");
const gTranslation = extendStableId(secTranslation, "g1");

const audioAssetId = extendStableId(secListening, "lecture", "g2", "audio1");

const now = "2026-09-26T00:00:00.000Z";

export const syntheticCet6Paper: CET6Paper = {
  paperId: SYNTHETIC_PAPER_ID,
  type: "paper",
  tags: [],
  exam: "CET6",
  level: "CET6",
  // 仿真目标卷描述（不影响 identity）：真实 2025-12 set1 的 namespace 与 ID 与 fixture 完全隔离
  year: 2025,
  session: 12,
  set: 1,
  title: "CET6 Synthetic Paper Fixture (Original, Partial)",
  sourceId: SYNTHETIC_PAPER_SOURCE.id,
  rights: {
    licenseStatus: "owned",
    rightsHolder: "CET-6 Daily Project",
    commercialUseAllowed: true,
    redistributionAllowed: true,
    derivativeAllowed: true,
    verifiedAt: "2026-09-26T00:00:00.000Z",
    notes: "原创仿真 fixture，内容为本项目编写，不包含真实真题。",
  },
  sections: [
    {
      sectionId: secWriting,
      type: "writing",
      order: 1,
      instructions: "Write an essay on the given topic. You should write at least 150 words but no more than 200 words.",
      groups: [
        {
          groupId: gWriting,
          type: "writing",
          order: 1,
          prompt: "Write an essay on the role of public libraries in the digital age.",
          questions: [
            {
              questionId: extendStableId(gWriting, "q1"),
              order: 1,
              prompt: "Write an essay on the role of public libraries in the digital age.",
              type: "subjective_writing",
              answerText:
                "Suggested outline: (1) libraries remain important as community spaces and free access points; (2) digital resources complement but do not replace them; (3) libraries adapt by offering digital literacy programs.",
              answerKey: {
                value: "Model answer: Public libraries are more than storehouses of books...",
                source: "synthetic-fixture",
              },
              explanation: {
                author: "CET-6 Daily Editorial",
                version: "1",
                reviewStatus: "reviewed",
                text: "The essay should take a clear position, develop it with reasons and examples, and conclude coherently.",
                updatedAt: now,
              },
            },
          ],
        },
      ],
    },
    {
      sectionId: secListening,
      type: "listening",
      order: 2,
      instructions: "In this section, you will hear long conversations, passages and lectures.",
      groups: [
        {
          groupId: gConversation,
          type: "long_conversation",
          order: 1,
          transcript:
            "W: Hi Mark, have you signed up for the campus volunteer program this semester? M: Not yet. I heard the application deadline is this Friday. W: That's right. They need helpers for the book fair and the community garden project. M: The garden project sounds interesting. What does it involve? W: Mostly weeding and planting on Saturday mornings. Volunteers also get a certificate at the end of the term.",
          questions: [
            {
              questionId: extendStableId(gConversation, "q1"),
              order: 1,
              prompt: "What is the application deadline for the volunteer program?",
              type: "choice",
              options: [
                { id: "a", text: "This Friday." },
                { id: "b", text: "Next Monday." },
                { id: "c", text: "At the end of the term." },
                { id: "d", text: "This Saturday morning." },
              ],
              answerId: "a",
              answerKey: { value: "a", source: "synthetic-fixture" },
              shortExplanation: "The man says he heard the deadline is this Friday, and the woman confirms.",
            },
            {
              questionId: extendStableId(gConversation, "q2"),
              order: 2,
              prompt: "What do volunteers receive at the end of the term?",
              type: "choice",
              options: [
                { id: "a", text: "A paid internship." },
                { id: "b", text: "A certificate." },
                { id: "c", text: "Free books." },
                { id: "d", text: "A gardening kit." },
              ],
              answerId: "b",
              answerKey: { value: "b", source: "synthetic-fixture" },
              shortExplanation: "The woman mentions volunteers also get a certificate at the end of the term.",
            },
          ],
        },
        {
          groupId: gLecture,
          type: "lecture",
          order: 2,
          transcript:
            "Good morning. Today we examine how cities can bring nature back into dense neighbourhoods. Researchers studied three European capitals and found that small pocket parks, planted rooftops and tree-lined streets measurably lower local summer temperatures. More importantly, residents who lived within a five-minute walk of a green space reported better sleep and lower stress. The costs are modest, but the benefits compound over decades.",
          questions: [
            {
              questionId: extendStableId(gLecture, "q1"),
              order: 1,
              prompt: "What did researchers find about pocket parks and planted rooftops?",
              type: "choice",
              options: [
                { id: "a", text: "They lower local summer temperatures." },
                { id: "b", text: "They increase property taxes." },
                { id: "c", text: "They require expensive maintenance." },
                { id: "d", text: "They mainly benefit tourists." },
              ],
              answerId: "a",
              answerKey: { value: "a", source: "synthetic-fixture" },
              shortExplanation: "The lecture says pocket parks, planted rooftops and tree-lined streets measurably lower local summer temperatures.",
            },
          ],
          assetIds: [audioAssetId],
        },
      ],
    },
    {
      sectionId: secReading,
      type: "reading",
      order: 3,
      instructions: "This section includes vocabulary comprehension, long reading matching and careful reading.",
      groups: [
        {
          groupId: gCloze,
          type: "cloze",
          order: 1,
          passage:
            "Online learning has grown rapidly. However, students who study alone often (1) ______ motivation. Researchers suggest forming small study groups, (2) ______ members check each other's progress regularly.",
          questions: [
            {
              questionId: extendStableId(gCloze, "q1"),
              order: 1,
              prompt: "Choose the best word for blank (1).",
              type: "choice",
              options: [
                { id: "a", text: "lose" },
                { id: "b", text: "gain" },
                { id: "c", text: "ignore" },
                { id: "d", text: "record" },
              ],
              answerId: "a",
              answerKey: { value: "a", source: "synthetic-fixture" },
              shortExplanation: "Students who study alone often lose motivation fits the context.",
            },
            {
              questionId: extendStableId(gCloze, "q2"),
              order: 2,
              prompt: "Choose the best word for blank (2).",
              type: "choice",
              options: [
                { id: "a", text: "where" },
                { id: "b", text: "whose" },
                { id: "c", text: "in which" },
                { id: "d", text: "whom" },
              ],
              answerId: "c",
              answerKey: { value: "c", source: "synthetic-fixture" },
              shortExplanation: "Groups in which members check each other's progress is the correct relative clause.",
            },
          ],
        },
        {
          groupId: gMatching,
          type: "matching",
          order: 2,
          passage:
            "Match each statement to the correct paragraph. Paragraphs A–D summarise four short passages about urban green spaces, remote work, food delivery robots and lifelong learning.",
          questions: [
            {
              questionId: extendStableId(gMatching, "q1"),
              order: 1,
              prompt: "Which paragraph argues that remote work reduces commuting pressure?",
              type: "matching",
              answerText: "B",
              answerKey: { value: "B", source: "synthetic-fixture" },
              shortExplanation: "Paragraph B discusses remote work and commuting.",
            },
          ],
        },
        {
          groupId: gCareful,
          type: "careful_reading",
          order: 3,
          passage:
            "Urban forests are quietly reshaping how city dwellers experience their neighbourhoods. Beyond their obvious beauty, trees perform measurable services: they cool the air, slow rainwater, and absorb noise. In one longitudinal study, neighbourhoods that planted trees along main streets saw a measurable drop in reported stress among residents over five years. The authors caution, however, that tree planting is not a substitute for addressing the root causes of urban inequality; greenery simply makes crowded lives more bearable while deeper problems remain.",
          questions: [
            {
              questionId: extendStableId(gCareful, "q1"),
              order: 1,
              prompt: "What is the main point of the passage?",
              type: "choice",
              options: [
                { id: "a", text: "Trees measurably improve city life but do not fix deeper inequalities." },
                { id: "b", text: "City governments should spend more on tree planting than housing." },
                { id: "c", text: "Urban forests have replaced other forms of public investment." },
                { id: "d", text: "Neighbourhood trees mainly benefit homeowners." },
              ],
              answerId: "a",
              answerKey: { value: "a", source: "synthetic-fixture" },
              shortExplanation: "The passage lists measurable services of trees and then cautions that greenery is not a substitute for solving urban inequality.",
              detailedExplanation:
                "First sentences describe measurable services (cooling, rain, noise). The study shows stress drop. The caution sentence ('not a substitute') is the key nuance that makes A the best summary.",
            },
            {
              questionId: extendStableId(gCareful, "q2"),
              order: 2,
              prompt: "According to the passage, what did the longitudinal study find?",
              type: "choice",
              options: [
                { id: "a", text: "Stress among residents dropped after trees were planted along main streets." },
                { id: "b", text: "Rainwater damage increased in tree-lined neighbourhoods." },
                { id: "c", text: "Residents reported more noise near new trees." },
                { id: "d", text: "Tree planting eliminated urban inequality." },
              ],
              answerId: "a",
              answerKey: { value: "a", source: "synthetic-fixture" },
              shortExplanation: "The study found a measurable drop in reported stress among residents over five years.",
            },
          ],
        },
      ],
    },
    {
      sectionId: secTranslation,
      type: "translation",
      order: 4,
      instructions: "Translate the following passage into English.",
      groups: [
        {
          groupId: gTranslation,
          type: "translation",
          order: 1,
          prompt:
            "传统工艺在当代社会中仍然具有独特价值。它们不仅保留了历史记忆，也为现代生活提供了有温度的选择。越来越多的年轻人开始学习这些技艺，并将其与新的设计理念结合起来。",
          questions: [
            {
              questionId: extendStableId(gTranslation, "q1"),
              order: 1,
              prompt:
                "传统工艺在当代社会中仍然具有独特价值。它们不仅保留了历史记忆，也为现代生活提供了有温度的选择。越来越多的年轻人开始学习这些技艺，并将其与新的设计理念结合起来。",
              type: "subjective_translation",
              answerText:
                "Traditional crafts still hold unique value in contemporary society. They not only preserve historical memory but also offer warm choices for modern life. More and more young people are learning these skills and combining them with new design ideas.",
              answerKey: {
                value: "Model translation: Traditional crafts retain their unique value in today's society...",
                source: "synthetic-fixture",
              },
              explanation: {
                author: "CET-6 Daily Editorial",
                version: "1",
                reviewStatus: "reviewed",
                text: "Key points: '具有独特价值' (hold unique value), '保留了历史记忆' (preserve historical memory), '有温度的选择' (warm choices), '设计理念' (design ideas).",
                updatedAt: now,
              },
            },
          ],
        },
      ],
    },
  ],
  assets: [
    {
      assetId: audioAssetId,
      type: "audio",
      source: "mock://synthetic/lecture-fixture-synthetic-001.mp3",
      mimeType: "audio/mpeg",
      duration: 90,
      checksum: "synthetic-fixture-placeholder",
      rights: {
        licenseStatus: "owned",
        rightsHolder: "CET-6 Daily Project",
        notes: "占位 asset：本轮不引入真实音频。",
      },
    },
  ],
  schemaVersion: "1.0.0",
  contentVersion: "1.0.0",
  isPartial: true,
  fixture: true,
  status: "staging",
  authenticity: "practice",
  createdAt: now,
  updatedAt: now,
};

/** 注册 synthetic fixture（幂等；仅开发/测试/审计脚本调用，不进入运行时 bootstrap）。 */
export function registerSyntheticPaperFixture(): void {
  registerContentPack({
    id: SYNTHETIC_PACK_ID,
    name: "CET6 Synthetic Paper Fixture",
    version: "1.0.0",
    contentType: "paper",
    sourceId: SYNTHETIC_PAPER_SOURCE.id,
    items: [syntheticCet6Paper],
    schemaVersion: "1.0.0",
    rights: syntheticCet6Paper.rights,
    createdAt: now,
    updatedAt: now,
  } as ContentPack);
}
