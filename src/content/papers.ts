/**
 * V10 ExamPaper 数据结构（仅 schema，不导入真实试卷）。
 * sections 引用 content IDs，不复制内容。
 */
export type PaperSectionKind = "writing" | "listening" | "reading" | "translation";

export interface PaperSection {
  kind: PaperSectionKind;
  /** 引用的内容 ID 列表（writing task id / listening material id / reading article id / translation task id）。 */
  itemIds: string[];
}

export interface ExamPaper {
  id: string;
  examType: "CET6";
  year: number;
  month: 6 | 12;
  set: number;
  sections: PaperSection[];
  sourceId: string;
  version: string;
  status: "draft" | "active" | "deprecated";
  /** 内容诚信：必须明确 past_exam 才允许标真题。 */
  authenticity: "original" | "practice" | "past_exam";
}

export function validatePaper(paper: ExamPaper): string[] {
  const errors: string[] = [];
  if (!paper.id) errors.push("paper missing id");
  if (!paper.year || paper.year < 2000) errors.push(`paper ${paper.id} bad year`);
  if (![6, 12].includes(paper.month)) errors.push(`paper ${paper.id} bad month`);
  if (!paper.sections || paper.sections.length === 0) errors.push(`paper ${paper.id} no sections`);
  return errors;
}
