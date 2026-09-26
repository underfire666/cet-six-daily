"use client";
import {
  BookMarked,
  RotateCcw,
  ArrowRight,
  SpellCheck,
} from "lucide-react";
import { useState } from "react";
import { useVocabulary } from "./VocabularyProvider";
import type { VocabularySessionMode } from "@/types/vocabulary";
import { ExtraLearningDialog } from "./ExtraLearningDialog";
import { batchProgress } from "@/lib/vocabulary/store";
import { useLocalPracticeRoute } from "@/components/practice/useLocalPracticeRoute";
import { VocabularyPlayer } from "./VocabularyPlayer";
import { VocabularyComplete } from "./VocabularyComplete";
import { WordbookList } from "./WordbookList";
import { VocabularyHeading } from "./VocabularyHeading";
export { VocabularyHeading } from "./VocabularyHeading";
export function VocabularyDashboard() {
  const route = useLocalPracticeRoute("vocabulary");
  if (route.stage.kind === "session") {
    const id = route.stage.id;
    return <VocabularyPlayer id={id} onComplete={() => route.openComplete(id)} onExit={route.goHome} />;
  }
  if (route.stage.kind === "complete")
    return <VocabularyComplete id={route.stage.id} onSession={route.openSession} onHome={route.goHome} onWordbook={route.openWordbook} />;
  if (route.stage.kind === "wordbook")
    return <WordbookList onSession={route.openSession} onHome={route.goHome} />;
  return <VocabularyDashboardHome onSession={route.openSession} onWordbook={route.openWordbook} />;
}

function VocabularyDashboardHome({
  onSession,
  onWordbook,
}: {
  onSession: (id: string) => void;
  onWordbook: () => void;
}) {
  const {
    ready,
    notice,
    progress,
    active,
    due,
    wordbook,
    start,
    store,
    extraBatch,
    dayStats,
    dailyComplete,
    previousDaily,
  } = useVocabulary();
  const [message, setMessage] = useState("");
  const [extraOpen, setExtraOpen] = useState(false);
  const begin = (mode: VocabularySessionMode) => {
    const id = start(mode);
    if (id) onSession(id);
    else
      setMessage(
        mode === "due_review"
          ? "今天暂时没有需要复习的单词"
          : "今日新词已完成，可以去生词本巩固一下。",
      );
  };
  const pendingReview = Object.values(store.sessions).find(
    (s) => s.mode === "due_review" && s.phase !== "complete",
  );
  const total = progress.wordIds.length,
    done = progress.completedWordIds.length;
  return (
    <main className="vocabulary-page">
      <VocabularyHeading title="词汇" back="/" />
      {notice && <p className="exercise-notice">{notice}</p>}
      <section className="vocabulary-today">
        <div className="vocabulary-section-title">
          <span>
            <SpellCheck size={21} />
            今日词汇
          </span>
          <small>每组 5 个，慢慢记牢</small>
        </div>
        <div className="vocabulary-count">
          <strong>{done}</strong>
          <span>
            / {total} 个{dailyComplete ? " ✓" : ""}
          </span>
        </div>
        <p>{dailyComplete ? "今日任务完成" : "把单词，变成自己的表达。"}</p>
        <div
          className="exercise-progress"
          role="progressbar"
          aria-label="今日词汇进度"
          aria-valuenow={done}
          aria-valuemin={0}
          aria-valuemax={total || 1}
        >
          <span style={{ width: `${total ? (done / total) * 100 : 100}%` }} />
        </div>
        <button
          className="exercise-button"
          disabled={!ready}
          onClick={() =>
            dailyComplete
              ? extraBatch
                ? begin("extra")
                : setExtraOpen(true)
              : begin("learn")
          }
        >
          {dailyComplete
            ? extraBatch
              ? "继续额外学习"
              : "继续学习"
            : active
              ? "继续学习"
              : done === total
                ? "今日新词已完成"
                : done
                  ? "继续学习"
                  : "开始学习"}
          <ArrowRight size={18} />
        </button>
        <div className="vocabulary-extra-stats">
          <span>
            今日额外学习 <strong>{dayStats.extra}</strong> 个
          </span>
          <span>今日词汇 +{dayStats.xp} XP</span>
        </div>
        {extraBatch && (
          <p className="exercise-subtle">
            额外批次 {batchProgress(store, extraBatch.id).completed} /{" "}
            {extraBatch.target} 个
            {!dailyComplete && (
              <button
                className="exercise-text-button"
                onClick={() => begin("extra")}
              >
                继续额外学习
              </button>
            )}
          </p>
        )}
        <p className="vocabulary-mock-note">
          示例词库 · 新词不足时包含已学词巩固
        </p>
        {previousDaily && (
          <button
            className="vocabulary-link"
            onClick={() => onSession(previousDaily.id)}
          >
            继续 {previousDaily.date} 未完成的一组
          </button>
        )}
      </section>
      <div className="vocabulary-secondary">
        <section>
          <div className="vocabulary-small-icon">
            <RotateCcw size={24} />
          </div>
          <h2>待复习</h2>
          <p>
            <strong>{due.length}</strong> 个单词到期
          </p>
          <button
            className="vocabulary-link"
            disabled={!ready}
            onClick={() => begin("due_review")}
          >
            {pendingReview ? "继续复习" : "开始复习"}
            <ArrowRight size={17} />
          </button>
        </section>
        <section>
          <div className="vocabulary-small-icon">
            <BookMarked size={24} />
          </div>
          <h2>我的生词</h2>
          <p>
            <strong>{wordbook.length}</strong> 个收藏
          </p>
          <button
            className="vocabulary-link"
            onClick={onWordbook}
          >
            查看生词
            <ArrowRight size={17} />
          </button>
        </section>
      </div>
      {message && (
        <p className="vocabulary-empty" role="status">
          {message}
        </p>
      )}
      {extraOpen && <ExtraLearningDialog onClose={() => setExtraOpen(false)} onSession={onSession} />}
    </main>
  );
}
