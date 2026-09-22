"use client";
import { readingArticleById, readingWordByKey } from "@/content/learning";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BookOpen, Sparkles } from "lucide-react";


import { currentQuestion, sessionProgress } from "@/lib/lesson/session";
import { readingLesson } from "@/lib/reading/questions";
import { playFeedback } from "@/lib/lesson/feedback";
import { todayInShanghai } from "@/lib/dates";
import { useLearning } from "../LearningProvider";
import { useVocabulary } from "../vocabulary/VocabularyProvider";
import { useReading } from "./ReadingProvider";
import { LessonProgress } from "../lesson/LessonProgress";
import { QuestionRenderer } from "../lesson/QuestionRenderer";
import { AnswerFeedback } from "../lesson/AnswerFeedback";
import { AiHint, LessonExitDialog, LessonDialog } from "../lesson/LessonDialog";
import { ReadingPassage } from "./ReadingPassage";
import { WordLookupSheet } from "./WordLookupSheet";

export function ReadingSessionPlayer({ id }: { id: string }) {
  const { ready, store, dispatch, notice } = useReading();
  const vocabulary = useVocabulary();
  const { settings } = useLearning();
  const router = useRouter();
  const [dialog, setDialog] = useState<"hint" | "exit" | "passage" | null>(
    null,
  );
  const [lookup, setLookup] = useState<string | null>(null);
  const session = store.sessions[id];
  useEffect(() => {
    if (session?.phase === "complete")
      router.replace(`/practice/reading/complete/${id}`);
  }, [session?.phase, id, router]);
  if (!ready) return <div className="exercise-loading">正在准备阅读…</div>;
  if (!session)
    return (
      <main className="exercise-gate">
        <h1>这次阅读已无法恢复</h1>
        <p>返回阅读页，重新开始一篇。</p>
        <Link className="exercise-button" href="/practice/reading">
          返回阅读
        </Link>
      </main>
    );
  if (session.phase === "complete")
    return <div className="exercise-loading">正在整理阅读成果…</div>;
  const article = readingArticleById(session.articleId)!;
  const definition = readingLesson(article);
  const question = currentQuestion(session.lesson, definition)!;
  const intro = session.lesson.phase === "review_intro";
  const progress =
    session.phase === "reading"
      ? 0
      : sessionProgress(session.lesson, definition);
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
  const addLookupWord = (wordKey: string) => {
    const word = readingWordByKey(wordKey);
    if (!word) return;
    const added = vocabulary.addWordbookWord(word);
    if (added) dispatch(id, { type: "collect_word", wordId: word.id });
  };
  return (
    <div className="exercise-layout">
      <LessonProgress
        progress={progress}
        onExit={() => setDialog("exit")}
        label={session.phase === "reading" ? "阅读" : "阅读理解"}
      />
      <main className="exercise-body">
        {notice && <p className="exercise-notice">{notice}</p>}
        {session.phase === "reading" ? (
          <>
            <p className="reading-phase-hint">
              通读全文，遇到生词可以点一下查释义。读完点下方按钮开始答题。
            </p>
            <ReadingPassage
              article={article}
              onWordClick={(wordKey) => setLookup(wordKey)}
            />
          </>
        ) : intro ? (
          <section className="exercise-review-intro">
            <div className="exercise-leaf">
              <BookOpen size={38} />
            </div>
            <h1>
              再读一次，
              <br />
              读懂刚才错过的地方。
            </h1>
            <p>回顾这篇文章里没答对的题目。每道题再试一次，然后完成本篇阅读。</p>
            <blockquote>回到原文，找到支持选项的关键句。</blockquote>
          </section>
        ) : (
          <>
            <span className="exercise-retest-label">
              {session.lesson.round === "retest" ? "巩固复测" : "阅读理解"}
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
              <div className="reading-quiz-tools">
                <button
                  className="exercise-ai"
                  onClick={() => setDialog("passage")}
                >
                  <BookOpen size={17} />
                  查看原文
                </button>
                <button
                  className="exercise-ai"
                  onClick={() => setDialog("hint")}
                >
                  <Sparkles size={17} />
                  问 AI
                </button>
              </div>
            )}
          </>
        )}
      </main>
      {session.phase === "reading" ? (
        <footer className="exercise-footer">
          <div className="exercise-footer-inner">
            <button
              className="exercise-button"
              onClick={() => dispatch(id, { type: "start_quiz" })}
            >
              <BookOpen size={18} />
              开始答题
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
            router.push("/practice/reading");
          }}
        />
      )}
      {dialog === "passage" && (
        <LessonDialog title="原文" onClose={() => setDialog(null)}>
          <div className="reading-passage-sheet">
            <h2>{article.title}</h2>
            {article.passage.split(/\n\n+/).map((paragraph, i) => (
              <p key={i}>{paragraph}</p>
            ))}
          </div>
        </LessonDialog>
      )}
      {lookup && (
        <WordLookupSheet
          article={article}
          wordKey={lookup}
          saved={!!vocabulary.store.states[`rw_${lookup}`]?.addedToWordbook}
          onAdd={addLookupWord}
          onClose={() => setLookup(null)}
        />
      )}
    </div>
  );
}
