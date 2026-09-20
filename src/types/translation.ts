import type {
  SubjectiveFeedback,
  SubjectiveSessionMode,
} from "./subjective";

export type TranslationLevel = "sentence" | "paragraph";

export interface TranslationTask {
  id: string;
  title: string;
  level: TranslationLevel;
  /** 中文原文，用户据此译成英文 */
  promptChinese: string;
  /** 关键词 / 关键表达，Mock 批改据此判分 */
  keywords: string[];
  /** 参考译文（提交前不展示） */
  referenceTranslation: string;
  /** 评分要点（人读用） */
  scoringPoints: string[];
  /** 预置 Mock 反馈，未命中关键词时拼装 */
  mockFeedback: {
    summary: string;
    issues: {
      type: "vocabulary" | "structure" | "grammar" | "coverage";
      title: string;
      description: string;
      severity: "minor" | "major";
    }[];
    details: {
      excerpt: string;
      userExpression: string;
      referenceExpression: string;
      note: string;
    }[];
  };
  estimatedMinutes: number;
  sourceType: "mock";
}

export interface TranslationDailyProgress {
  date: string;
  taskIds: string[];
  completedTaskIds: string[];
  activeSessionId?: string;
}

export interface TranslationHistoryEntry {
  taskId: string;
  submittedText: string;
  feedback: SubjectiveFeedback;
  score: number;
  createdAt: string;
}

export interface TranslationSession {
  schemaVersion: 1;
  id: string;
  mode: SubjectiveSessionMode;
  planDate: string;
  taskId: string;
  phase: "drafting" | "reviewing" | "complete";
  /** 草稿自动保存 */
  draft: string;
  submittedText?: string;
  feedback?: SubjectiveFeedback;
  startedAt: string;
  submittedAt?: string;
  completedAt?: string;
  applied: boolean;
  rewardXp?: number;
}

export interface TranslationStore {
  schemaVersion: 1;
  daily: Record<string, TranslationDailyProgress>;
  sessions: Record<string, TranslationSession>;
  history: TranslationHistoryEntry[];
  xpLedger: Record<string, number>;
}
