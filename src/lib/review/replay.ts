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
import { getPaperById } from "@/content/registry";
import { flattenPaperQuestions } from "@/lib/paper/content";
import type { CET6Paper } from "@/content/papers";

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

/** Internal: resolve a Paper review item. allowStaging bypasses production boundary. */
function replayPaperItem(item: ReviewItem, allowStaging: boolean): ReviewReplay | null {
  const paper = getPaperById<CET6Paper>(item.sourceActivityId);
  if (!paper) return null;
  // Production content boundary: only active/published papers can be replayed
  // through the normal review flow. Staging/draft/raw papers return null,
  // preventing crafted localStorage ReviewItems from resolving staging content.
  if (!allowStaging && paper.status !== "active" && paper.status !== "published") {
    return null;
  }
  const flat = flattenPaperQuestions(paper);
  const found = flat.find(f => f.question.questionId === item.questionId);
  if (!found) return null;
  const q = found.question;
  const isListening = found.sectionType === "listening";
  return {
    sourceModule: isListening ? "listening" : "reading",
    activityId: paper.paperId,
    activityTitle: paper.title ?? paper.paperId,
    questionId: q.questionId,
    prompt: q.prompt ?? "",
    options: (q.options ?? []).map(o => ({ id: o.id, text: o.text ?? o.id })),
    correctOptionId: q.answerId ?? "",
    shortExplanation: q.shortExplanation ?? "",
    wrongOptionId: item.lastWrongOptionId,
    ...(found.groupMaterial?.passage ? { articlePassage: found.groupMaterial.passage } : {}),
    ...(found.groupMaterial?.transcript ? { transcript: found.groupMaterial.transcript } : {}),
  };
}

/** 根据 ReviewItem 通过 Content Repository 找回原题；找不到返回 null（页面优雅降级）。
 *  Production-safe: staging/draft/raw papers are NOT resolvable.
 *  QA/dev code should use replayReviewItemQa() instead.
 */
export function replayReviewItem(item: ReviewItem): ReviewReplay | null {
  // V13: Paper 题目解析（production boundary enforced）
  const paperReplay = replayPaperItem(item, false);
  if (paperReplay) return paperReplay;
  // If a paper was found but rejected (staging), don't fall through to other modules
  if (getPaperById(item.sourceActivityId)) return null;
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

/**
 * QA/dev-only review replay that CAN resolve staging/draft/raw papers.
 * Must NOT be imported by production review/wrongbook pages.
 * Production uses replayReviewItem() which enforces the staging boundary.
 */
export function replayReviewItemQa(item: ReviewItem): ReviewReplay | null {
  const paperReplay = replayPaperItem(item, true);
  if (paperReplay) return paperReplay;
  // Fall through to non-paper modules (same as production)
  return replayReviewItem(item);
}
