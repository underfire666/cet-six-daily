"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BookOpen, Headphones, RotateCcw, Sparkles } from "lucide-react";
import { listeningMaterialById } from "@/data/mockListening";
import { listeningWordByKey } from "@/data/listeningVocabulary";
import { currentQuestion, sessionProgress } from "@/lib/lesson/session";
import { listeningLesson } from "@/lib/listening/questions";
import { playFeedback } from "@/lib/lesson/feedback";
import { todayInShanghai } from "@/lib/dates";
import { useLearning } from "../LearningProvider";
import { useVocabulary } from "../vocabulary/VocabularyProvider";
import { useListening } from "./ListeningProvider";
import { LessonProgress } from "../lesson/LessonProgress";
import { QuestionRenderer } from "../lesson/QuestionRenderer";
import { AnswerFeedback } from "../lesson/AnswerFeedback";
import {
  AiHint,
  LessonDialog,
  LessonExitDialog,
} from "../lesson/LessonDialog";
import { AudioPlayer } from "./AudioPlayer";
import { ListeningTranscript } from "./ListeningTranscript";
import { BookmarkPlus, BookmarkCheck } from "lucide-react";

function LookupSheet({
  material,
  wordKey,
  saved,
  onAdd,
  onClose,
}: {
  material: ReturnType<typeof listeningMaterialById> & object;
  wordKey: string;
  saved: boolean;
  onAdd: (wordKey: string) => void;
  onClose: () => void;
}) {
  const entry = material.vocabulary[wordKey];
  return (
    <LessonDialog title="查词" onClose={onClose}>
      {entry ? (
        <div className="reading-lookup">
          <div className="reading-lookup-word">{entry.word}</div>
          <div className="reading-lookup-phonetic">
            {entry.phonetic} · {entry.partOfSpeech}
          </div>
          <div className="reading-lookup-meaning">{entry.meaning}</div>
          <div className="reading-lookup-sentence">
            {entry.sentence}
            <small>{entry.sentenceTranslation}</small>
          </div>
          <button
            className="exercise-button"
            disabled={saved}
            onClick={() => onAdd(wordKey)}
          >
            {saved ? (
              <>
                <BookmarkCheck size={18} />
                已加入生词
              </>
            ) : (
              <>
                <BookmarkPlus size={18} />
                加入生词
              </>
            )}
          </button>
        </div>
      ) : (
        <div className="reading-lookup-missing">
          这段材料暂未收录该词的释义。多听一遍，继续往下走吧。
        </div>
      )}
    </LessonDialog>
  );
}

export function ListeningSessionPlayer({ id }: { id: string }) {
  const { ready, store, dispatch, notice } = useListening();
  const vocabulary = useVocabulary();
  const { settings } = useLearning();
  const router = useRouter();
  const [dialog, setDialog] = useState<"hint" | "exit" | "transcript" | null>(
    null,
  );
  const [lookup, setLookup] = useState<string | null>(null);
  const session = store.sessions[id];
  useEffect(() => {
    if (session?.phase === "complete")
      router.replace(`/practice/listening/complete/${id}`);
  }, [session?.phase, id, router]);
  if (!ready) return <div className="exercise-loading">正在准备听力…</div>;
  if (!session)
    return (
      <main className="exercise-gate">
        <h1>这次听力已无法恢复</h1>
        <p>返回听力页，重新开始一组。</p>
        <Link className="exercise-button" href="/practice/listening">
          返回听力
        </Link>
      </main>
    );
  if (session.phase === "complete")
    return <div className="exercise-loading">正在整理听力成果…</div>;
  const material = listeningMaterialById(session.materialId)!;
  const definition = listeningLesson(material);
  const question = currentQuestion(session.lesson, definition)!;
  const intro = session.lesson.phase === "review_intro";
  const progress =
    session.phase === "listening"
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
  const openTranscript = () => {
    if (session.phase === "listening" && !session.transcriptViewedBeforeAnswer)
      dispatch(id, { type: "view_transcript" });
    setDialog("transcript");
  };
  const addLookupWord = (wordKey: string) => {
    const word = listeningWordByKey(wordKey);
    if (!word) return;
    const added = vocabulary.addWordbookWord(word);
    if (added) dispatch(id, { type: "collect_word", wordId: word.id });
  };
  return (
    <div className="exercise-layout">
      <LessonProgress
        progress={progress}
        onExit={() => setDialog("exit")}
        label={session.phase === "listening" ? "听力" : "听力理解"}
      />
      <main className="exercise-body">
        {notice && <p className="exercise-notice">{notice}</p>}
        {session.phase === "listening" ? (
          <>
            <p className="listening-phase-hint">
              先听音频，遇到生词可点原文查义。听完点下方按钮开始答题。
            </p>
            <div className="listening-kind-badge">
              {material.kind === "dialogue"
                ? "短对话"
                : material.kind === "passage"
                  ? "短篇听力"
                  : "短句"}
            </div>
            <h2 className="listening-title">{material.title}</h2>
            <AudioPlayer
              audio={material.audio}
              rate={session.rate}
              onPlay={() => dispatch(id, { type: "record_play" })}
            />
            <div className="rate-switch">
              <button
                className={session.rate === 1.0 ? "is-active" : ""}
                onClick={() => dispatch(id, { type: "set_rate", rate: 1.0 })}
              >
                1.0×
              </button>
              <button
                className={session.rate === 0.8 ? "is-active" : ""}
                onClick={() => dispatch(id, { type: "set_rate", rate: 0.8 })}
              >
                0.8×
              </button>
              <small>已听 {session.playCount} 次</small>
            </div>
            <button className="exercise-ai" onClick={openTranscript}>
              <BookOpen size={17} />
              查看原文（{session.transcriptViewedBeforeAnswer ? "已看" : "未看"}）
            </button>
          </>
        ) : intro ? (
          <section className="exercise-review-intro">
            <div className="exercise-leaf">
              <Headphones size={38} />
            </div>
            <h1>
              再听一次，
              <br />
              听懂刚才错过的地方。
            </h1>
            <p>回顾这组听力里没答对的题目。每题再试一次，然后完成本组听力。</p>
            <blockquote>回原文，找到支持选项的关键句。</blockquote>
          </section>
        ) : (
          <>
            <span className="exercise-retest-label">
              {session.lesson.round === "retest" ? "巩固复测" : "听力理解"}
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
                  onClick={openTranscript}
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
            {session.lesson.phase !== "feedback" && (
              <div className="replay-row">
                <AudioPlayer
                  audio={material.audio}
                  rate={session.rate}
                  onPlay={() => dispatch(id, { type: "record_play" })}
                />
                <span className="replay-hint">
                  <RotateCcw size={14} /> 本组已听 {session.playCount} 次
                </span>
              </div>
            )}
          </>
        )}
      </main>
      {session.phase === "listening" ? (
        <footer className="exercise-footer">
          <div className="exercise-footer-inner">
            <button
              className="exercise-button"
              onClick={() => dispatch(id, { type: "start_question" })}
            >
              <Headphones size={18} />
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
            router.push("/practice/listening");
          }}
        />
      )}
      {dialog === "transcript" && (
        <LessonDialog title="听力原文" onClose={() => setDialog(null)}>
          <ListeningTranscript
            material={material}
            onWordClick={(wordKey) => setLookup(wordKey)}
          />
        </LessonDialog>
      )}
      {lookup && (
        <LookupSheet
          material={material}
          wordKey={lookup}
          saved={!!vocabulary.store.states[`lw_${lookup}`]?.addedToWordbook}
          onAdd={addLookupWord}
          onClose={() => setLookup(null)}
        />
      )}
    </div>
  );
}
