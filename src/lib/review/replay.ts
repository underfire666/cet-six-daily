/**
 * V10: Review Repository Replay
 * 复习页通过稳定 ID + Content Repository 找回原题，不把完整题目复制进 ReviewItem。
 * 旧 ReviewItem（无 lastWrongOptionId / 内容已 deprecated）仍可回放或优雅降级。
 */
import type { ReviewItem } from "@/types/review";
import {
  readingArticleById,
  listeningMaterialById,
  wordById,
} from "@/content/learning";
import { vocabularyQuestion } from "@/lib/vocabulary/questions";
import { vocabularyRepository } from "@/content/repositories";

export interface ReviewReplay {
  sourceModule: "reading" | "listening" | "vocabulary";
  activityId: string;
  activityTitle: string;
  questionId: string;
  prompt: string;
  options: { id: string; text: string }[];
  correctOptionId: string;
  shortExplanation: string;
  /** 用户上次答错的选项（minimal snapshot），旧数据可能没有 */
  wrongOptionId?: string;
  /** reading：原文（折叠展示） */
  articlePassage?: string;
  /** listening：原文文本（折叠展示） */
  transcript?: string;
}

/** 根据 ReviewItem 通过 Content Repository 找回原题；找不到返回 null（页面优雅降级）。 */
export function replayReviewItem(item: ReviewItem): ReviewReplay | null {
  if (item.sourceModule === "reading") {
    const article = readingArticleById(item.sourceActivityId);
    if (!article) return null;
    const questionId = item.questionId.startsWith("rq:") ? item.questionId.slice(3) : item.questionId;
    const q = article.questions.find((x) => x.id === questionId);
    if (!q) return null;
    return {
      sourceModule: "reading",
      activityId: article.id,
      activityTitle: article.title,
      questionId: q.id,
      prompt: q.prompt,
      options: q.options,
      correctOptionId: q.answerId,
      shortExplanation: q.shortExplanation,
      wrongOptionId: item.lastWrongOptionId,
      articlePassage: article.passage,
    };
  }
  if (item.sourceModule === "listening") {
    const material = listeningMaterialById(item.sourceActivityId);
    if (!material) return null;
    const questionId = item.questionId.startsWith("lq:") ? item.questionId.slice(3) : item.questionId;
    const q = material.questions.find((x) => x.id === questionId);
    if (!q) return null;
    return {
      sourceModule: "listening",
      activityId: material.id,
      activityTitle: material.title,
      questionId: q.id,
      prompt: q.prompt,
      options: q.options,
      correctOptionId: q.answerId,
      shortExplanation: q.shortExplanation,
      wrongOptionId: item.lastWrongOptionId,
      transcript: material.transcript,
    };
  }
  if (item.sourceModule === "vocabulary") {
    const word = wordById(item.sourceActivityId);
    if (!word) return null;
    const q = vocabularyQuestion(word, vocabularyRepository.all(), "en_to_zh");
    return {
      sourceModule: "vocabulary",
      activityId: word.id,
      activityTitle: word.word,
      questionId: q.id,
      prompt: q.prompt,
      options: q.options,
      correctOptionId: q.answerId,
      shortExplanation: q.explanation,
      wrongOptionId: item.lastWrongOptionId,
    };
  }
  return null;
}
