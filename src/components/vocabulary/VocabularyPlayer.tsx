"use client";
import { wordById } from "@/content/learning";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Sparkles, Sprout } from "lucide-react";

import { currentQuestion, sessionProgress } from "@/lib/lesson/session";
import { currentVocabularyWordId } from "@/lib/vocabulary/session";
import { playFeedback } from "@/lib/lesson/feedback";
import { todayInShanghai } from "@/lib/dates";
import { batchProgress } from "@/lib/vocabulary/store";
import { useLearning } from "../LearningProvider";
import { useVocabulary } from "./VocabularyProvider";
import { WordCard } from "./WordCard";
import { LessonProgress } from "../lesson/LessonProgress";
import { QuestionRenderer } from "../lesson/QuestionRenderer";
import { AnswerFeedback } from "../lesson/AnswerFeedback";
import { AiHint, LessonExitDialog } from "../lesson/LessonDialog";
export function VocabularyPlayer({ id, onComplete, onExit }: { id: string; onComplete?: () => void; onExit?: () => void }) {
  const { ready, store, dispatch, toggleWordbook, notice } = useVocabulary();
  const { settings } = useLearning();
  const router = useRouter();
  const [dialog, setDialog] = useState<"hint" | "exit" | null>(null);
  const session = store.sessions[id];
  useEffect(() => {
    if (session?.phase === "complete") {
      if (onComplete) onComplete();
      else router.replace(`/practice/vocabulary/complete/${id}`);
    }
  }, [session?.phase, id, router, onComplete]);
  if (!ready) return <div className="exercise-loading">正在准备词汇…</div>;
  if (!session)
    return (
      <main className="exercise-gate">
        <h1>这次练习已无法恢复</h1>
        <p>返回词汇页，开始新的一组。</p>
        {onExit ? <button className="exercise-button" onClick={onExit}>返回词汇</button> :
          <Link className="exercise-button" href="/practice/vocabulary">返回词汇</Link>}
      </main>
    );
  if (session.phase === "complete")
    return <div className="exercise-loading">正在整理学习成果…</div>;
  const question = currentQuestion(session.lesson, session.definition)!;
  const word = wordById(currentVocabularyWordId(session)!)!;
  const intro = session.lesson.phase === "review_intro";
  const card = session.phase === "card";
  const progress = card
    ? Math.round((session.cardIndex / session.wordIds.length) * 25)
    : session.mode === "learn" || session.mode === "extra"
      ? 25 +
        Math.round(sessionProgress(session.lesson, session.definition) * 0.75)
      : sessionProgress(session.lesson, session.definition);
  const next = () =>
    dispatch(id, {
      type: "lesson",
      action: {
        type: "continue",
        today: todayInShanghai(),
        now: new Date().toISOString(),
      },
    });
  const check = () => {
    if (session.lesson.phase === "feedback") next();
    else if (session.lesson.selected) {
      playFeedback(session.lesson.selected === question.answerId, settings);
      dispatch(id, { type: "lesson", action: { type: "check" } });
    }
  };
  return (
    <div className="exercise-layout">
      <LessonProgress progress={progress} onExit={() => setDialog("exit")} />
      <main
        className="exercise-body"
        key={`${card ? word.id : question.id}:${card}:${session.lesson.round}:${intro}`}
      >
        {notice && <p className="exercise-notice">{notice}</p>}
        {session.batchId && (
          <p className="exercise-subtle">
            额外学习 · 本批次已完成{" "}
            {batchProgress(store, session.batchId).completed} /{" "}
            {store.batches[session.batchId]?.target} 个
          </p>
        )}
        {card ? (
          <WordCard
            word={word}
            saved={!!store.states[word.id]?.addedToWordbook}
            onBookmark={() => toggleWordbook(word.id)}
          />
        ) : intro ? (
          <section className="exercise-review-intro">
            <div className="exercise-leaf">
              <Sprout size={38} />
            </div>
            <h1>
              再把这些词，
              <br />
              用一次。
            </h1>
            <p>回顾刚才没答对的内容。每个词再试一次，然后结束这一组。</p>
            <blockquote>先理解句意，再看词性和搭配。</blockquote>
          </section>
        ) : (
          <>
            <span className="exercise-retest-label">
              {session.lesson.round === "retest"
                ? "巩固复测"
                : session.mode === "learn" || session.mode === "extra"
                  ? "小题巩固"
                  : "词汇复习"}
            </span>
            <QuestionRenderer
              question={question}
              selected={session.lesson.selected}
              disabled={session.lesson.phase === "feedback"}
              onSelect={(optionId) =>
                dispatch(id, {
                  type: "lesson",
                  action: { type: "select", optionId },
                })
              }
            />
            {session.lesson.phase !== "feedback" && (
              <button className="exercise-ai" onClick={() => setDialog("hint")}>
                <Sparkles size={17} />问 AI
              </button>
            )}
          </>
        )}
      </main>
      {card ? (
        <footer className="exercise-footer">
          <div className="exercise-footer-inner word-card-actions">
            <button
              className="exercise-button vocabulary-secondary-button"
              onClick={() =>
                dispatch(id, { type: "self_report", value: "unknown" })
              }
            >
              不认识
            </button>
            <button
              className="exercise-button"
              onClick={() =>
                dispatch(id, { type: "self_report", value: "known" })
              }
            >
              认识
            </button>
          </div>
        </footer>
      ) : intro ? (
        <footer className="exercise-footer">
          <div className="exercise-footer-inner">
            <button className="exercise-button" onClick={next}>
              开始巩固
            </button>
          </div>
        </footer>
      ) : (
        <AnswerFeedback
          key={`${question.id}:${session.lesson.round}`}
          session={session.lesson}
          question={question}
          onAction={check}
        />
      )}
      {dialog === "hint" && (
        <AiHint
          hint={question.hint}
          onViewed={() =>
            dispatch(id, { type: "lesson", action: { type: "hint" } })
          }
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === "exit" && (
        <LessonExitDialog
          onClose={() => setDialog(null)}
          onExit={() => {
            setDialog(null);
            if (onExit) onExit();
            else router.push("/practice/vocabulary");
          }}
        />
      )}
    </div>
  );
}
