import type { MasteryStatus, UserVocabularyState } from "@/types/vocabulary";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
export function reviewInterval(
  status: MasteryStatus,
  consecutiveCorrect: number,
) {
  if (status === "weak") return 4 * HOUR;
  if (status === "learning" || consecutiveCorrect === 0) return DAY;
  if (status === "mastered") return 30 * DAY;
  if (consecutiveCorrect === 1) return 3 * DAY;
  if (consecutiveCorrect === 2) return 7 * DAY;
  return 14 * DAY;
}
export function scheduleReview(
  state: Pick<UserVocabularyState, "masteryStatus" | "consecutiveCorrect">,
  now: string,
) {
  return new Date(
    Date.parse(now) +
      reviewInterval(state.masteryStatus, state.consecutiveCorrect),
  ).toISOString();
}
export function getWordsDueForReview(
  states: Record<string, UserVocabularyState>,
  now: string,
) {
  return Object.values(states)
    .filter(
      (state) =>
        state.needsReview &&
        !!state.nextReviewAt &&
        Date.parse(state.nextReviewAt) <= Date.parse(now),
    )
    .sort((a, b) => Date.parse(a.nextReviewAt!) - Date.parse(b.nextReviewAt!));
}
