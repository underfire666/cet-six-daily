/**
 * V14 Phase 1D.1 — Private Study Progress Storage & Validation
 *
 * 独立、可测试的进度校验与存储模块。
 * 负责 sessionStorage 的读写、存档校验、错误分类与用户提示。
 *
 * 错误分类：
 * - NO_ARCHIVE: 没有存档（首次学习）
 * - CORRUPTED: 存档损坏（JSON 解析失败、字段类型错误、非法值）
 * - CONTENT_CHANGED: 内容指纹不匹配（题目内容变更，旧进度失效）
 * - OWNER_MISMATCH: 存档 owner 与当前用户不匹配（账号切换）
 * - STORAGE_READ_FAILED: 存储读取失败（sessionStorage 不可用）
 * - STORAGE_WRITE_FAILED: 存储写入失败（配额满、隐私模式等）
 */

import { PRIVATE_STUDY_PROGRESS_VERSION } from "./readiness";
import type { PrivateFlatQuestion } from "./readiness";

export type ProgressLoadStatus =
  | "loaded"
  | "no_archive"
  | "corrupted"
  | "content_changed"
  | "owner_mismatch"
  | "storage_read_failed";

export interface ProgressLoadResult {
  status: ProgressLoadStatus;
  answers: Record<number, string>;
  currentIndex: number;
  submitted: boolean;
  /** 用户可见的提示信息（仅在非 loaded 状态时有值） */
  message?: string;
}

export interface StudyProgressState {
  answers: Record<number, string>;
  currentIndex: number;
  submitted: boolean;
}

export const INITIAL_PROGRESS: StudyProgressState = {
  answers: {},
  currentIndex: 0,
  submitted: false,
};

function storageKey(userId: string, paperId: string): string {
  return `private-study:${userId}:${paperId}`;
}

/** 检查当前环境是否有可用的 sessionStorage */
function isStorageAvailable(): boolean {
  try {
    if (typeof window === "undefined") return false;
    const testKey = "__cet_private_storage_test__";
    window.sessionStorage.setItem(testKey, "1");
    window.sessionStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

/**
 * 校验 answers 对象是否合法。
 * - 必须是普通对象（非 null、非数组）
 * - key 必须是非负整数字符串
 * - value 必须是字符串
 * - 只保留在有效题目 index 范围内的答案
 */
function validateAndFilterAnswers(
  raw: unknown,
  questions: PrivateFlatQuestion[],
): { valid: boolean; answers: Record<number, string> } {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { valid: false, answers: {} };
  }
  const validIndices = new Set(questions.map((q) => q.index));
  const answers: Record<number, string> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const idx = Number(key);
    if (!Number.isInteger(idx) || idx < 0) continue; // 非法 key 静默跳过（不影响有效答案）
    if (!validIndices.has(idx)) continue; // 超出范围的答案静默跳过
    if (typeof value !== "string") continue; // 非字符串值静默跳过
    answers[idx] = value;
  }
  return { valid: true, answers };
}

/**
 * 校验 currentIndex 是否合法。
 * - 必须是有限整数
 * - 必须在 [0, total-1] 范围内
 * - 非法时返回 0
 */
function validateCurrentIndex(raw: unknown, total: number): number {
  if (typeof raw !== "number" || !Number.isFinite(raw) || !Number.isInteger(raw)) {
    return 0;
  }
  return Math.min(Math.max(0, raw), Math.max(0, total - 1));
}

/**
 * 从 sessionStorage 读取并校验进度。
 *
 * @param userId 当前用户 ID
 * @param paperId 私有卷 ID
 * @param contentHash 当前内容指纹
 * @param questions 当前题目列表（用于校验答案 index 范围）
 * @returns ProgressLoadResult
 */
export function loadStudyProgress(
  userId: string,
  paperId: string,
  contentHash: string,
  questions: PrivateFlatQuestion[],
): ProgressLoadResult {
  if (!isStorageAvailable()) {
    return {
      ...INITIAL_PROGRESS,
      status: "storage_read_failed",
      message: "当前浏览器不支持本地存储，进度仅在本次会话内有效，刷新后可能无法恢复。",
    };
  }

  const key = storageKey(userId, paperId);
  let raw: string | null;
  try {
    raw = window.sessionStorage.getItem(key);
  } catch {
    return {
      ...INITIAL_PROGRESS,
      status: "storage_read_failed",
      message: "读取本地存储失败，进度仅在本次会话内有效。",
    };
  }

  if (raw === null) {
    return { ...INITIAL_PROGRESS, status: "no_archive" };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // 存档损坏，清除并返回初始状态
    try {
      window.sessionStorage.removeItem(key);
    } catch {
      // ignore
    }
    return {
      ...INITIAL_PROGRESS,
      status: "corrupted",
      message: "检测到损坏的本地进度，已自动清除。请重新开始作答。",
    };
  }

  // 校验存档结构
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    try {
      window.sessionStorage.removeItem(key);
    } catch {
      // ignore
    }
    return {
      ...INITIAL_PROGRESS,
      status: "corrupted",
      message: "检测到损坏的本地进度，已自动清除。请重新开始作答。",
    };
  }

  const p = parsed as Record<string, unknown>;

  // 校验版本号
  if (p.version !== undefined && p.version !== PRIVATE_STUDY_PROGRESS_VERSION) {
    try {
      window.sessionStorage.removeItem(key);
    } catch {
      // ignore
    }
    return {
      ...INITIAL_PROGRESS,
      status: "corrupted",
      message: "本地进度格式已更新，旧进度已清除。请重新开始作答。",
    };
  }

  // 校验 owner
  if (typeof p.userId !== "string" || p.userId !== userId) {
    try {
      window.sessionStorage.removeItem(key);
    } catch {
      // ignore
    }
    return {
      ...INITIAL_PROGRESS,
      status: "owner_mismatch",
      message: "检测到其他账号的本地进度，已清除。请重新开始作答。",
    };
  }

  // 校验 paperId
  if (typeof p.paperId !== "string" || p.paperId !== paperId) {
    try {
      window.sessionStorage.removeItem(key);
    } catch {
      // ignore
    }
    return {
      ...INITIAL_PROGRESS,
      status: "corrupted",
      message: "本地进度与当前试卷不匹配，已清除。请重新开始作答。",
    };
  }

  // 校验内容指纹
  if (typeof p.contentHash !== "string" || p.contentHash !== contentHash) {
    try {
      window.sessionStorage.removeItem(key);
    } catch {
      // ignore
    }
    return {
      ...INITIAL_PROGRESS,
      status: "content_changed",
      message: "试卷内容已更新，旧作答进度已失效。请重新开始作答。",
    };
  }

  // 校验 submitted
  const submitted = p.submitted === true;

  // 校验并过滤 answers
  const { answers } = validateAndFilterAnswers(p.answers, questions);

  // 校验 currentIndex
  const currentIndex = validateCurrentIndex(p.currentIndex, questions.length);

  return {
    status: "loaded",
    answers,
    currentIndex,
    submitted,
  };
}

/**
 * 保存进度到 sessionStorage。
 *
 * @returns true 表示保存成功，false 表示保存失败（存储不可用或配额满）
 */
export function saveStudyProgress(
  userId: string,
  paperId: string,
  contentHash: string,
  state: StudyProgressState,
): boolean {
  if (!isStorageAvailable()) return false;

  const key = storageKey(userId, paperId);
  const data = {
    version: PRIVATE_STUDY_PROGRESS_VERSION,
    userId,
    paperId,
    contentHash,
    answers: state.answers,
    currentIndex: state.currentIndex,
    submitted: state.submitted,
    savedAt: new Date().toISOString(),
  };

  try {
    window.sessionStorage.setItem(key, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

/**
 * 清除进度。
 */
export function clearStudyProgress(userId: string, paperId: string): void {
  if (!isStorageAvailable()) return;
  try {
    window.sessionStorage.removeItem(storageKey(userId, paperId));
  } catch {
    // ignore
  }
}

/**
 * 根据加载状态获取用户可见的提示文本。
 */
export function getProgressStatusMessage(status: ProgressLoadStatus): string | null {
  switch (status) {
    case "no_archive":
      return null;
    case "loaded":
      return null;
    case "corrupted":
      return "检测到损坏的本地进度，已自动清除。";
    case "content_changed":
      return "试卷内容已更新，旧作答进度已失效。";
    case "owner_mismatch":
      return "检测到其他账号的本地进度，已清除。";
    case "storage_read_failed":
      return "当前浏览器不支持本地存储，刷新后可能无法恢复进度。";
    default:
      return null;
  }
}
