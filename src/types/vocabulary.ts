import type { LessonSession } from "./session";
import type { LessonDefinition } from "./question";

export type WordSource = "vocabulary" | "reading" | "listening";
export type MasteryStatus =
  | "new"
  | "learning"
  | "weak"
  | "reviewing"
  | "mastered";
export type VocabularyQuestionType = "en_to_zh" | "zh_to_en" | "sentence_blank";
export type VocabularySessionMode =
  | "learn"
  | "extra"
  | "due_review"
  | "wordbook_review"
  | "single_review";

export interface Word {
  id: string;
  word: string;
  phonetic: string;
  partOfSpeech: string;
  meaning: string;
  secondaryMeanings: string[];
  example: string;
  exampleTranslation: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
  audio?: string;
  tags: string[];
  source: WordSource;
  createdAt: string;
}

export interface UserVocabularyState {
  wordId: string;
  masteryStatus: MasteryStatus;
  selfReportedUnknown: boolean;
  needsReview: boolean;
  firstSeenAt: string;
  lastReviewedAt?: string;
  nextReviewAt?: string;
  reviewCount: number;
  correctCount: number;
  wrongCount: number;
  consecutiveCorrect: number;
  lastIndependentAt?: string;
  independentTypes: VocabularyQuestionType[];
  addedToWordbook: boolean;
  source: WordSource;
}

export interface DailyVocabularyProgress {
  date: string;
  wordIds: string[];
  completedWordIds: string[];
  activeSessionId?: string;
}

export interface VocabularySession {
  schemaVersion: 1;
  id: string;
  mode: VocabularySessionMode;
  date: string;
  wordIds: string[];
  definition: LessonDefinition;
  cardIndex: number;
  questionTypes: Record<string, VocabularyQuestionType>;
  phase: "card" | "quiz" | "complete";
  selfReports: Record<string, "known" | "unknown">;
  lesson: LessonSession;
  rewardXp?: number;
  applied: boolean;
  batchId?: string;
  completedAt?: string;
}

export interface ExtraVocabularyBatch {
  id: string;
  target: number;
  createdAt: string;
  sessionIds: string[];
}

export interface VocabularyStore {
  schemaVersion: 1 | 2;
  states: Record<string, UserVocabularyState>;
  daily: Record<string, DailyVocabularyProgress>;
  sessions: Record<string, VocabularySession>;
  xpLedger: Record<string, number>;
  batches: Record<string, ExtraVocabularyBatch>;
}

export interface VocabularySettings {
  dailyNewWords: number;
  sessionWords: number;
}
