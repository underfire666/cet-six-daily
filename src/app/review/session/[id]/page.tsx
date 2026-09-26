"use client";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Check, FileText, X } from "lucide-react";
import { useReview } from "@/components/review/ReviewProvider";
import { replayReviewItem } from "@/lib/review/replay";
import { useEffect, useMemo } from "react";
import { shortDate } from "@/lib/dates";
import { reviewDate } from "@/lib/review/config";
import type { ReviewMastery } from "@/types/review";

const MASTERY_LABEL: Record<ReviewMastery, string> = {
  new: "新收录",
  weak: "需加强",
  reviewing: "复习中",
  mastered: "已掌握",
};
const MODULE_LABEL: Record<string, string> = {
  vocabulary: "词汇",
  reading: "阅读",
  listening: "听力",
};

export function ReviewSession({ sessionId, onComplete, onExit }: {
  sessionId: string;
  onComplete?: () => void;
  onExit?: () => void;
}) {
  const router = useRouter();
  const { store, answer, finish, ready } = useReview();
  const sid = sessionId;
  const session = store.sessions[sid];

  const currentItem = useMemo(() => {
    if (!session) return null;
    const id = session.itemIds[session.currentIndex];
    return id ? store.items[id] : null;
  }, [session, store.items]);

  const replay = useMemo(
    () => (currentItem ? replayReviewItem(currentItem) : null),
    [currentItem],
  );

  useEffect(() => {
    if (!ready || !session) return;
    if (session.applied) {
      if (onComplete) onComplete();
      else router.replace(`/review/session/${sid}/complete`);
    }
    else if (session.currentIndex >= session.itemIds.length) finish(sid);
  }, [ready, session, sid, finish, router, onComplete]);

  if (!ready) return <main className="review-page"><p>加载中…</p></main>;
  if (!session) return <main className="review-page"><p>会话不存在。<button onClick={() => onExit ? onExit() : router.push("/review")}>返回</button></p></main>;
  if (session.applied || session.currentIndex >= session.itemIds.length) {
    return <main className="review-page"><p>正在整理复习结果…</p></main>;
  }
  if (!currentItem) return <main className="review-page"><p>题目缺失。</p></main>;

  const progress = session.currentIndex + 1;
  const total = session.itemIds.length;

  const choose = (correct: boolean) => {
    answer(sid, currentItem.id, correct);
  };

  return (
    <main className="review-session-page">
      <header className="review-session-head">
        <button className="exercise-icon-button" onClick={() => onExit ? onExit() : router.push("/review")}>
          <ArrowLeft size={20} />
        </button>
        <span>复习 {progress} / {total}</span>
      </header>

      <div className="review-session-bar">
        <span style={{ width: `${(progress / total) * 100}%` }} />
      </div>

      <section className="review-question">
        <p className="review-question-source">
          {MODULE_LABEL[currentItem.sourceModule] ?? currentItem.sourceModule} · {replay?.activityTitle ?? currentItem.questionId}
        </p>
        <p className="review-question-meta">
          上次错于 {shortDate(reviewDate(currentItem.createdAt))} · 当前 {MASTERY_LABEL[currentItem.masteryStatus]} · 已复习 {currentItem.reviewCount} 次
        </p>

        {replay ? (
          <>
            <h2>{replay.prompt}</h2>
            <div className="review-replay-options">
              {replay.options.map((opt) => {
                const isCorrect = opt.id === replay.correctOptionId;
                const isWrongPick = opt.id === replay.wrongOptionId;
                let cls = "review-replay-option";
                if (isCorrect) cls += " correct";
                if (isWrongPick) cls += " wrong-pick";
                return (
                  <div key={opt.id} className={cls}>
                    <span className="review-replay-option-id">{opt.id}</span>
                    <span className="review-replay-option-text">{opt.text}</span>
                    {isCorrect && <span className="review-replay-badge ok">正确答案</span>}
                    {isWrongPick && <span className="review-replay-badge bad">你的作答</span>}
                  </div>
                );
              })}
            </div>
            <p className="review-replay-explanation">{replay.shortExplanation}</p>

            {replay.articlePassage && (
              <details className="review-replay-source">
                <summary><FileText size={14} /> 查看原文</summary>
                <p>{replay.articlePassage}</p>
              </details>
            )}
            {replay.transcript && (
              <details className="review-replay-source">
                <summary><FileText size={14} /> 查看听力原文</summary>
                <p>{replay.transcript}</p>
              </details>
            )}
          </>
        ) : (
          <div className="review-replay-missing">
            <h2>原题内容已不可用</h2>
            <p>
              题目来源（{MODULE_LABEL[currentItem.sourceModule] ?? currentItem.sourceModule} · {currentItem.questionId}）
              已不在当前内容库中。你仍可凭记忆自评，不会影响其余复习。
            </p>
          </div>
        )}
      </section>

      <div className="review-choices">
        <button className="review-choice wrong" onClick={() => choose(false)}>
          <X size={22} /> 还需加强
        </button>
        <button className="review-choice right" onClick={() => choose(true)}>
          <Check size={22} /> 我会了
        </button>
      </div>
    </main>
  );
}

export default function ReviewSessionPage() {
  const params = useParams();
  return <ReviewSession sessionId={String(params.id)} />;
}
