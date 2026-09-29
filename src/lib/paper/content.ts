/**
 * V13 Phase 2E: Paper content helpers.
 *
 * 从 CET6Paper 领域模型提取 UI 所需的扁平结构：
 * - sectionQuestionIds：每个 section 的 questionId 列表（用于进度计算、completion 判定）
 * - questionIdToCorrect：每道客观题的正确 answerId（用于结果计算、错题判定）
 * - questionIdToQuestion：每道题的完整 PaperQuestion（用于渲染）
 * - flattenedQuestions：按考试顺序展开的题目列表
 *
 * 纯函数，不依赖 React / storage。
 */

import type { CET6Paper, PaperQuestion, PaperSection, PaperGroup } from "@/content/papers";

/** 一道展开后的题（带 section/group 上下文）。 */
export interface FlattenedPaperQuestion {
  question: PaperQuestion;
  sectionId: string;
  sectionType: PaperSection["type"];
  sectionOrder: number;
  groupId: string;
  groupType: PaperGroup["type"];
  groupOrder: number;
  /** 该 group 内的题目 index（0-based）。 */
  questionIndexInGroup: number;
  /** 全局顺序（0-based）。 */
  globalIndex: number;
  /** 关联的 assetId（听力音频等）。 */
  assetIds?: string[];
  /** group 级材料（passage / transcript / prompt）。 */
  groupMaterial?: {
    passage?: string;
    transcript?: string;
    prompt?: string;
  };
}

/** 展开 Paper 为按考试顺序的题目列表。 */
export function flattenPaperQuestions(paper: CET6Paper): FlattenedPaperQuestion[] {
  const result: FlattenedPaperQuestion[] = [];
  let globalIndex = 0;
  for (const section of paper.sections) {
    for (const group of section.groups) {
      const questions = group.questions ?? [];
      questions.forEach((question, qIdx) => {
        result.push({
          question,
          sectionId: section.sectionId,
          sectionType: section.type,
          sectionOrder: section.order,
          groupId: group.groupId,
          groupType: group.type,
          groupOrder: group.order,
          questionIndexInGroup: qIdx,
          globalIndex: globalIndex++,
          assetIds: group.assetIds,
          groupMaterial: {
            passage: group.passage,
            transcript: group.transcript,
            prompt: group.prompt,
          },
        });
      });
    }
  }
  return result;
}

/** 每个 section 的 questionId 列表（按顺序）。 */
export function buildSectionQuestionIds(paper: CET6Paper): Record<string, string[]> {
  const map: Record<string, string[]> = {};
  for (const section of paper.sections) {
    const ids: string[] = [];
    for (const group of section.groups) {
      for (const q of group.questions ?? []) {
        ids.push(q.questionId);
      }
    }
    map[section.sectionId] = ids;
  }
  return map;
}

/** 每道客观题的正确 answerId。主观题返回 undefined。 */
export function buildQuestionIdToCorrect(paper: CET6Paper): Record<string, string | undefined> {
  const map: Record<string, string | undefined> = {};
  for (const section of paper.sections) {
    for (const group of section.groups) {
      for (const q of group.questions ?? []) {
        if (q.type === "subjective_writing" || q.type === "subjective_translation") {
          map[q.questionId] = undefined;
          continue;
        }
        // 客观题：优先 answerId，其次 answerKey.value，最后 answerText
        const correct = q.answerId ?? q.answerKey?.value ?? q.answerText;
        map[q.questionId] = correct;
      }
    }
  }
  return map;
}

/** 每道题的完整 PaperQuestion。 */
export function buildQuestionIdToQuestion(paper: CET6Paper): Record<string, PaperQuestion> {
  const map: Record<string, PaperQuestion> = {};
  for (const section of paper.sections) {
    for (const group of section.groups) {
      for (const q of group.questions ?? []) {
        map[q.questionId] = q;
      }
    }
  }
  return map;
}

/** 创建 PaperSession 所需的 sectionIds 元数据。 */
export function buildSectionMeta(paper: CET6Paper): { sectionId: string; type: PaperSection["type"]; totalQuestions: number }[] {
  return paper.sections.map((section) => {
    let total = 0;
    for (const group of section.groups) {
      total += (group.questions ?? []).length;
    }
    return { sectionId: section.sectionId, type: section.type, totalQuestions: total };
  });
}

/** 获取 Paper 的 asset by assetId。 */
export function getAssetById(paper: CET6Paper, assetId: string): CET6Paper["assets"] extends (infer T)[] | undefined ? T | undefined : never {
  return paper.assets?.find((a) => a.assetId === assetId);
}

/** 获取某 group 的第一个 audio asset。 */
export function getGroupAudioAsset(paper: CET6Paper, group: PaperGroup): CET6Paper["assets"] extends (infer T)[] | undefined ? T | undefined : never {
  if (!group.assetIds || group.assetIds.length === 0) return undefined;
  for (const aid of group.assetIds) {
    const asset = getAssetById(paper, aid);
    if (asset && asset.type === "audio") return asset;
  }
  return undefined;
}

/** 统计 Paper 各 section 题数。 */
export function getPaperSectionStats(paper: CET6Paper): { type: PaperSection["type"]; count: number }[] {
  return paper.sections.map((section) => {
    let count = 0;
    for (const group of section.groups) {
      count += (group.questions ?? []).length;
    }
    return { type: section.type, count };
  });
}

/** 总题数。 */
export function getPaperTotalQuestions(paper: CET6Paper): number {
  return getPaperSectionStats(paper).reduce((sum, s) => sum + s.count, 0);
}
