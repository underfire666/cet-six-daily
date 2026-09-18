import type { LessonDefinition } from "@/types/question";
import type { LessonSession } from "@/types/session";
import { LessonDialog } from "./LessonDialog";
export function unresolvedQuestions(
  session: LessonSession,
  lesson: LessonDefinition,
) {
  return lesson.questions.filter((q) => {
    const r = session.records[q.id];
    return (
      r?.retestResult === "unmastered" ||
      (r?.initialResult === "wrong" && !r.retestResult)
    );
  });
}
export function UnmasteredReview({
  session,
  lesson,
  onClose,
}: {
  session: LessonSession;
  lesson: LessonDefinition;
  onClose: () => void;
}) {
  return (
    <LessonDialog title="本次未掌握" onClose={onClose}>
      <div className="unmastered-list">
        {unresolvedQuestions(session, lesson).map((q) => (
          <article key={q.id}>
            <h3>{q.prompt}</h3>
            {q.type === "reading" && <p lang="en">{q.passage}</p>}
            {q.type === "fill_blank" && <p lang="en">{q.sentence}</p>}
            <strong>
              正确答案：{q.options.find((o) => o.id === q.answerId)?.text}
            </strong>
            <p>{q.explanation}</p>
            <details>
              <summary>查看详细解析</summary>
              <p>{q.details}</p>
            </details>
          </article>
        ))}
      </div>
    </LessonDialog>
  );
}
