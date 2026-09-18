import type { LessonDefinition } from "@/types/question";
import type { ReadingArticle } from "@/types/reading";

export const READING_LESSON_VERSION = 1;

/** 把文章题目映射为通用答题状态机可用的 LessonDefinition（确定性生成）。 */
export function readingLesson(article: ReadingArticle): LessonDefinition {
  return {
    id: `reading:${article.id}`,
    version: READING_LESSON_VERSION,
    title: article.title,
    minutes: article.estimatedMinutes,
    questions: article.questions.map((q) => ({
      id: `rq:${q.id}`,
      type: "choice",
      module: "reading",
      prompt: q.prompt,
      options: q.options,
      answerId: q.answerId,
      explanation: q.shortExplanation,
      details: q.detailedExplanation,
      hint: q.hint,
    })),
  };
}
