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

export interface Cet6ExamSpec {
  exam: "CET6";
  level: "CET6";
  source: string;
  rightsStatus: "official_public_material";
  totalTimeMinutes: number;
  sections: Cet6ExamSectionSpec[];
  /** 听力小节（公开结构信息）。 */
  listeningSubsections: { kind: string; name: string }[];
  /** 阅读小节（公开结构信息）。 */
  readingSubsections: { kind: string; name: string }[];
}

/** CET6 官方公开考试结构（结构信息，非真题内容）。 */
export const CET6_EXAM_SPEC: Cet6ExamSpec = {
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
    { kind: "long_conversation", name: "Long Conversation" },
    { kind: "passage", name: "Passage" },
    { kind: "lecture", name: "Speech / Report / Lecture" },
  ],
  readingSubsections: [
    { kind: "cloze", name: "Vocabulary Comprehension / Cloze" },
    { kind: "matching", name: "Long Reading / Matching" },
    { kind: "careful_reading", name: "Careful Reading" },
  ],
};

/** 供 validator 使用：某 section 允许的 subsection kind。 */
export function allowedSubsections(kind: string): string[] {
  if (kind === "listening") return CET6_EXAM_SPEC.listeningSubsections.map((s) => s.kind);
  if (kind === "reading") return CET6_EXAM_SPEC.readingSubsections.map((s) => s.kind);
  return [];
}
