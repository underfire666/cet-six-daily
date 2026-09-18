import type { LessonDefinition, Question } from "@/types/question";
import type {
  AnswerRecord,
  LessonSession,
  SessionAction,
  SessionMode,
} from "@/types/session";

export function createSession(
  date: string,
  mode: SessionMode,
  lesson: LessonDefinition,
  id: string,
  now: string,
): LessonSession {
  return {
    schemaVersion: 1,
    id,
    date,
    mode,
    lessonId: lesson.id,
    lessonVersion: lesson.version,
    round: "initial",
    index: 0,
    selected: null,
    phase: "answering",
    records: {},
    retestQueue: [],
    startedAt: now,
    celebrationSeen: false,
  };
}
export function currentQuestion(
  session: LessonSession,
  lesson: LessonDefinition,
): Question | undefined {
  return session.round === "initial"
    ? lesson.questions[session.index]
    : lesson.questions.find((q) => q.id === session.retestQueue[session.index]);
}
export function recordFor(session: LessonSession, id: string): AnswerRecord {
  return session.records[id] ?? { initial: [], retest: [], hintUsed: false };
}
export function sessionProgress(
  session: LessonSession,
  lesson: LessonDefinition,
): number {
  const credits = lesson.questions.reduce((sum, q) => {
    const r = session.records[q.id];
    return (
      sum +
      (!r?.initialResult
        ? 0
        : r.initialResult !== "wrong" || r.retestResult
          ? 1
          : 0.5)
    );
  }, 0);
  return Math.round((credits / lesson.questions.length) * 100);
}
export function firstSubmissionAccuracy(
  session: LessonSession,
  lesson: LessonDefinition,
): number {
  return Math.round(
    (lesson.questions.filter((q) => session.records[q.id]?.initial[0]?.correct)
      .length /
      lesson.questions.length) *
      100,
  );
}
export function reduceSession(
  session: LessonSession,
  action: SessionAction,
  lesson: LessonDefinition,
): LessonSession {
  if (session.phase === "complete") return session;
  const q = currentQuestion(session, lesson);
  if (!q) return session;
  if (action.type === "continue") {
    if (session.phase === "review_intro")
      return {
        ...session,
        phase: "answering",
        round: "retest",
        index: 0,
        selected: null,
      };
    if (session.phase !== "feedback") return session;
    const count =
      session.round === "initial"
        ? lesson.questions.length
        : session.retestQueue.length;
    if (session.index + 1 < count)
      return {
        ...session,
        index: session.index + 1,
        phase: "answering",
        selected: null,
      };
    if (session.round === "initial" && session.retestQueue.length)
      return { ...session, phase: "review_intro", selected: null };
    return {
      ...session,
      phase: "complete",
      selected: null,
      completedAt: action.now,
      completedDay: action.today,
    };
  }
  if (session.phase !== "answering" && session.phase !== "retry")
    return session;
  const record = recordFor(session, q.id);
  if (action.type === "hint")
    return {
      ...session,
      records: { ...session.records, [q.id]: { ...record, hintUsed: true, usedAiHint: true } },
    };
  if (action.type === "select")
    return q.options.some((option) => option.id === action.optionId)
      ? { ...session, selected: action.optionId }
      : session;
  if (!session.selected) return session;
  const correct = session.selected === q.answerId;
  const attempts = [
    ...record[session.round],
    { optionId: session.selected, correct, hinted: record.hintUsed },
  ];
  const terminal =
    correct || session.round === "retest" || attempts.length === 2;
  const result = correct
    ? record.hintUsed
      ? "ai_hint_correct"
      : attempts.length === 1
        ? "first_try_correct"
        : "second_try_correct"
    : session.round === "retest"
      ? "unmastered"
      : "wrong";
  const updated: AnswerRecord = {
    ...record,
    [session.round]: attempts,
    ...(terminal
      ? {
          [session.round === "initial" ? "initialResult" : "retestResult"]:
            result,
        }
      : {}),
  };
  return {
    ...session,
    records: { ...session.records, [q.id]: updated },
    phase: terminal ? "feedback" : "retry",
    selected: terminal ? session.selected : null,
    retestQueue:
      terminal &&
      !correct &&
      session.round === "initial" &&
      !session.retestQueue.includes(q.id)
        ? [...session.retestQueue, q.id]
        : session.retestQueue,
  };
}
