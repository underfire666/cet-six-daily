import type { WritingSession, WritingTask } from "@/types/writing";
import type { SubjectiveSessionMode } from "@/types/subjective";
import { countWords, scoreWriting } from "./scoring";

export type WritingAction =
  | { type: "set_draft"; draft: string }
  | { type: "submit"; now: string }
  | { type: "finish"; now: string };

export function createWritingSession(
  id: string,
  mode: SubjectiveSessionMode,
  date: string,
  task: WritingTask,
  now: string,
): WritingSession {
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

export function reduceWritingSession(
  session: WritingSession,
  action: WritingAction,
  task: WritingTask,
): WritingSession {
  if (session.phase === "complete") return session;
  switch (action.type) {
    case "set_draft":
      return { ...session, draft: action.draft };
    case "submit": {
      if (session.phase !== "drafting") return session;
      const text = session.draft.trim();
      if (!text) return session;
      const feedback = scoreWriting(task, text, action.now);
      return {
        ...session,
        phase: "reviewing",
        submittedText: text,
        wordCount: countWords(text),
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
