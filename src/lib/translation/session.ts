import type { TranslationTask } from "@/types/translation";
import type { TranslationSession } from "@/types/translation";
import type { SubjectiveSessionMode } from "@/types/subjective";
import { scoreTranslation } from "./scoring";

export type TranslationAction =
  | { type: "set_draft"; draft: string }
  | { type: "submit"; now: string }
  | { type: "finish"; now: string };

export function createTranslationSession(
  id: string,
  mode: SubjectiveSessionMode,
  date: string,
  task: TranslationTask,
  now: string,
): TranslationSession {
  return {
    schemaVersion: 1,
    id,
    mode,
    planDate: date,
    taskId: task.id,
    phase: "drafting",
    draft: "",
    startedAt: now,
    applied: false,
  };
}

export function reduceTranslationSession(
  session: TranslationSession,
  action: TranslationAction,
  task: TranslationTask,
): TranslationSession {
  if (session.phase === "complete") return session;
  switch (action.type) {
    case "set_draft":
      return { ...session, draft: action.draft };
    case "submit": {
      if (session.phase !== "drafting") return session;
      const text = session.draft.trim();
      if (!text) return session;
      const feedback = scoreTranslation(task, text, action.now);
      return {
        ...session,
        phase: "reviewing",
        submittedText: text,
        feedback,
        submittedAt: action.now,
      };
    }
    case "finish":
      if (session.phase !== "reviewing") return session;
      return { ...session, phase: "complete", completedAt: action.now };
    default:
      return session;
  }
}
