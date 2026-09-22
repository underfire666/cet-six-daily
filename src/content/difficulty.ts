/**
 * V10: 统一 Content Layer Difficulty
 * 模块内部字段（词汇 1–5）通过 Adapter 映射到统一枚举 easy/normal/hard，
 * 不修改原数据；translation/writing 内容数据无难度区分，统一按 normal 计。
 */
import type { ContentDifficulty } from "./types";

export interface DifficultyCarrier {
  type?: string;
  difficulty?: unknown;
}

/** 模块 difficulty → 统一 ContentDifficulty（vocabulary 1-5 → easy(1-2)/normal(3)/hard(4-5)）。 */
export function unifiedDifficulty(item: DifficultyCarrier): ContentDifficulty {
  if (item.type === "vocabulary") {
    const d = Number(item.difficulty);
    if (Number.isInteger(d) && d >= 1 && d <= 5) {
      return d <= 2 ? "easy" : d === 3 ? "normal" : "hard";
    }
    // 词汇难度缺失/非法时不伪造：按 normal 计并说明（见 content:stats 注释）
    return "normal";
  }
  if (item.difficulty === "easy" || item.difficulty === "normal" || item.difficulty === "hard") {
    return item.difficulty;
  }
  // reading/listening 之外（translation/writing/paper）内容数据无难度区分 → normal
  return "normal";
}
