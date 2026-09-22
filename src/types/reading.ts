import type { LessonSession } from "./session";

export type ReadingDifficulty = "easy" | "normal" | "hard";
export type ReadingSessionMode = "daily" | "extra";

export interface ReadingLookupEntry {
  word: string;
  phonetic: string;
  partOfSpeech: string;
  meaning: string;
  sentence: string;
  sentenceTranslation: string;
}

export interface PassageQuestion {
  id: string;
  prompt: string;
  options: { id: string; text: string }[];
  answerId: string;
  shortExplanation: string;
  detailedExplanation: string;
  hint: string;
  /** V10 证据定位（可选）：原文段落 / 句子定位，不强制 Mock 内容伪造 */
  evidence?: {
    paragraphId?: string;
    sentenceId?: string;
  };
}

export interface ReadingArticle {
  id: string;
  title: string;
  passage: string;
  difficulty: ReadingDifficulty;
  estimatedMinutes: number;
  questions: PassageQuestion[];
  /** key = 词在原文中的拼写形式（小写），value = 查词条目 */
  vocabulary: Record<string, ReadingLookupEntry>;
  sourceType: "mock";
}

export interface ReadingDailyProgress {
  date: string;
  articleIds: string[];
  completedArticleIds: string[];
  activeSessionId?: string;
}

export interface ReadingSession {
  schemaVersion: 1;
  id: string;
  mode: ReadingSessionMode;
  /** 每日任务的计划日；额外阅读为创建当日 */
  planDate: string;
  articleId: string;
  phase: "reading" | "quiz" | "complete";
  readingCompleted: boolean;
  /** 本篇文章内新加入统一生词本的词 id */
  collectedWordIds: string[];
  startedAt: string;
  completedAt?: string;
  applied: boolean;
  rewardXp?: number;
  /** 复用通用答题状态机 */
  lesson: LessonSession;
}

export interface ReadingStore {
  schemaVersion: 1;
  daily: Record<string, ReadingDailyProgress>;
  sessions: Record<string, ReadingSession>;
  xpLedger: Record<string, number>;
}
