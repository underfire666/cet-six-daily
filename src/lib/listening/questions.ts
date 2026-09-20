import type { LessonDefinition } from "@/types/question";
import type { ListeningMaterial } from "@/types/listening";

export const LISTENING_LESSON_VERSION = 1;

/** 把听力材料题目映射为通用答题状态机可用的 LessonDefinition（确定性生成）。 */
export function listeningLesson(material: ListeningMaterial): LessonDefinition {
  return {
    id: `listening:${material.id}`,
    version: LISTENING_LESSON_VERSION,
    title: material.title,
    minutes: material.estimatedMinutes,
    questions: material.questions.map((q) => ({
      id: `lq:${q.id}`,
      type: "choice",
      module: "listening",
      prompt: q.prompt,
      options: q.options,
      answerId: q.answerId,
      explanation: q.shortExplanation,
      details: q.detailedExplanation,
      hint: q.hint,
    })),
  };
}
