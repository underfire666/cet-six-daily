import { readingArticleById } from "@/content/learning";
import type { SessionAction } from "@/types/session";
import type { ReadingArticle, ReadingSession } from "@/types/reading";

import { createSession, reduceSession } from "@/lib/lesson/session";
import { readingLesson } from "./questions";

export type ReadingAction =
  | { type: "lesson"; action: SessionAction }
  | { type: "start_quiz" }
  | { type: "collect_word"; wordId: string };

export function createReadingSession(
  id: string,
  mode: ReadingSession["mode"],
  date: string,
  article: ReadingArticle,
  now: string,
): ReadingSession {
  return {
    schemaVersion: 1,
    id,
    mode,
    planDate: date,
    articleId: article.id,
    phase: "reading",
    readingCompleted: false,
    collectedWordIds: [],
    startedAt: now,
    applied: false,
    lesson: createSession(date, "review", readingLesson(article), id, now),
  };
}

export function reduceReadingSession(
  session: ReadingSession,
  action: ReadingAction,
): ReadingSession {
  if (session.phase === "complete") return session;
  if (action.type === "collect_word") {
    if (session.collectedWordIds.includes(action.wordId)) return session;
    return {
      ...session,
      collectedWordIds: [...session.collectedWordIds, action.wordId],
    };
  }
  if (action.type === "start_quiz") {
    if (session.phase !== "reading") return session;
    return { ...session, phase: "quiz", readingCompleted: true };
  }
  if (session.phase !== "quiz") return session;
  const article = readingArticleById(session.articleId);
  if (!article) return session;
  const lesson = reduceSession(
    session.lesson,
    action.action,
    readingLesson(article),
  );
  return {
    ...session,
    lesson,
    phase: lesson.phase === "complete" ? "complete" : "quiz",
  };
}
