"use client";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, RotateCcw } from "lucide-react";
import { useReview } from "@/components/review/ReviewProvider";

export default function ReviewCompletePage() {
  const params = useParams();
  const router = useRouter();
  const { store, ready } = useReview();
  const sid = String(params.id);
  const session = store.sessions[sid];

  if (!ready) return <main className="review-page"><p>加载中…</p></main>;
  if (!session || !session.applied) {
    return <main className="review-page"><p>会话未完成。<button onClick={() => router.push("/review")}>返回错题本</button></p></main>;
  }

  const total = session.itemIds.length;
  const correct = Object.values(session.answers).filter((a) => a.correct).length;
  const stillWeak = total - correct;

  return (
    <main className="review-page">
      <header className="review-header">
        <button className="exercise-icon-button" onClick={() => router.push("/")}>
          <ArrowLeft size={22} />
        </button>
        <h1>复习完成</h1>
      </header>

      <section className="review-complete-card">
        <CheckCircle2 size={48} color="#2b8a3e" />
        <h2>今日复习完成 ✓</h2>
        <p>复习 {total} 题 · 已掌握 {correct} · 仍需加强 {stillWeak}</p>
        <p className="review-complete-xp">+{session.rewardXp} XP</p>
        <p className="review-complete-note">仍需加强的内容已安排到后续复习。</p>
      </section>

      <div className="review-actions">
        <button className="primary-button" onClick={() => router.push("/")}>
          返回今日学习
        </button>
        <button className="secondary-button" onClick={() => router.push("/review")}>
          <RotateCcw size={16} /> 再复习一组
        </button>
      </div>
    </main>
  );
}
