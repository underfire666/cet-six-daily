/**
 * V13: CET6 Exam Specification（官方公开结构元数据）。
 *
 * 用途：作为 validator 参考，把"考试结构公开信息"与"真题全文再发布权"分开。
 * 数据来源：CET6 官方公开的考试结构（题型名称、题量、建议时间、分值比例），
 * 属官方公开材料（official_public_material），不包含任何真题原文。
 * 禁止硬编码散落在 React UI；统一由本模块提供。
 */
export interface Cet6ExamSectionSpec {
  kind: "writing" | "listening" | "reading" | "translation";
  name: string;
  questionCount: number;
  timeMinutes: number;
  scoreRatio: string; // 例如 "15%"
}

/** 听力小节（当前官方结构，V13 Phase 2A.1 已按 NEEA 官方修正）。 */
export interface Cet6ListeningSubsectionSpec {
  kind: "long_conversation" | "passage" | "lecture";
  name: string;
  questionCount: number;
  scoreRatio: string;
}

/** 阅读小节（官方公开结构）。 */
export interface Cet6ReadingSubsectionSpec {
  kind: "cloze" | "matching" | "careful_reading";
  name: string;
  questionCount: number;
  scoreRatio: string;
}

export interface Cet6ExamSpec {
  /** 规范版本稳定 ID（V13 Phase 2B：考试结构可以 versioned，改革时新增版本而非破坏旧 Paper）。 */
  examSpecId: string;
  exam: "CET6";
  level: "CET6";
  source: string;
  rightsStatus: "official_public_material";
  totalTimeMinutes: number;
  sections: Cet6ExamSectionSpec[];
  /** 听力小节（含当前官方结构题量与占比：长对话 8 题 8% / 篇章 7 题 7% / 讲话·报道·讲座 10 题 20%）。 */
  listeningSubsections: Cet6ListeningSubsectionSpec[];
  /** 阅读小节（含题量与占比：选词填空 10 题 5% / 长篇阅读 10 题 10% / 仔细阅读 10 题 20%）。 */
  readingSubsections: Cet6ReadingSubsectionSpec[];
}

/**
 * CET6 官方公开考试结构（结构信息，非真题内容）。
 * 依据：https://cet.neea.edu.cn/xhtml1/report/16123/201-1.htm（考核内容）
 *      https://cet.neea.edu.cn/xhtml1/folder/16113/1586-1.htm（考试大纲）
 * Listening 当前官方结构（25 题 / 30 分钟 / 35%）：
 *   长对话 8 题（8%）→ 听力篇章 7 题（7%）→ 讲话/报道/讲座 10 题（20%）。
 * 禁止重新引入旧结构（short conversations / 8+2 对话 / 3 passages）。
 */
export const CET6_EXAM_SPEC: Cet6ExamSpec = {
  examSpecId: "cet6-current-2026",
  exam: "CET6",
  level: "CET6",
  source: "https://cet.neea.edu.cn/ (CET6 考试结构公开说明)",
  rightsStatus: "official_public_material",
  totalTimeMinutes: 130,
  sections: [
    { kind: "writing", name: "Writing", questionCount: 1, timeMinutes: 30, scoreRatio: "15%" },
    { kind: "listening", name: "Listening Comprehension", questionCount: 25, timeMinutes: 30, scoreRatio: "35%" },
    { kind: "reading", name: "Reading Comprehension", questionCount: 30, timeMinutes: 40, scoreRatio: "35%" },
    { kind: "translation", name: "Translation (C-E)", questionCount: 1, timeMinutes: 30, scoreRatio: "15%" },
  ],
  listeningSubsections: [
    { kind: "long_conversation", name: "Long Conversation", questionCount: 8, scoreRatio: "8%" },
    { kind: "passage", name: "Passage", questionCount: 7, scoreRatio: "7%" },
    { kind: "lecture", name: "Speech / Report / Lecture", questionCount: 10, scoreRatio: "20%" },
  ],
  readingSubsections: [
    { kind: "cloze", name: "Vocabulary Comprehension / Cloze", questionCount: 10, scoreRatio: "5%" },
    { kind: "matching", name: "Long Reading / Matching", questionCount: 10, scoreRatio: "10%" },
    { kind: "careful_reading", name: "Careful Reading", questionCount: 10, scoreRatio: "20%" },
  ],
};

/**
 * 已知 examSpecId 显式历史列表（V13 Phase 2B.1：旧 Paper 必须冻结绑定旧 spec）。
 * 未来官方改革新增版本时在此追加（如 "cet6-current-2027"），禁止删除历史条目 ——
 * 这样即使 CET6_EXAM_SPEC.examSpecId（current）改变，旧绑定仍保持 known，不被新结构重新解释。
 */
export const KNOWN_EXAM_SPEC_IDS: readonly string[] = [
  "cet6-current-2026",
  // 未来新版本在此追加
];

/** 校验 examSpecId 是否已知（未知 → false；缺省 = 当前 spec）。 */
export function isKnownExamSpecId(id: string | undefined): boolean {
  if (!id) return true; // 缺省 = 当前 spec（current）
  return KNOWN_EXAM_SPEC_IDS.includes(id);
}

/** 供 validator 使用：某 section 允许的 subsection kind。 */
export function allowedSubsections(kind: string): string[] {
  if (kind === "listening") return CET6_EXAM_SPEC.listeningSubsections.map((s) => s.kind);
  if (kind === "reading") return CET6_EXAM_SPEC.readingSubsections.map((s) => s.kind);
  return [];
}
