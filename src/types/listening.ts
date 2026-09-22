import type { LessonSession } from "./session";

export type ListeningDifficulty = "easy" | "normal" | "hard";
export type ListeningKind = "sentence" | "dialogue" | "passage";
export type ListeningSessionMode = "daily" | "extra";
export type ListeningRate = 0.8 | 1.0;

/** Mock 材料使用随项目提供的本地音频；保留文本字段供重新生成。 */
export interface ListeningAudio {
  type: "mock-tts" | "file";
  /** mock-tts 时朗读这段文本 */
  text?: string;
  /** file / 未来 remote 时的地址 */
  src?: string;
  /** 估算时长（秒），仅用于展示，Mock 阶段不做精确进度 */
  duration?: number;
}

export interface ListeningLookupEntry {
  word: string;
  phonetic: string;
  partOfSpeech: string;
  meaning: string;
  sentence: string;
  sentenceTranslation: string;
}

export interface ListeningQuestion {
  id: string;
  prompt: string;
  options: { id: string; text: string }[];
  answerId: string;
  shortExplanation: string;
  detailedExplanation: string;
  hint: string;
  /** V10 证据定位（可选）：Transcript 段落 / 句子定位，不强制 Mock 内容伪造 */
  evidence?: {
    paragraphId?: string;
    sentenceId?: string;
  };
}

export interface ListeningMaterial {
  id: string;
  title: string;
  kind: ListeningKind;
  difficulty: ListeningDifficulty;
  estimatedMinutes: number;
  audio: ListeningAudio;
  transcript: string;
  /** Mock 数据预标的答案依据句，原文中轻量高亮 */
  keySentences: string[];
  questions: ListeningQuestion[];
  /** key = 词在原文中的拼写形式（小写），value = 查词条目 */
  vocabulary: Record<string, ListeningLookupEntry>;
  sourceType: "mock";
}

export interface ListeningDailyProgress {
  date: string;
  materialIds: string[];
  completedMaterialIds: string[];
  activeSessionId?: string;
}

export interface ListeningSession {
  schemaVersion: 1;
  id: string;
  mode: ListeningSessionMode;
  /** 每日任务的计划日；额外听力为创建当日 */
  planDate: string;
  materialId: string;
  phase: "listening" | "question" | "complete";
  listeningCompleted: boolean;
  /** 用户主动点击播放的次数（用于学习分析，不扣 XP） */
  playCount: number;
  /** 当前播放速度 0.8 / 1.0 */
  rate: ListeningRate;
  /** 答题前是否主动查看过原文（只记录，不惩罚） */
  transcriptViewedBeforeAnswer: boolean;
  /** 本组听力内新加入统一生词本的词 id */
  collectedWordIds: string[];
  startedAt: string;
  completedAt?: string;
  applied: boolean;
  rewardXp?: number;
  /** 复用通用答题状态机 */
  lesson: LessonSession;
}

export interface ListeningStore {
  schemaVersion: 1;
  daily: Record<string, ListeningDailyProgress>;
  sessions: Record<string, ListeningSession>;
  xpLedger: Record<string, number>;
}
