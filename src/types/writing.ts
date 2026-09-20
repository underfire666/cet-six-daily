import type {
  SubjectiveFeedback,
  SubjectiveSessionMode,
} from "./subjective";

export type WritingLevel = "paragraph" | "essay";

export interface WritingOutlineBlock {
  type: "introduction" | "body" | "conclusion";
  content: string;
}

export interface WritingTask {
  id: string;
  title: string;
  level: WritingLevel;
  /** Directions 题面（英文） */
  prompt: string;
  requirements: string[];
  /** 建议用到的词 / 连接词 */
  suggestedWords: string[];
  /** 参考范文（提交前不展示） */
  referenceEssay: string;
  outline: WritingOutlineBlock[];
  scoringPoints: string[];
  mockFeedback: {
    summary: string;
    issues: {
      type: "vocabulary" | "structure" | "grammar" | "coherence";
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
  /** 建议词数范围 */
  suggestedWordsRange: [number, number];
  sourceType: "mock";
}

export interface WritingDailyProgress {
  date: string;
  taskIds: string[];
  completedTaskIds: string[];
  activeSessionId?: string;
}

export interface WritingHistoryEntry {
  taskId: string;
  submittedText: string;
  feedback: SubjectiveFeedback;
  score: number;
  wordCount: number;
  createdAt: string;
}

export interface WritingSession {
  schemaVersion: 1;
  id: string;
  mode: SubjectiveSessionMode;
  planDate: string;
  taskId: string;
  phase: "drafting" | "reviewing" | "complete";
  draft: string;
  submittedText?: string;
  wordCount?: number;
  feedback?: SubjectiveFeedback;
  startedAt: string;
  submittedAt?: string;
  completedAt?: string;
  applied: boolean;
  rewardXp?: number;
}

export interface WritingStore {
  schemaVersion: 1;
  daily: Record<string, WritingDailyProgress>;
  sessions: Record<string, WritingSession>;
  history: WritingHistoryEntry[];
  xpLedger: Record<string, number>;
}
