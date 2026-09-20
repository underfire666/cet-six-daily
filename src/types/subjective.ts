/**
 * V7 翻译 / 写作共用的主观题批改结果结构。
 * 当前 provider 固定为 "mock"；V8 接真实 AI 时只需替换生成端，前端结果页不用改。
 */
export type SubjectiveIssueType =
  | "vocabulary"
  | "structure"
  | "grammar"
  | "coverage"
  | "coherence";

export interface SubjectiveIssue {
  type: SubjectiveIssueType;
  title: string;
  description: string;
  severity: "minor" | "major";
}

export interface SubjectiveFeedbackDetail {
  /** 原文片段 / 题面片段 */
  excerpt?: string;
  /** 用户自己写的表达 */
  userExpression?: string;
  /** 参考表达 */
  referenceExpression?: string;
  /** 说明 */
  note?: string;
}

export interface SubjectiveFeedback {
  /** 0–maxScore */
  score: number;
  maxScore: number;
  /** 一句话总结 */
  summary: string;
  /** 主要问题，2–3 条 */
  issues: SubjectiveIssue[];
  /** 展开后的详细分析 */
  details: SubjectiveFeedbackDetail[];
  provider: "mock";
  createdAt: string;
}

export type SubjectiveSessionMode = "daily" | "extra";
