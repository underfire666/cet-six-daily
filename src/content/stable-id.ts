/**
 * V13: Stable ID 设计
 *
 * 真题内容 ID 不能依赖数组 index / 文件名随机变化 / 数据库自增 ID。
 * 设计稳定、可读、可长期引用的 ID，并兼容 V10 现有 convention
 * （现有 mock 内容沿用 `word_<word>` / `r-<slug>` / `l-<slug>` / `t-<slug>` / `w-<slug>`，
 * 不批量重命名；本文档只负责 Paper 树的稳定 ID 生成）。
 *
 * Paper 树 ID 使用冒号分层的可读格式（与现有 mock ID 的连字符/下划线前缀不冲突）：
 *   paper   : cet6:2025-12:set1
 *   section : cet6:2025-12:set1:reading
 *   group   : cet6:2025-12:set1:reading:careful:g1
 *   question: cet6:2025-12:set1:reading:careful:g1:q1
 *   asset   : cet6:2025-12:set1:listening:lecture:g1:audio1
 *
 * 一旦发布，stable ID 不因解析/解释/排版修正而变化；
 * 仅当原题身份变化时换新 ID 并在 aliases.ts 登记 deprecated mapping。
 */

export type StableIdKind = "paper" | "section" | "group" | "question" | "asset";

export interface PaperIdentity {
  exam: "CET6";
  year: number;
  session: 6 | 12;
  set: number;
}

export interface SectionIdentity extends PaperIdentity {
  section: "writing" | "listening" | "reading" | "translation";
}

export interface GroupIdentity extends SectionIdentity {
  subsection?: string;
  group: string;
}

export interface QuestionIdentity extends GroupIdentity {
  question: string;
}

export interface AssetIdentity extends GroupIdentity {
  asset: string;
}

function sessionText(year: number, session: number): string {
  return `${year}-${session}`;
}

/** Paper 稳定 ID：cet6:2025-12:set1 */
export function paperStableId(id: PaperIdentity): string {
  return `${id.exam.toLowerCase()}:${sessionText(id.year, id.session)}:set${id.set}`;
}

/** Section 稳定 ID：cet6:2025-12:set1:reading */
export function sectionStableId(id: SectionIdentity): string {
  return `${paperStableId(id)}:${id.section}`;
}

/** Group 稳定 ID：cet6:2025-12:set1:reading:careful:g1 */
export function groupStableId(id: GroupIdentity): string {
  const base = sectionStableId(id);
  return id.subsection ? `${base}:${id.subsection}:${id.group}` : `${base}:${id.group}`;
}

/** Question 稳定 ID：cet6:2025-12:set1:reading:careful:g1:q1 */
export function questionStableId(id: QuestionIdentity): string {
  return `${groupStableId(id)}:${id.question}`;
}

/** Asset 稳定 ID：cet6:2025-12:set1:listening:lecture:g1:audio1 */
export function assetStableId(id: AssetIdentity): string {
  return `${groupStableId(id)}:${id.asset}`;
}

const PART_RE = /^cet6:\d{4}-(6|12):set\d+$/;
const SECTION_RE = /^(cet6:\d{4}-(6|12):set\d+):(writing|listening|reading|translation)$/;

/** 校验 Paper 树 stable ID 格式（section 及以上层级）。 */
export function isValidStableId(id: string, kind: StableIdKind): boolean {
  if (typeof id !== "string" || !id.length) return false;
  if (kind === "paper") return PART_RE.test(id);
  if (kind === "section") return SECTION_RE.test(id);
  // group/question/asset：section 前缀（前 4 段）+ :<…> 后缀
  const prefix = id.split(":").slice(0, 4).join(":");
  return SECTION_RE.test(prefix) && id.split(":").length >= 5;
}
