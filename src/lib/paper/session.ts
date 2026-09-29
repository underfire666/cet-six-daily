/**
 * V13 Phase 2E: PaperSession domain logic.
 *
 * 纯函数 reducer，不依赖 React / localStorage / sync。
 * 所有状态变更通过 reducePaperSession 处理，保证可测试、可回放。
 */

import type {
  CreatePaperSessionParams,
  PaperAnswerRecord,
  PaperResultSnapshot,
  PaperSessionAction,
  PaperSessionState,
} from "@/types/paper";

/** 创建新 PaperSession。 */
export function createPaperSession(params: CreatePaperSessionParams): PaperSessionState {
  return {
    schemaVersion: 1,
    sessionId: params.sessionId,
    paperId: params.paperId,
    paperContentVersion: params.paperContentVersion,
    examSpecId: params.examSpecId,
    ownerNamespace: params.ownerNamespace,
    phase: "in_progress",
    startedAt: params.now,
    updatedAt: params.now,
    currentSectionIndex: 0,
    currentGroupIndex: 0,
    currentQuestionIndex: 0,
    answers: {},
    sectionProgress: params.sectionIds.map((s) => ({
      sectionId: s.sectionId,
      type: s.type,
      status: "pending",
      currentGroupIndex: 0,
      currentQuestionIndex: 0,
      answeredCount: 0,
      totalQuestions: s.totalQuestions,
    })),
    xpSettled: false,
    reviewSettled: false,
    endOfDayRetestDone: [],
  };
}

/** 计算某 section 已答题数量。 */
function countAnsweredInSection(
  answers: Record<string, PaperAnswerRecord>,
  questionIds: string[],
): number {
  return questionIds.filter((id) => {
    const r = answers[id];
    if (!r) return false;
    return Boolean(r.selectedOptionId || r.submittedText || r.submittedText);
  }).length;
}

/** 更新 section progress 中的 answeredCount。 */
function refreshSectionProgress(
  state: PaperSessionState,
  sectionQuestionIds: Record<string, string[]>,
): PaperSessionState {
  const sectionProgress = state.sectionProgress.map((sp) => {
    const qids = sectionQuestionIds[sp.sectionId] ?? [];
    const answeredCount = countAnsweredInSection(state.answers, qids);
    return { ...sp, answeredCount };
  });
  return { ...state, sectionProgress };
}

/**
 * PaperSession reducer。
 * 已完成（phase=completed）的 session 只允许 mark_xp_settled / mark_review_settled / record_end_of_day_retest，
 * 不允许修改答案或导航——防止已完成 attempt 被静默覆盖。
 */
export function reducePaperSession(
  state: PaperSessionState,
  action: PaperSessionAction,
  sectionQuestionIds: Record<string, string[]>,
): PaperSessionState {
  // 已完成 session 只允许结算类 action
  if (state.phase === "completed") {
    switch (action.type) {
      case "mark_xp_settled":
        return { ...state, xpSettled: true, updatedAt: action.now };
      case "mark_review_settled":
        return { ...state, reviewSettled: true, updatedAt: action.now };
      case "record_end_of_day_retest":
        if (state.endOfDayRetestDone.includes(action.questionId)) return state;
        return {
          ...state,
          endOfDayRetestDone: [...state.endOfDayRetestDone, action.questionId],
          updatedAt: action.now,
        };
      default:
        return state;
    }
  }

  // 已提交但未完成（phase=submitted）不允许修改答案
  if (state.phase === "submitted") {
    switch (action.type) {
      case "mark_xp_settled":
        return { ...state, xpSettled: true, updatedAt: action.now };
      case "mark_review_settled":
        return { ...state, reviewSettled: true, updatedAt: action.now };
      case "record_end_of_day_retest":
        if (state.endOfDayRetestDone.includes(action.questionId)) return state;
        return {
          ...state,
          endOfDayRetestDone: [...state.endOfDayRetestDone, action.questionId],
          updatedAt: action.now,
        };
      default:
        return state;
    }
  }

  switch (action.type) {
    case "select_answer": {
      const existing = state.answers[action.questionId] ?? { questionId: action.questionId };
      const updated: PaperAnswerRecord = {
        ...existing,
        questionId: action.questionId,
        selectedOptionId: action.optionId,
        answeredAt: action.now,
      };
      const next = {
        ...state,
        answers: { ...state.answers, [action.questionId]: updated },
        updatedAt: action.now,
      };
      return refreshSectionProgress(next, sectionQuestionIds);
    }

    case "set_subjective_draft": {
      const existing = state.answers[action.questionId] ?? { questionId: action.questionId };
      const updated: PaperAnswerRecord = {
        ...existing,
        questionId: action.questionId,
        draft: action.draft,
      };
      return {
        ...state,
        answers: { ...state.answers, [action.questionId]: updated },
        updatedAt: action.now,
      };
    }

    case "submit_subjective": {
      const existing = state.answers[action.questionId] ?? { questionId: action.questionId };
      const updated: PaperAnswerRecord = {
        ...existing,
        questionId: action.questionId,
        submittedText: action.text,
        submittedAt: action.now,
        answeredAt: action.now,
      };
      const next = {
        ...state,
        answers: { ...state.answers, [action.questionId]: updated },
        updatedAt: action.now,
      };
      return refreshSectionProgress(next, sectionQuestionIds);
    }

    case "navigate": {
      const sectionProgress = state.sectionProgress.map((sp, idx) => {
        if (idx !== action.sectionIndex) return sp;
        return {
          ...sp,
          status: "in_progress" as const,
          currentGroupIndex: action.groupIndex,
          currentQuestionIndex: action.questionIndex,
        };
      });
      return {
        ...state,
        currentSectionIndex: action.sectionIndex,
        currentGroupIndex: action.groupIndex,
        currentQuestionIndex: action.questionIndex,
        sectionProgress,
        updatedAt: action.now,
      };
    }

    case "complete_section": {
      const sectionProgress = state.sectionProgress.map((sp) => {
        if (sp.sectionId !== action.sectionId) return sp;
        return { ...sp, status: "completed" as const, completedAt: action.now };
      });
      return { ...state, sectionProgress, updatedAt: action.now };
    }

    case "submit_paper": {
      return {
        ...state,
        phase: "completed",
        result: action.result,
        completedAt: action.now,
        updatedAt: action.now,
      };
    }

    case "mark_xp_settled":
      return { ...state, xpSettled: true, updatedAt: action.now };

    case "mark_review_settled":
      return { ...state, reviewSettled: true, updatedAt: action.now };

    case "record_end_of_day_retest":
      if (state.endOfDayRetestDone.includes(action.questionId)) return state;
      return {
        ...state,
        endOfDayRetestDone: [...state.endOfDayRetestDone, action.questionId],
        updatedAt: action.now,
      };

    default:
      return state;
  }
}

/** 计算总体进度（0-100）。 */
export function paperOverallProgress(state: PaperSessionState): number {
  const total = state.sectionProgress.reduce((sum, sp) => sum + sp.totalQuestions, 0);
  const answered = state.sectionProgress.reduce((sum, sp) => sum + sp.answeredCount, 0);
  if (total === 0) return 0;
  return Math.round((answered / total) * 100);
}

/** 判断是否所有 section 都已完成（满足 completion rule）。 */
export function isPaperCompletable(
  state: PaperSessionState,
  sectionQuestionIds: Record<string, string[]>,
): boolean {
  for (const sp of state.sectionProgress) {
    const qids = sectionQuestionIds[sp.sectionId] ?? [];
    const answered = countAnsweredInSection(state.answers, qids);
    // Writing/Translation 只需要 1 题提交；客观题 section 需要全部答完
    if (sp.type === "writing" || sp.type === "translation") {
      if (answered < sp.totalQuestions) return false;
    } else {
      if (answered < sp.totalQuestions) return false;
    }
  }
  return true;
}

/** 计算 Paper 结果快照（不伪造 710 分）。 */
export function calculatePaperResult(
  state: PaperSessionState,
  questionIdToCorrect: Record<string, string | undefined>,
  sectionQuestionIds: Record<string, string[]>,
  now: string,
): PaperResultSnapshot {
  let listeningCorrect = 0;
  let listeningTotal = 0;
  let readingCorrect = 0;
  let readingTotal = 0;
  let objectiveCorrect = 0;
  let objectiveTotal = 0;
  let wrongCount = 0;

  for (const sp of state.sectionProgress) {
    const qids = sectionQuestionIds[sp.sectionId] ?? [];
    for (const qid of qids) {
      const answer = state.answers[qid];
      const correctId = questionIdToCorrect[qid];
      if (!correctId) continue; // 主观题不计入客观正确率
      objectiveTotal++;
      if (sp.type === "listening") listeningTotal++;
      if (sp.type === "reading") readingTotal++;
      if (answer?.selectedOptionId === correctId) {
        objectiveCorrect++;
        if (sp.type === "listening") listeningCorrect++;
        if (sp.type === "reading") readingCorrect++;
      } else {
        wrongCount++;
      }
    }
  }

  const writingSection = state.sectionProgress.find((sp) => sp.type === "writing");
  const translationSection = state.sectionProgress.find((sp) => sp.type === "translation");
  const writingQids = writingSection ? sectionQuestionIds[writingSection.sectionId] ?? [] : [];
  const translationQids = translationSection ? sectionQuestionIds[translationSection.sectionId] ?? [] : [];

  const writingSubmitted = writingQids.some((qid) => state.answers[qid]?.submittedText);
  const translationSubmitted = translationQids.some((qid) => state.answers[qid]?.submittedText);

  const started = Date.parse(state.startedAt);
  const completed = Date.parse(now);
  const durationSec = Math.max(0, Math.round((completed - started) / 1000));

  return {
    overallAccuracy: objectiveTotal > 0 ? Math.round((objectiveCorrect / objectiveTotal) * 100) : 0,
    listeningAccuracy: listeningTotal > 0 ? Math.round((listeningCorrect / listeningTotal) * 100) : 0,
    readingAccuracy: readingTotal > 0 ? Math.round((readingCorrect / readingTotal) * 100) : 0,
    writingStatus: writingSubmitted ? "submitted" : "not_submitted",
    translationStatus: translationSubmitted ? "submitted" : "not_submitted",
    wrongCount,
    needsReviewCount: wrongCount,
    totalQuestions: objectiveTotal + writingQids.length + translationQids.length,
    answeredQuestions: objectiveCorrect + wrongCount + (writingSubmitted ? 1 : 0) + (translationSubmitted ? 1 : 0),
    completedAt: now,
    durationSec,
    scoreDisclaimer: "练习估分 / 非官方 CET6 成绩。本结果仅用于学习反馈，不代表官方 710 分制等值分。",
  };
}

/** 获取错题列表（客观题答错的 questionId）。 */
export function getWrongQuestionIds(
  state: PaperSessionState,
  questionIdToCorrect: Record<string, string | undefined>,
): string[] {
  const wrong: string[] = [];
  for (const [qid, answer] of Object.entries(state.answers)) {
    const correctId = questionIdToCorrect[qid];
    if (!correctId) continue;
    if (answer.selectedOptionId && answer.selectedOptionId !== correctId) {
      wrong.push(qid);
    }
  }
  return wrong;
}

/** 校验 PaperSession 合法性（用于存储恢复时过滤坏记录）。 */
export function isValidPaperSession(v: unknown): v is PaperSessionState {
  if (!v || typeof v !== "object") return false;
  const s = v as Record<string, unknown>;
  if (s.schemaVersion !== 1) return false;
  if (typeof s.sessionId !== "string" || !s.sessionId) return false;
  if (typeof s.paperId !== "string" || !s.paperId) return false;
  if (typeof s.paperContentVersion !== "string") return false;
  if (typeof s.examSpecId !== "string") return false;
  if (typeof s.ownerNamespace !== "string") return false;
  if (!["not_started", "in_progress", "submitted", "completed"].includes(String(s.phase))) return false;
  if (typeof s.startedAt !== "string") return false;
  if (typeof s.updatedAt !== "string") return false;
  if (typeof s.currentSectionIndex !== "number" || !Number.isInteger(s.currentSectionIndex) || s.currentSectionIndex < 0) return false;
  if (typeof s.currentGroupIndex !== "number" || !Number.isInteger(s.currentGroupIndex) || s.currentGroupIndex < 0) return false;
  if (typeof s.currentQuestionIndex !== "number" || !Number.isInteger(s.currentQuestionIndex) || s.currentQuestionIndex < 0) return false;
  if (!s.answers || typeof s.answers !== "object") return false;
  if (!Array.isArray(s.sectionProgress)) return false;
  if (typeof s.xpSettled !== "boolean") return false;
  if (typeof s.reviewSettled !== "boolean") return false;
  if (!Array.isArray(s.endOfDayRetestDone)) return false;
  return true;
}
