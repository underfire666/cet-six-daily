import { Check, RotateCcw } from "lucide-react";
import type { Question } from "@/types/question";
import type { LessonSession } from "@/types/session";
export function AnswerFeedback({
  session,
  question,
  onAction,
}: {
  session: LessonSession;
  question: Question;
  onAction: () => void;
}) {
  const terminal = session.phase === "feedback";
  const retry = session.phase === "retry";
  const record = session.records[question.id];
  const result =
    record?.[session.round === "initial" ? "initialResult" : "retestResult"];
  const correct = terminal && result !== "wrong" && result !== "unmastered";
  return (
    <footer
      className={`exercise-footer ${terminal ? (correct ? "is-correct" : "is-incorrect") : ""}`}
    >
      <div className="exercise-footer-inner">
        {(terminal || retry) && (
          <div className="exercise-feedback" role="status" tabIndex={0}>
            <h2>
              {correct ? <Check size={23} /> : <RotateCcw size={21} />}{" "}
              {retry
                ? "再试一次"
                : correct
                  ? "回答正确"
                  : result === "unmastered"
                    ? "暂未掌握，也没关系"
                    : "解析"}
            </h2>
            {terminal && (
              <>
                <p>
                  {!correct && (
                    <>
                      <strong>
                        正确答案：
                        {
                          question.options.find(
                            (o) => o.id === question.answerId,
                          )?.text
                        }
                      </strong>
                      <br />
                    </>
                  )}
                  {question.explanation}
                </p>
                <details>
                  <summary>查看详细解析</summary>
                  <p>{question.details}</p>
                </details>
              </>
            )}
          </div>
        )}
        <button
          className="exercise-button"
          disabled={!terminal && !session.selected}
          onClick={onAction}
        >
          {terminal ? "继续" : "检查"}
        </button>
      </div>
    </footer>
  );
}
