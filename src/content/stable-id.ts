/**
 * V13: Stable ID 设计（V13 Phase 1.1: Identity Hardening）
 *
 * 真题内容 ID 不能依赖数组 index / 文件名随机变化 / 数据库自增 ID。
 * 设计稳定、可读、可长期引用的 ID，并兼容 V10 现有 convention
 * （现有 mock 内容沿用 `word_<word>` / `r-<slug>` / `l-<slug>` / `t-<slug>` / `w-<slug>`，
 * 不批量重命名；本文档只负责 Paper 树的稳定 ID 生成）。
 *
 * Paper 树 ID 使用冒号分层的可读格式（与现有 mock ID 的连字符/下划线前缀不冲突）：
 *   REAL PAPER（真实 administered / past_exam / licensed official 卷）namespace：
 *     paper   : cet6:2025-12:set1
 *     section : cet6:2025-12:set1:reading
 *     group   : cet6:2025-12:set1:reading:careful:g1
 *     question: cet6:2025-12:set1:reading:careful:g1:q1
 *     asset   : cet6:2025-12:set1:listening:lecture:g1:audio1
 *   FIXTURE / SYNTHETIC（合成仿真内容，fixture=true）namespace：
 *     paper   : cet6:fixture:synthetic-001
 *     section : cet6:fixture:synthetic-001:reading
 *     group   : cet6:fixture:synthetic-001:reading:careful:g1
 *     question: cet6:fixture:synthetic-001:reading:careful:g1:q1
 *     asset   : cet6:fixture:synthetic-001:listening:lecture:g1:audio1
 *   ORIGINAL MOCK（自研原创模拟卷，authenticity=original/practice）namespace：
 *     paper   : cet6:mock:paper-001
 *     section : cet6:mock:paper-001:reading
 *     group   : cet6:mock:paper-001:reading:careful:g1
 *     question: cet6:mock:paper-001:reading:careful:g1:q1
 *     asset   : cet6:mock:paper-001:listening:lecture:g1:audio1
 *
 * 三个 namespace 结构上可区分（第 2 段 `fixture` / `mock` 为保留字）：
 * - REAL paper 永远不可能撞上 FIXTURE / MOCK paper 的 stable ID / identity；
 * - 未来导入真实 2026-6 set1 时，与 ORIGINAL MOCK paper-001 无任何 collision；
 * - 交叉校验：fixture=true 必须用 fixture namespace；past_exam 必须用 real namespace；
 *   original/practice mock 必须用 mock namespace（禁止 real date namespace）。
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

/** FIXTURE / SYNTHETIC namespace 前缀（保留字，真实试卷禁止使用）。 */
export const FIXTURE_PREFIX = "cet6:fixture";
/** ORIGINAL MOCK namespace 前缀（保留字；自研原创模拟卷专用，不与真实场次身份碰撞）。 */
export const MOCK_PREFIX = "cet6:mock";

function sessionText(year: number, session: number): string {
  return `${year}-${session}`;
}

/** REAL Paper 稳定 ID：cet6:2025-12:set1（past_exam / licensed official 卷必须使用）。 */
export function paperStableId(id: PaperIdentity): string {
  return `${id.exam.toLowerCase()}:${sessionText(id.year, id.session)}:set${id.set}`;
}

/** FIXTURE Paper 稳定 ID：cet6:fixture:synthetic-001（fixture 内容必须使用）。 */
export function fixturePaperStableId(fixtureId: string): string {
  return `${FIXTURE_PREFIX}:${fixtureId}`;
}

/** ORIGINAL MOCK Paper 稳定 ID：cet6:mock:paper-001（自研原创模拟卷必须使用）。 */
export function mockPaperStableId(mockId: string): string {
  return `${MOCK_PREFIX}:${mockId}`;
}

/** 通用追加段：在任意合法 paper/section 前缀上追加子段（REAL / FIXTURE / MOCK 共用）。 */
export function extendStableId(base: string, ...segments: string[]): string {
  if (!segments.length) return base;
  return `${base}:${segments.join(":")}`;
}

/** Section 稳定 ID：cet6:2025-12:set1:reading / cet6:fixture:synthetic-001:reading / cet6:mock:paper-001:reading */
export function sectionStableId(id: SectionIdentity): string {
  return extendStableId(paperStableId(id), id.section);
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

const REAL_PAPER_RE = /^cet6:\d{4}-(6|12):set\d+$/;
const FIXTURE_PAPER_RE = /^cet6:fixture:[a-z0-9][a-z0-9-]*$/;
const MOCK_PAPER_RE = /^cet6:mock:[a-z0-9][a-z0-9-]*$/;
const SECTION_REAL_RE = /^(cet6:\d{4}-(6|12):set\d+):(writing|listening|reading|translation)$/;
const SECTION_FIXTURE_RE = /^(cet6:fixture:[a-z0-9][a-z0-9-]*):(writing|listening|reading|translation)$/;
const SECTION_MOCK_RE = /^(cet6:mock:[a-z0-9][a-z0-9-]*):(writing|listening|reading|translation)$/;

/** 校验 Paper 树 stable ID 格式（REAL / FIXTURE / MOCK namespace 均合法）。 */
export function isValidStableId(id: string, kind: StableIdKind): boolean {
  if (typeof id !== "string" || !id.length) return false;
  if (kind === "paper") return REAL_PAPER_RE.test(id) || FIXTURE_PAPER_RE.test(id) || MOCK_PAPER_RE.test(id);
  if (kind === "section") return SECTION_REAL_RE.test(id) || SECTION_FIXTURE_RE.test(id) || SECTION_MOCK_RE.test(id);
  // group/question/asset：section 前缀（前 4 段）+ :<…> 后缀
  const prefix = id.split(":").slice(0, 4).join(":");
  return (
    (SECTION_REAL_RE.test(prefix) || SECTION_FIXTURE_RE.test(prefix) || SECTION_MOCK_RE.test(prefix)) &&
    id.split(":").length >= 5
  );
}

export type StableIdNamespace = "real" | "mock" | "fixture" | "invalid";

/**
 * 判别 stable ID 属于哪个 namespace（前 3 段 = paper 前缀段）：
 * - "real"：真实 administered / past_exam / licensed official 卷（cet6:<year>-<session>:set<N>…）
 * - "mock"：自研原创模拟卷（cet6:mock:<mockId>…）
 * - "fixture"：合成仿真内容（cet6:fixture:<fixtureId>…）
 * - "invalid"：不合法
 */
export function stableIdNamespace(id: string): StableIdNamespace {
  if (typeof id !== "string") return "invalid";
  const seg = id.split(":");
  if (seg.length < 3) return "invalid";
  const paperPrefix = seg.slice(0, 3).join(":");
  if (REAL_PAPER_RE.test(paperPrefix)) return "real";
  if (FIXTURE_PAPER_RE.test(paperPrefix)) return "fixture";
  if (MOCK_PAPER_RE.test(paperPrefix)) return "mock";
  return "invalid";
}

export function isRealStableId(id: string): boolean {
  return stableIdNamespace(id) === "real";
}

export function isFixtureStableId(id: string): boolean {
  return stableIdNamespace(id) === "fixture";
}

export function isMockStableId(id: string): boolean {
  return stableIdNamespace(id) === "mock";
}
