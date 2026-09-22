import { listeningMaterialById } from "@/content/learning";
import type { SessionAction } from "@/types/session";
import type {
  ListeningMaterial,
  ListeningRate,
  ListeningSession,
} from "@/types/listening";

import { createSession, reduceSession } from "@/lib/lesson/session";
import { listeningLesson } from "./questions";

export type ListeningAction =
  | { type: "lesson"; action: SessionAction }
  | { type: "start_question" }
  | { type: "collect_word"; wordId: string }
  | { type: "record_play" }
  | { type: "set_rate"; rate: ListeningRate }
  | { type: "view_transcript" };

export function createListeningSession(
  id: string,
  mode: ListeningSession["mode"],
  date: string,
  material: ListeningMaterial,
  now: string,
): ListeningSession {
  return {
    schemaVersion: 1,
    id,
    mode,
    planDate: date,
    materialId: material.id,
    phase: "listening",
    listeningCompleted: false,
    playCount: 0,
    rate: 1.0,
    transcriptViewedBeforeAnswer: false,
    collectedWordIds: [],
    startedAt: now,
    applied: false,
    lesson: createSession(date, "review", listeningLesson(material), id, now),
  };
}

export function reduceListeningSession(
  session: ListeningSession,
  action: ListeningAction,
): ListeningSession {
  if (session.phase === "complete") return session;
  switch (action.type) {
    case "collect_word":
      if (session.collectedWordIds.includes(action.wordId)) return session;
      return {
        ...session,
        collectedWordIds: [...session.collectedWordIds, action.wordId],
      };
    case "record_play":
      return { ...session, playCount: session.playCount + 1 };
    case "set_rate":
      return { ...session, rate: action.rate };
    case "view_transcript":
      if (session.transcriptViewedBeforeAnswer) return session;
      return { ...session, transcriptViewedBeforeAnswer: true };
    case "start_question":
      if (session.phase !== "listening") return session;
      return { ...session, phase: "question", listeningCompleted: true };
    case "lesson": {
      if (session.phase !== "question") return session;
      const material = listeningMaterialById(session.materialId);
      if (!material) return session;
      const lesson = reduceSession(
        session.lesson,
        action.action,
        listeningLesson(material),
      );
      return {
        ...session,
        lesson,
        phase: lesson.phase === "complete" ? "complete" : "question",
      };
    }
    default:
      return session;
  }
}
