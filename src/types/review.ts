// V9 Review System 2.0 — 统一错题/复习数据模型
// 词汇掌握状态复用 V4 的 MasteryStatus；本文件只新增"错题"维度。

export type ReviewMastery =
  | "new"
  | "weak" // 二次仍错，自动收录
  | "reviewing" // 复测答对 / 复习答对
  | "mastered";

export type ReviewResult =
  | "first_try_correct"
  | "second_try_correct"
  | "wrong"
  | "unmastered"
  | "review_correct";

export type ReviewSourceModule = "vocabulary" | "reading" | "listening";
export type ReviewContentType = "question" | "word";
export type ReviewSessionMode = "daily" | "manual" | "end_of_day" | "word";
export type ReviewHistorySource =
  | "daily_plan"
  | "manual"
  | "end_of_day"
  | "specialty"
  | "word";

export interface ReviewHistoryEntry {
  reviewedAt: string; // ISO
  result: ReviewResult;
  previousStatus: ReviewMastery;
  newStatus: ReviewMastery;
  nextReviewAt: string;
  source: ReviewHistorySource;
}

export interface ReviewItem {
  id: string; // `${sourceModule}:${sourceActivityId}:${questionId}` 或 `word:${wordId}`
  contentType: ReviewContentType;
  sourceModule: ReviewSourceModule;
  sourceActivityId: string; // 哪篇阅读/听力/词集
  questionId: string;
  createdAt: string; // date string
  updatedAt: string;
  lastReviewedAt?: string;
  nextReviewAt: string; // date string
  masteryStatus: ReviewMastery;
  reviewCount: number;
  correctStreak: number;
  wrongCount: number;
  priority: number; // 0=最高
  favorite: boolean;
  removed: boolean;
  /** word 类型：来源合并 */
  sources?: ReviewSourceModule[];
  /** minimal snapshot：用户上次答错的选项 id，用于复习回放时标注"你的作答"；旧数据可缺省 */
  lastWrongOptionId?: string;
  history: ReviewHistoryEntry[];
  schemaVersion: 1;
}

export interface ReviewSession {
  id: string;
  date: string;
  mode: ReviewSessionMode;
  itemIds: string[];
  currentIndex: number;
  answers: Record<string, { correct: boolean; result: ReviewResult }>;
  startedAt: string;
  completedAt?: string;
  source: ReviewHistorySource;
  applied: boolean;
  rewardXp: number;
}

export interface ReviewStore {
  schemaVersion: 1;
  items: Record<string, ReviewItem>;
  sessions: Record<string, ReviewSession>;
  /** review:<date>:<itemId> -> xp 防重复 */
  xpLedger: Record<string, number>;
}
