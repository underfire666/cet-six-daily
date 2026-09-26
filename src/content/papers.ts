/**
 * V13: CET6 Paper 领域模型（完整试卷概念）。
 *
 * 领域层级：Exam → Paper → Section → Group → Question。
 * - Vocabulary 不是正式 CET6 Paper Section（它是产品训练模块）。
 * - 正式 CET6 Paper 至少支持 Writing / Listening(Long Conversation, Passage, Lecture) /
 *   Reading(Cloze, Matching, Careful Reading) / Translation(中译英段落翻译)。
 * - 不要假设每次考试只有一套卷：模型支持 year / examSession / paperSet(form) /
 *   section / subsection / group / questionOrder。
 * - Question 复用现有 V10 Question 结构；对 matching/cloze/listening group/
 *   subjective writing/subjective translation 做兼容性扩展。
 * - Answer / Explanation 分离：answerKey 为 source-derived（官方答案），
 *   explanation 为 editorial layer（带 author/version/reviewStatus）。
 * - Listening 真题把题目 / transcript / audio 分开（Asset metadata）。
 *
 * 兼容：validatePaper(value): string[] 签名保持不变（validator.ts 依赖）。
 */
import type { ContentRights } from "./types";
import { FIXTURE_PREFIX, isValidStableId, paperStableId, stableIdNamespace } from "./stable-id";

export type PaperLevel = "CET6";
export type PaperSession = 6 | 12;
export type PaperSectionKind = "writing" | "listening" | "reading" | "translation";
export type ListeningSubsection = "long_conversation" | "passage" | "lecture";
export type ReadingSubsection = "cloze" | "matching" | "careful_reading";
export type PaperGroupType =
  | "writing"
  | "long_conversation"
  | "passage"
  | "lecture"
  | "cloze"
  | "matching"
  | "careful_reading"
  | "translation";

/** Editorial 解析层（可独立修改而不改变原题 stable ID）。 */
export interface EditorialExplanation {
  author: string;
  version: string;
  reviewStatus: "draft" | "reviewed" | "approved";
  text: string;
  updatedAt: string;
}

/** Paper 内联题：兼容 V10 Question 字段 + V13 扩展。 */
export interface PaperQuestion {
  /** Paper 作用域稳定 ID（questionStableId 生成）。 */
  questionId: string;
  order: number;
  prompt: string;
  type: "choice" | "cloze" | "matching" | "subjective_writing" | "subjective_translation";
  options?: { id: string; text: string }[];
  /** 选择题答案（source-derived answer key）。 */
  answerId?: string;
  /** 主观 / 完形 / 匹配答案文本。 */
  answerText?: string;
  /** 显式 answer key（可带来源）。 */
  answerKey?: { value: string; source?: string };
  shortExplanation?: string;
  detailedExplanation?: string;
  hint?: string;
  /** editorial layer：修改解析不改 stable ID。 */
  explanation?: EditorialExplanation;
}

/** 引用已注册内容 item 内的题（如 reading 文章 / listening 材料内的 q1）。 */
export interface QuestionRef {
  /** 已注册 content item stable ID（如 r-ai-screening / l-campus-meeting）。 */
  contentId: string;
  /** item 内 question id（缺省表示整篇/整组引用）。 */
  questionId?: string;
  order: number;
}

export interface PaperGroup {
  groupId: string;
  type: PaperGroupType;
  order: number;
  /** 阅读 passage / 听力 transcript / 写作 prompt 文本（group 级材料）。 */
  passage?: string;
  transcript?: string;
  prompt?: string;
  /** 引用已有内容 item 的题。 */
  questionRefs?: QuestionRef[];
  /** 内联 Paper 专属题（matching/cloze/subjective/listening group）。 */
  questions?: PaperQuestion[];
  /** 关联 Asset（音频等）。 */
  assetIds?: string[];
}

export interface PaperSection {
  sectionId: string;
  type: PaperSectionKind;
  order: number;
  instructions?: string;
  groups: PaperGroup[];
}

export interface PaperAsset {
  assetId: string;
  type: "audio" | "image" | "transcript" | "document";
  /** storage reference（URL / 路径），本轮允许 mock/placeholder。 */
  source: string;
  mimeType: string;
  duration?: number;
  checksum?: string;
  rights?: ContentRights;
}

export interface CET6Paper {
  paperId: string;
  /** 内容系统公共字段：paper 也是 content item（type 恒为 "paper"，tags 可空）。 */
  type: "paper";
  tags?: string[];
  exam: "CET6";
  level: "CET6";
  year: number;
  /** 考试场次：6 = 六月场，12 = 十二月场。 */
  session: PaperSession;
  /** paperSet / form：支持一次考试多套卷。 */
  set: number;
  title: string;
  sourceId: string;
  rights: ContentRights;
  sections: PaperSection[];
  assets?: PaperAsset[];
  schemaVersion: string;
  contentVersion?: string;
  /** partial paper 必须显式 isPartial=true；complete paper 满足结构约束。 */
  isPartial?: boolean;
  /** 合成/仿真 fixture 标记（不得与真实真题混标）。 */
  fixture?: boolean;
  status: "draft" | "active" | "deprecated" | "raw" | "staging" | "published";
  authenticity: "original" | "practice" | "past_exam";
  createdAt: string;
  updatedAt: string;
}

const SECTION_KINDS: PaperSectionKind[] = ["writing", "listening", "reading", "translation"];
const GROUP_TYPES: PaperGroupType[] = [
  "writing",
  "long_conversation",
  "passage",
  "lecture",
  "cloze",
  "matching",
  "careful_reading",
  "translation",
];
const QUESTION_TYPES: PaperQuestion["type"][] = [
  "choice",
  "cloze",
  "matching",
  "subjective_writing",
  "subjective_translation",
];

const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const text = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;
const strArr = (v: unknown) => Array.isArray(v) && v.every((x) => typeof x === "string");

function uniqueSorted(nums: number[]): boolean {
  const s = [...nums].sort((a, b) => a - b);
  return s.every((n, i) => n === i + 1);
}

/**
 * 校验一个 paper item（contentType="paper"）。
 * 返回 string[]（保持 V10 签名）；error 级问题均列入。
 *
 * 兼容：V10 旧 schema（{id, examType, year, month, set, sections:[{kind,itemIds}]}）走结构级
 * 校验路径；V13 新 schema（paperId/exam/session/rights/schemaVersion/groups）走完整校验。
 */
export function validatePaper(value: unknown): string[] {
  const errors: string[] = [];
  if (!object(value)) return ["invalid paper"];
  // V10 legacy schema 兼容（历史内容/用户数据回放路径）
  const isLegacy = !("paperId" in value) && "id" in value;
  if (isLegacy) {
    const p = value as {
      id?: unknown; year?: unknown; month?: unknown;
      sections?: { kind?: unknown; itemIds?: unknown[] }[];
    };
    if (!text(p.id)) errors.push("paper missing id");
    if (!p.year || Number(p.year) < 2000) errors.push(`paper ${String(p.id)} bad year`);
    if (![6, 12].includes(Number(p.month))) errors.push(`paper ${String(p.id)} bad month`);
    if (!Array.isArray(p.sections) || p.sections.length === 0) errors.push(`paper ${String(p.id)} no sections`);
    else if (p.sections.some(s => !s || !["writing","listening","reading","translation"].includes(String(s.kind)) || !Array.isArray(s.itemIds) || !s.itemIds.length || s.itemIds.some(id => typeof id !== "string" || !id))) errors.push("invalid paper section references");
    return errors;
  }
  const paper = value as unknown as CET6Paper;
  const err = (m: string) => errors.push(m);

  if (!text(paper.paperId)) err("paper missing paperId");
  else if (!isValidStableId(paper.paperId, "paper")) err(`paper invalid paperId format: ${paper.paperId}`);
  else {
    const ns = stableIdNamespace(paper.paperId);
    // V13 Phase 1.1 交叉校验：fixture flag 与 namespace 必须一致
    if (paper.fixture === true && ns !== "fixture") {
      err(`paper ${paper.paperId} fixture=true must use fixture namespace (e.g. ${FIXTURE_PREFIX}:<fixtureId>)`);
    }
    if (paper.fixture !== true && ns === "fixture") {
      err(`paper ${paper.paperId} fixture=false/undefined must not use fixture namespace`);
    }
    if (ns === "real") {
      // paperId 与 year/session/set 一致性（仅 REAL namespace 参与）
      const expect = paperStableId({ exam: "CET6", year: paper.year, session: paper.session, set: paper.set });
      if (paper.paperId !== expect) err(`paperId ${paper.paperId} mismatch identity ${expect}`);
    }
  }
  if (paper.exam !== "CET6") err("paper exam must be CET6");
  if (paper.level !== "CET6") err("paper level must be CET6");
  if (!Number.isInteger(paper.year) || paper.year < 2000) err(`paper ${paper.paperId ?? "?"} bad year`);
  if (![6, 12].includes(paper.session)) err(`paper ${paper.paperId ?? "?"} bad session`);
  if (!Number.isInteger(paper.set) || paper.set < 1) err(`paper ${paper.paperId ?? "?"} bad set`);
  if (!text(paper.title)) err(`paper ${paper.paperId ?? "?"} missing title`);
  if (!text(paper.sourceId)) err(`paper ${paper.paperId ?? "?"} missing sourceId`);
  if (!text(paper.schemaVersion)) err(`paper ${paper.paperId ?? "?"} missing schemaVersion`);
  if (!object(paper.rights) || !text((paper.rights as { licenseStatus?: unknown }).licenseStatus as string)) {
    err(`paper ${paper.paperId ?? "?"} missing rights metadata (required for publishable pack)`);
  }
  const paperNs = text(paper.paperId) ? stableIdNamespace(paper.paperId) : ("invalid" as const);
  if (!Array.isArray(paper.sections) || paper.sections.length === 0) {
    err(`paper ${paper.paperId ?? "?"} no sections`);
  } else {
    const secOrders = paper.sections.map((s) => s.order);
    if (!uniqueSorted(secOrders)) err(`paper ${paper.paperId} section orders must be 1..N`);
    for (const sec of paper.sections) validateSection(sec, paper, errors, paperNs);
  }
  if (paper.assets) {
    for (const asset of paper.assets) {
      if (!text(asset.assetId)) err(`paper ${paper.paperId} asset missing assetId`);
      else if (!isValidStableId(asset.assetId, "asset")) err(`paper ${paper.paperId} invalid assetId: ${asset.assetId}`);
      else if (text(asset.assetId) && stableIdNamespace(asset.assetId) !== paperNs) {
        err(`paper ${paper.paperId} assetId ${asset.assetId} namespace differs from paperId`);
      }
      if (!["audio", "image", "transcript", "document"].includes(asset.type)) err(`paper ${paper.paperId} bad asset type`);
      if (!text(asset.source)) err(`paper ${paper.paperId} asset ${asset.assetId ?? "?"} missing source`);
      if (!text(asset.mimeType)) err(`paper ${paper.paperId} asset ${asset.assetId ?? "?"} missing mimeType`);
      if (asset.duration !== undefined && (!Number.isFinite(asset.duration) || asset.duration <= 0)) err(`paper ${paper.paperId} bad asset duration`);
    }
  }
  // partial paper 必须显式 isPartial=true；fixture 必须显式标记
  if (paper.isPartial !== undefined && typeof paper.isPartial !== "boolean") err(`paper ${paper.paperId} isPartial must be boolean`);
  if (paper.fixture !== undefined && typeof paper.fixture !== "boolean") err(`paper ${paper.paperId} fixture must be boolean`);
  if (!["draft", "active", "deprecated", "raw", "staging", "published"].includes(paper.status)) err(`paper ${paper.paperId} bad status`);
  if (!["original", "practice", "past_exam"].includes(paper.authenticity)) err(`paper ${paper.paperId} bad authenticity`);
  if (!text(paper.createdAt) || !text(paper.updatedAt)) err(`paper ${paper.paperId} missing timestamps`);
  return errors;
}

function validateSection(sec: unknown, paper: CET6Paper, errors: string[], paperNs: ReturnType<typeof stableIdNamespace>): void {
  const err = (m: string) => errors.push(m);
  if (!object(sec)) { err(`paper ${paper.paperId} invalid section`); return; }
  const s = sec as unknown as PaperSection;
  if (!text(s.sectionId)) err(`paper ${paper.paperId} section missing sectionId`);
  else if (!isValidStableId(s.sectionId, "section")) err(`paper ${paper.paperId} invalid sectionId: ${s.sectionId}`);
  else if (text(s.sectionId) && stableIdNamespace(s.sectionId) !== paperNs) {
    err(`paper ${paper.paperId} sectionId ${s.sectionId} namespace differs from paperId`);
  }
  if (!SECTION_KINDS.includes(s.type)) err(`paper ${paper.paperId} section bad type`);
  if (!Number.isInteger(s.order) || s.order < 1) err(`paper ${paper.paperId} section bad order`);
  if (!Array.isArray(s.groups) || s.groups.length === 0) { err(`paper ${paper.paperId} section ${s.sectionId ?? "?"} no groups`); return; }
  const gOrders = s.groups.map((g) => g.order);
  if (!uniqueSorted(gOrders)) err(`paper ${paper.paperId} section ${s.sectionId} group orders must be 1..N`);
  for (const g of s.groups) validateGroup(g, paper, s, errors, paperNs);
}

function validateGroup(g: unknown, paper: CET6Paper, sec: PaperSection, errors: string[], paperNs: ReturnType<typeof stableIdNamespace>): void {
  const err = (m: string) => errors.push(m);
  if (!object(g)) { err(`paper ${paper.paperId} invalid group`); return; }
  const grp = g as unknown as PaperGroup;
  if (!text(grp.groupId)) err(`paper ${paper.paperId} group missing groupId`);
  else if (!isValidStableId(grp.groupId, "group")) err(`paper ${paper.paperId} invalid groupId: ${grp.groupId}`);
  else if (text(grp.groupId) && stableIdNamespace(grp.groupId) !== paperNs) {
    err(`paper ${paper.paperId} groupId ${grp.groupId} namespace differs from paperId`);
  }
  if (!GROUP_TYPES.includes(grp.type)) err(`paper ${paper.paperId} group bad type: ${String(grp.type)}`);
  if (!Number.isInteger(grp.order) || grp.order < 1) err(`paper ${paper.paperId} group bad order`);
  const refs = grp.questionRefs ?? [];
  const qs = grp.questions ?? [];
  if (refs.length === 0 && qs.length === 0) {
    err(`paper ${paper.paperId} group ${grp.groupId ?? "?"} must have questionRefs or questions`);
    return;
  }
  const seenQ = new Set<string>();
  for (const ref of refs) {
    if (!object(ref) || !text(ref.contentId)) err(`paper ${paper.paperId} group ${grp.groupId} bad questionRef`);
    if (ref && ref.questionId !== undefined && !text(ref.questionId)) err(`paper ${paper.paperId} group ${grp.groupId} bad ref questionId`);
    if (ref && !Number.isInteger(ref.order)) err(`paper ${paper.paperId} group ${grp.groupId} bad ref order`);
  }
  for (const q of qs) {
    if (!object(q) || !text(q.questionId)) { err(`paper ${paper.paperId} group ${grp.groupId} question missing questionId`); continue; }
    if (seenQ.has(q.questionId)) err(`paper ${paper.paperId} duplicate questionId ${q.questionId}`);
    seenQ.add(q.questionId);
    if (!isValidStableId(q.questionId, "question")) err(`paper ${paper.paperId} invalid questionId: ${q.questionId}`);
    else if (stableIdNamespace(q.questionId) !== paperNs) {
      err(`paper ${paper.paperId} questionId ${q.questionId} namespace differs from paperId`);
    }
    const qq = q as PaperQuestion;
    if (!Number.isInteger(qq.order) || qq.order < 1) err(`paper ${paper.paperId} question ${qq.questionId} bad order`);
    if (!text(qq.prompt)) err(`paper ${paper.paperId} question ${qq.questionId} missing prompt`);
    if (!QUESTION_TYPES.includes(qq.type)) err(`paper ${paper.paperId} question ${qq.questionId} bad type`);
    if (qq.type === "choice") {
      const options = Array.isArray(qq.options) ? qq.options : [];
      if (options.length < 2 || options.some((o) => !text(o.id) || !text(o.text))) err(`paper ${paper.paperId} question ${qq.questionId} incomplete options`);
      const ids = options.map((o) => o.id);
      if (new Set(ids).size !== ids.length) err(`paper ${paper.paperId} question ${qq.questionId} duplicate option id`);
      if (!text(qq.answerId) || !ids.includes(qq.answerId)) err(`paper ${paper.paperId} question ${qq.questionId} invalid answerId`);
    } else if (!text(qq.answerText) && !(qq.answerKey && text(qq.answerKey.value))) {
      err(`paper ${paper.paperId} question ${qq.questionId} missing answerText/answerKey`);
    }
    if (qq.explanation !== undefined && (!object(qq.explanation) || !text(qq.explanation.text) || !["draft", "reviewed", "approved"].includes(qq.explanation.reviewStatus))) {
      err(`paper ${paper.paperId} question ${qq.questionId} invalid explanation metadata`);
    }
  }
  if (grp.assetIds !== undefined && !strArr(grp.assetIds)) err(`paper ${paper.paperId} group ${grp.groupId} invalid assetIds`);
}
