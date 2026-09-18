import {
  createSession,
  currentQuestion,
  reduceSession,
} from "@/lib/lesson/session";
import type { SessionAction } from "@/types/session";
import type {
  VocabularySession,
  VocabularySessionMode,
  VocabularyQuestionType,
} from "@/types/vocabulary";
import type { LessonDefinition } from "@/types/question";
export function createVocabularySession(
  id: string,
  mode: VocabularySessionMode,
  date: string,
  wordIds: string[],
  definition: LessonDefinition,
  now: string,
  questionTypes: Record<string, VocabularyQuestionType>,
): VocabularySession {
  return {
    schemaVersion: 1,
    id,
    mode,
    date,
    wordIds,
    definition,
    questionTypes,
    cardIndex: 0,
    phase: mode === "learn" || mode === "extra" ? "card" : "quiz",
    selfReports: {},
    lesson: createSession(date, "review", definition, id, now),
    applied: false,
  };
}
export function currentVocabularyWordId(session: VocabularySession) {
  return session.phase === "card"
    ? session.wordIds[session.cardIndex]
    : currentQuestion(session.lesson, session.definition)?.id.replace(
        /^vq:/,
        "",
      );
}
export type VocabularyAction =
  | { type: "self_report"; value: "known" | "unknown" }
  | { type: "lesson"; action: SessionAction };
export function reduceVocabularySession(
  session: VocabularySession,
  action: VocabularyAction,
): VocabularySession {
  if (session.phase === "complete") return session;
  const wordId = currentVocabularyWordId(session);
  if (!wordId) return session;
  if (action.type === "self_report") {
    if (session.phase !== "card" || !["learn", "extra"].includes(session.mode))
      return session;
    const last = session.cardIndex === session.wordIds.length - 1;
    return {
      ...session,
      cardIndex: last ? session.cardIndex : session.cardIndex + 1,
      phase: last ? "quiz" : "card",
      selfReports: { ...session.selfReports, [wordId]: action.value },
    };
  }
  if (session.phase !== "quiz") return session;
  const lesson = reduceSession(
    session.lesson,
    action.action,
    session.definition,
  );
  return {
    ...session,
    lesson,
    phase: lesson.phase === "complete" ? "complete" : "quiz",
  };
}
