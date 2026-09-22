"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, BookMarked } from "lucide-react";
import { useVocabulary } from "@/components/vocabulary/VocabularyProvider";

export default function WordsPage() {
  const router = useRouter();
  const { wordbook } = useVocabulary();

  const dueCount = wordbook.filter(
    (s) => s.needsReview && s.masteryStatus !== "mastered",
  ).length;

  return (
    <main className="review-page">
      <header className="review-header">
        <button className="exercise-icon-button" onClick={() => router.push("/review")}>
          <ArrowLeft size={22} />
        </button>
        <h1>我的生词</h1>
      </header>

      <section className="review-hero">
        <div className="review-stats">
          <div><strong>{wordbook.length}</strong><span>全部生词</span></div>
          <div><strong>{dueCount}</strong><span>待复习</span></div>
        </div>
        <Link href="/practice/vocabulary/wordbook" className="primary-button">
          <BookMarked size={16} /> 开始生词复习
        </Link>
      </section>

      {wordbook.length === 0 ? (
        <p className="review-empty">还没有收藏生词。阅读/听力时点词即可加入。</p>
      ) : (
        <ul className="review-list">
          {wordbook.slice(0, 50).map((s) => (
            <li key={s.wordId} className="review-item">
              <div className="review-item-main">
                <div>
                  <strong>{s.wordId}</strong>
                  <small>掌握度 {s.masteryStatus} · 复习 {s.reviewCount} 次</small>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
