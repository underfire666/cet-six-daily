export type AnswerResult =
  | "first_try_correct"
  | "second_try_correct"
  | "ai_hint_correct"
  | "wrong"
  | "unmastered";
export interface Attempt {
  optionId: string;
  correct: boolean;
  hinted: boolean;
}
export interface AnswerRecord {
  initial: Attempt[];
  retest: Attempt[];
  hintUsed: boolean;
  usedAiHint?: boolean;
  initialResult?: AnswerResult;
  retestResult?: AnswerResult;
}
export type SessionMode = "daily" | "review";
export interface LessonSession {
  schemaVersion: 1;
  id: string;
  lessonId: string;
  lessonVersion: number;
  date: string;
  mode: SessionMode;
  round: "initial" | "retest";
  index: number;
  selected: string | null;
  phase: "answering" | "retry" | "feedback" | "review_intro" | "complete";
  records: Record<string, AnswerRecord>;
  retestQueue: string[];
  startedAt: string;
  completedAt?: string;
  completedDay?: string;
  reward?: { xp: number; streak: number; accuracy: number };
  celebrationSeen: boolean;
}
export interface FeedbackSettings {
  soundEnabled: boolean;
  hapticsEnabled: boolean;
  celebrationEnabled: boolean;
}
export interface StudyProfile {
  schemaVersion: 1;
  anchorDate: string;
  completedLessons: Record<string, string>;
  rewardsByDay: Record<string, { xp: number; sessionId: string }>;
  bonusXpEvents?: Record<string, number>;
}
export type SessionAction =
  | { type: "select"; optionId: string }
  | { type: "hint" }
  | { type: "check" }
  | { type: "continue"; now: string; today: string };
