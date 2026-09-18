import type { AnswerRecord } from "@/types/session";
import type {
  UserVocabularyState,
  VocabularyQuestionType,
  Word,
} from "@/types/vocabulary";
import { scheduleReview } from "./reviewScheduler";
const DAY = 86_400_000;
export function newVocabularyState(
  word: Word,
  now: string,
): UserVocabularyState {
  return {
    wordId: word.id,
    masteryStatus: "new",
    selfReportedUnknown: false,
    needsReview: false,
    firstSeenAt: now,
    reviewCount: 0,
    correctCount: 0,
    wrongCount: 0,
    consecutiveCorrect: 0,
    independentTypes: [],
    addedToWordbook: false,
    source: word.source,
  };
}
export function markSelfReport(
  state: UserVocabularyState,
  unknown: boolean,
  now: string,
): UserVocabularyState {
  const next: UserVocabularyState = {
    ...state,
    selfReportedUnknown: unknown,
    masteryStatus: unknown
      ? "weak"
      : state.masteryStatus === "new"
        ? "learning"
        : state.masteryStatus,
    needsReview: true,
    ...(unknown ? { consecutiveCorrect: 0, independentTypes: [] } : {}),
  };
  return {
    ...next,
    nextReviewAt:
      !unknown && state.nextReviewAt
        ? state.nextReviewAt
        : scheduleReview(next, now),
  };
}
export function applyVocabularyResult(
  state: UserVocabularyState,
  record: AnswerRecord,
  type: VocabularyQuestionType,
  now: string,
  isReview: boolean,
): UserVocabularyState {
  const independent = record.initialResult === "first_try_correct";
  const mistakes = [...record.initial, ...record.retest].filter(
    (a) => !a.correct,
  ).length;
  const correct = [...record.initial, ...record.retest].filter(
    (a) => a.correct,
  ).length;
  const spaced =
    isReview &&
    !!state.lastReviewedAt &&
    Date.parse(now) - Date.parse(state.lastReviewedAt) >= DAY;
  const qualifies = independent && spaced;
  const consecutiveCorrect =
    mistakes || !independent
      ? 0
      : qualifies
        ? state.consecutiveCorrect + 1
        : state.consecutiveCorrect;
  const independentTypes =
    mistakes || !independent
      ? []
      : qualifies
        ? [...new Set([...state.independentTypes, type])]
        : state.independentTypes;
  let masteryStatus = state.masteryStatus;
  if (mistakes || !independent || (!isReview && state.selfReportedUnknown))
    masteryStatus = "weak";
  else if (qualifies)
    masteryStatus =
      consecutiveCorrect >= 3 && independentTypes.length === 3
        ? "mastered"
        : "reviewing";
  else if (state.masteryStatus === "new") masteryStatus = "learning";
  const next: UserVocabularyState = {
    ...state,
    masteryStatus,
    needsReview: true,
    lastReviewedAt: now,
    reviewCount: state.reviewCount + (isReview ? 1 : 0),
    correctCount: state.correctCount + correct,
    wrongCount: state.wrongCount + mistakes,
    consecutiveCorrect,
    independentTypes,
    ...(qualifies ? { lastIndependentAt: now } : {}),
  };
  // Extra immediate practice cannot postpone a pending scheduled review.
  const reschedule =
    !state.nextReviewAt ||
    Date.parse(state.nextReviewAt) <= Date.parse(now) ||
    mistakes ||
    !independent ||
    qualifies ||
    !isReview;
  return {
    ...next,
    nextReviewAt: reschedule ? scheduleReview(next, now) : state.nextReviewAt,
  };
}
