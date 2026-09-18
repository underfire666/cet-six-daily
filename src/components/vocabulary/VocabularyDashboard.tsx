"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
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
export function VocabularyHeading({
  title,
  back = "/practice/vocabulary",
}: {
  title: string;
  back?: string;
}) {
  return (
    <header className="vocabulary-heading">
      <Link href={back} className="exercise-icon-button" aria-label="返回">
        <ArrowLeft size={22} />
      </Link>
      <h1>{title}</h1>
      <span>六级日常</span>
    </header>
  );
}
export function VocabularyDashboard() {
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
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [extraOpen, setExtraOpen] = useState(false);
  const begin = (mode: VocabularySessionMode) => {
    const id = start(mode);
    if (id) router.push(`/practice/vocabulary/session/${id}`);
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
          <Link
            className="vocabulary-link"
            href={`/practice/vocabulary/session/${previousDaily.id}`}
          >
            继续 {previousDaily.date} 未完成的一组
          </Link>
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
          <Link
            className="vocabulary-link"
            href="/practice/vocabulary/wordbook"
          >
            查看生词
            <ArrowRight size={17} />
          </Link>
        </section>
      </div>
      {message && (
        <p className="vocabulary-empty" role="status">
          {message}
        </p>
      )}
      {extraOpen && <ExtraLearningDialog onClose={() => setExtraOpen(false)} />}
    </main>
  );
}
