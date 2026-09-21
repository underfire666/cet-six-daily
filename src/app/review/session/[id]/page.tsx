"use client";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Check, X } from "lucide-react";
import { useReview } from "@/components/review/ReviewProvider";
import { useMemo } from "react";
import { shortDate } from "@/lib/dates";
import type { ReviewMastery } from "@/types/review";

const MASTERY_LABEL: Record<ReviewMastery, string> = {
  new: "新收录",
  weak: "需加强",
  reviewing: "复习中",
  mastered: "已掌握",
};

export default function ReviewSessionPage() {
  const params = useParams();
  const router = useRouter();
  const { store, answer, finish, ready } = useReview();
  const sid = String(params.id);
  const session = store.sessions[sid];

  const currentItem = useMemo(() => {
    if (!session) return null;
    const id = session.itemIds[session.currentIndex];
    return id ? store.items[id] : null;
  }, [session, store.items]);

  if (!ready) return <main className="review-page"><p>加载中…</p></main>;
  if (!session) return <main className="review-page"><p>会话不存在。<button onClick={() => router.push("/review")}>返回</button></p></main>;
  if (session.applied || session.currentIndex >= session.itemIds.length) {
    router.replace(`/review/session/${sid}/complete`);
    return null;
  }
  if (!currentItem) return <main className="review-page"><p>题目缺失。</p></main>;

  const progress = session.currentIndex + 1;
  const total = session.itemIds.length;

  const choose = (correct: boolean) => {
    answer(sid, currentItem.id, correct);
    if (progress >= total) {
      // 等 commit 后 finish
      setTimeout(() => finish(sid), 50);
    }
  };

  return (
    <main className="review-session-page">
      <header className="review-session-head">
        <button className="exercise-icon-button" onClick={() => router.push("/review")}>
          <ArrowLeft size={20} />
        </button>
        <span>今日复习 {progress} / {total}</span>
      </header>

      <div className="review-session-bar">
        <span style={{ width: `${(progress / total) * 100}%` }} />
      </div>

      <section className="review-question">
        <p className="review-question-source">
          {currentItem.sourceModule === "vocabulary" ? "词汇" : currentItem.sourceModule === "reading" ? "阅读" : "听力"}
          · {currentItem.questionId}
        </p>
        <h2>这道题你还记得答案吗？</h2>
        <p className="review-question-meta">
          上次错于 {shortDate(currentItem.createdAt)} · 当前状态 {MASTERY_LABEL[currentItem.masteryStatus]} · 已复习 {currentItem.reviewCount} 次
        </p>
        <p className="review-question-hint">
          复习模式：凭记忆回想，然后诚实地告诉自己是否掌握。
        </p>

        <div className="review-choices">
          <button className="review-choice wrong" onClick={() => choose(false)}>
            <X size={22} /> 还需加强
          </button>
          <button className="review-choice right" onClick={() => choose(true)}>
            <Check size={22} /> 我会了
          </button>
        </div>
      </section>
    </main>
  );
}
