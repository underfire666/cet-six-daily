"use client";
import { readingArticleById } from "@/content/learning";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpen, Check, Zap } from "lucide-react";

import { readingLesson } from "@/lib/reading/questions";
import { unresolvedQuestions } from "../lesson/UnmasteredReview";
import { useReading } from "./ReadingProvider";

export function ReadingComplete({ id, onSession, onHome }: { id: string; onSession?: (id: string) => void; onHome?: () => void }) {
  const { ready, store, dailyComplete, start } = useReading();
  const router = useRouter();
  const session = store.sessions[id];
  const nextArticle = () => {
    const mode =
      session?.mode === "extra" || dailyComplete ? "extra" : "daily";
    const nextId = start(mode);
    if (nextId) {
      if (onSession) onSession(nextId);
      else router.push(`/practice/reading/session/${nextId}`);
    }
  };
  if (!ready) return <div className="exercise-loading">正在准备阅读…</div>;
  if (!session || !session.applied)
    return (
      <main className="exercise-gate">
        <h1>这篇阅读还没完成</h1>
        <p>返回阅读页，选择一篇文章开始吧。</p>
        {onHome ? <button className="exercise-button" onClick={onHome}>返回阅读</button> :
          <Link className="exercise-button" href="/practice/reading">返回阅读</Link>}
      </main>
    );
  const article = readingArticleById(session.articleId)!;
  const definition = readingLesson(article);
  const firstTry = definition.questions.filter(
    (q) => session.lesson.records[q.id]?.initialResult === "first_try_correct",
  ).length;
  const retryMastered = definition.questions.filter((q) => {
    const r = session.lesson.records[q.id]?.initialResult;
    return r === "second_try_correct" || r === "ai_hint_correct";
  }).length;
  const needImprove = unresolvedQuestions(session.lesson, definition).length;
  const collected = session.collectedWordIds.length;
  return (
    <main className="reading-complete">
      <div className="reading-complete-badge">
        <Check size={42} strokeWidth={2.7} />
      </div>
      <h1>阅读完成</h1>
      <p className="reading-complete-sub">
        又读懂一篇六级文章，积累了一点底气。
      </p>
      <div className="reading-stats">
        <div className="reading-stat">
          <span>首次答对</span>
          <strong>{firstTry} 题</strong>
        </div>
        <div className="reading-stat">
          <span>重试掌握</span>
          <strong>{retryMastered} 题</strong>
        </div>
        <div className="reading-stat">
          <span>仍需加强</span>
          <strong>{needImprove} 题</strong>
        </div>
        <div className="reading-stat">
          <span>本篇生词</span>
          <strong>{collected} 个</strong>
        </div>
      </div>
      <div className="reading-xp">
        <span>
          <Zap size={16} style={{ verticalAlign: -2 }} />
          本篇阅读
        </span>
        <strong>+{session.rewardXp ?? 0} XP</strong>
      </div>
      <div className="reading-complete-actions">
        <button className="reading-button" onClick={nextArticle}>
          <BookOpen size={18} />
          {session.mode === "daily" && !dailyComplete
            ? "继续下一篇"
            : "今天再读一篇"}
        </button>
        {onHome ? <button className="reading-text-button" onClick={onHome}>返回阅读首页</button> :
          <Link className="reading-text-button" href="/practice/reading">返回阅读首页</Link>}
      </div>
    </main>
  );
}
