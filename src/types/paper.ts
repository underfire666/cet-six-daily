/**
 * V13 Phase 2E: Paper Session domain types.
 *
 * PaperSession 表示一次完整的 CET6 模拟考试/整卷学习 attempt。
 * 复用 V12 LearningSession 表（module="paper", activityId=paperId, payload=完整状态），
 * 不新建 Prisma 表，不新建平行数据体系。
 *
 * 身份与幂等：
 * - sessionId 是 client-generated UUID，一次 attempt 一个。
 * - 同一 paperId 可以有多个 attempt（已完成 + 进行中）。
 * - 未完成 attempt 可以 resume；completed attempt 不能被新 resume 静默覆盖。
 * - answers 使用 questionId 绑定，不使用数组 index。
 */

import type { PaperSectionKind } from "@/content/papers";

/** Paper attempt 阶段。 */
export type PaperPhase =
  | "not_started"
  | "in_progress"
  | "submitted"
  | "completed";

/** Section 完成状态。 */
export type PaperSectionStatus = "pending" | "in_progress" | "completed";

/** 单题答题记录。客观题存 selectedOptionId；主观题存 draft/submittedText。 */
export interface PaperAnswerRecord {
  questionId: string;
  /** 客观题：用户选择的 option id。 */
  selectedOptionId?: string;
  /** 主观题：草稿文本（未提交）。 */
  draft?: string;
  /** 主观题：已提交文本。 */
  submittedText?: string;
  /** 主观题提交时间。 */
  submittedAt?: string;
  /** 答题时间（ISO）。 */
  answeredAt?: string;
}

/** Section 进度快照。 */
export interface PaperSectionProgress {
  sectionId: string;
  type: PaperSectionKind;
  status: PaperSectionStatus;
  /** 当前 group index（0-based）。 */
  currentGroupIndex: number;
  /** 当前 question index within group（0-based）。 */
  currentQuestionIndex: number;
  /** 已答题数量。 */
  answeredCount: number;
  /** 该 section 总题数。 */
  totalQuestions: number;
  /** section 完成时间（ISO）。 */
  completedAt?: string;
}

/** Paper 结果快照（提交后计算，不伪造 710 分）。 */
export interface PaperResultSnapshot {
  /** 客观题总正确率（0-100）。 */
  overallAccuracy: number;
  /** Listening 正确率（0-100）。 */
  listeningAccuracy: number;
  /** Reading 正确率（0-100）。 */
  readingAccuracy: number;
  /** Writing 状态（已提交/未提交）。 */
  writingStatus: "submitted" | "not_submitted";
  /** Translation 状态。 */
  translationStatus: "submitted" | "not_submitted";
  /** 错题数量（客观题答错数）。 */
  wrongCount: number;
  /** 需要加强数量（错题 + 未掌握）。 */
  needsReviewCount: number;
  /** 总题数。 */
  totalQuestions: number;
  /** 已答题数。 */
  answeredQuestions: number;
  /** 完成时间（ISO）。 */
  completedAt: string;
  /** 总时长（秒）。 */
  durationSec: number;
  /** 明确标注：练习估分 / 非官方成绩。不伪造 710 分。 */
  scoreDisclaimer: string;
}

/** 完整 PaperSession 状态（存储在 localStorage + LearningSession.payload）。 */
export interface PaperSessionState {
  schemaVersion: 1;
  /** client-generated UUID。 */
  sessionId: string;
  /** Paper stable ID，如 cet6:mock:paper-001。 */
  paperId: string;
  /** Paper contentVersion，用于检测内容变更。 */
  paperContentVersion: string;
  /** 绑定的 examSpecId。 */
  examSpecId: string;
  /** 用户命名空间：guest 或 userId。用于多用户隔离。 */
  ownerNamespace: string;
  phase: PaperPhase;
  startedAt: string;
  updatedAt: string;
  completedAt?: string;
  /** 当前 section index（0-based）。 */
  currentSectionIndex: number;
  /** 当前 group index within section（0-based）。 */
  currentGroupIndex: number;
  /** 当前 question index within group（0-based）。 */
  currentQuestionIndex: number;
  /** 所有答题记录，key = questionId。 */
  answers: Record<string, PaperAnswerRecord>;
  /** 各 section 进度。 */
  sectionProgress: PaperSectionProgress[];
  /** 提交后的结果快照。 */
  result?: PaperResultSnapshot;
  /** 本次 attempt 是否已结算 XP（幂等）。 */
  xpSettled: boolean;
  /** 本次 attempt 是否已创建 Review items（幂等）。 */
  reviewSettled: boolean;
  /** 末尾复测已记录的 questionId（每题每天最多一次）。 */
  endOfDayRetestDone: string[];
  /** 元数据备注。 */
  notes?: string;
}

/** 创建新 PaperSession 所需参数。 */
export interface CreatePaperSessionParams {
  sessionId: string;
  paperId: string;
  paperContentVersion: string;
  examSpecId: string;
  ownerNamespace: string;
  now: string;
  sectionIds: { sectionId: string; type: PaperSectionKind; totalQuestions: number }[];
}

/** PaperSession action（reducer 输入）。 */
export type PaperSessionAction =
  | { type: "select_answer"; questionId: string; optionId: string; now: string }
  | { type: "set_subjective_draft"; questionId: string; draft: string; now: string }
  | { type: "submit_subjective"; questionId: string; text: string; now: string }
  | { type: "navigate"; sectionIndex: number; groupIndex: number; questionIndex: number; now: string }
  | { type: "complete_section"; sectionId: string; now: string }
  | { type: "submit_paper"; result: PaperResultSnapshot; now: string }
  | { type: "mark_xp_settled"; now: string }
  | { type: "mark_review_settled"; now: string }
  | { type: "record_end_of_day_retest"; questionId: string; now: string };
