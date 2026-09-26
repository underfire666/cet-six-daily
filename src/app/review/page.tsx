"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Bookmark, CheckCircle2, RotateCcw, Star, Trash2 } from "lucide-react";
import { useReview } from "@/components/review/ReviewProvider";
import { useCallback, useEffect, useState } from "react";
import { shortDate } from "@/lib/dates";
import type { ReviewMastery } from "@/types/review";
import { ReviewSession } from "./session/[id]/page";
import { ReviewComplete } from "./session/[id]/complete/page";

type LocalReviewRoute = { stage: "session" | "complete"; id: string } | null;

function readLocalRoute(): LocalReviewRoute {
  const params = new URLSearchParams(window.location.search);
  const complete = params.get("complete");
  if (complete) return { stage: "complete", id: complete };
  const session = params.get("session");
  return session ? { stage: "session", id: session } : null;
}

const MASTERY_LABEL: Record<ReviewMastery, string> = {
  new: "新收录",
  weak: "需加强",
  reviewing: "复习中",
  mastered: "已掌握",
};
const MASTERY_COLOR: Record<ReviewMastery, string> = {
  new: "#868e96",
  weak: "#e03131",
  reviewing: "#f08c00",
  mastered: "#2b8a3e",
};

export default function ReviewHomePage() {
  const router = useRouter();
  const { store, dueToday, stats, startSession, toggleFavorite, remove, ready } = useReview();
  const [filter, setFilter] = useState<"all" | "due" | "unmastered" | "favorite" | "mastered">("all");
  const [localRoute, setLocalRoute] = useState<LocalReviewRoute>(null);

  useEffect(() => {
    const update = () => setLocalRoute(readLocalRoute());
    update();
    window.addEventListener("popstate", update);
    return () => window.removeEventListener("popstate", update);
  }, []);

  const navigateLocal = useCallback((route: LocalReviewRoute, replace = false) => {
    const url = route ? `/review?${route.stage}=${encodeURIComponent(route.id)}` : "/review";
    if (replace) window.history.replaceState(null, "", url);
    else window.history.pushState(null, "", url);
    setLocalRoute(route);
  }, []);

  const items = Object.values(store.items)
    .filter((i) => !i.removed)
    .filter((i) => {
      if (filter === "due") return dueToday.some((d) => d.id === i.id);
      if (filter === "unmastered") return i.masteryStatus === "weak";
      if (filter === "favorite") return i.favorite;
      if (filter === "mastered") return i.masteryStatus === "mastered";
      return true;
    });

  const beginReview = (mode: "due" | "unmastered" | "favorite") => {
    const pool =
      mode === "due" ? dueToday :
      mode === "unmastered" ? Object.values(store.items).filter((i) => !i.removed && i.masteryStatus === "weak") :
      Object.values(store.items).filter((i) => !i.removed && i.favorite);
    if (pool.length === 0) return;
    const sid = startSession(pool, mode === "due" ? "daily" : "manual", mode === "due" ? "daily_plan" : "manual");
    if (sid) navigateLocal({ stage: "session", id: sid });
  };

  if (localRoute?.stage === "session") {
    return <ReviewSession sessionId={localRoute.id}
      onComplete={() => navigateLocal({ stage: "complete", id: localRoute.id }, true)}
      onExit={() => navigateLocal(null)} />;
  }
  if (localRoute?.stage === "complete") {
    return <ReviewComplete sessionId={localRoute.id} onReviewHome={() => navigateLocal(null)} />;
  }

  return (
    <main className="review-page">
      <header className="review-header">
        <button className="exercise-icon-button" onClick={() => router.push("/")} aria-label="返回">
          <ArrowLeft size={22} />
        </button>
        <h1>错题本</h1>
      </header>

      <section className="review-hero">
        <div className="review-stats">
          <div><strong>{stats.due}</strong><span>今日待复习</span></div>
          <div><strong>{stats.unmastered}</strong><span>需加强</span></div>
          <div><strong>{stats.mastered}</strong><span>已掌握</span></div>
          <div><strong>{stats.favorite}</strong><span>收藏</span></div>
        </div>
        <button
          className="primary-button"
          disabled={dueToday.length === 0 || !ready}
          onClick={() => beginReview("due")}
        >
          <RotateCcw size={16} /> 开始今日复习（{dueToday.length}）
        </button>
      </section>

      <section className="review-filters">
        {([
          ["all", "全部"],
          ["due", "待复习"],
          ["unmastered", "需加强"],
          ["favorite", "收藏"],
          ["mastered", "已掌握"],
        ] as const).map(([k, label]) => (
          <button
            key={k}
            className={`review-pill ${filter === k ? "active" : ""}`}
            onClick={() => setFilter(k)}
          >
            {label}
          </button>
        ))}
      </section>

      {items.length === 0 ? (
        <p className="review-empty">暂时没有需要复习的错题。</p>
      ) : (
        <ul className="review-list">
          {items.map((it) => (
            <li key={it.id} className="review-item">
              <div className="review-item-main">
                <span
                  className="review-mastery-dot"
                  style={{ background: MASTERY_COLOR[it.masteryStatus] }}
                />
                <div>
                  <strong>
                    {it.sourceModule === "vocabulary" ? "词汇" : it.sourceModule === "reading" ? "阅读" : "听力"} · {it.questionId}
                  </strong>
                  <small>
                    下次 {shortDate(it.nextReviewAt)} · 复习 {it.reviewCount} 次 ·{" "}
                    <span style={{ color: MASTERY_COLOR[it.masteryStatus] }}>
                      {MASTERY_LABEL[it.masteryStatus]}
                    </span>
                  </small>
                </div>
              </div>
              <div className="review-item-actions">
                <button
                  className="review-icon-btn"
                  onClick={() => toggleFavorite(it.id)}
                  aria-label="收藏"
                >
                  <Star size={16} fill={it.favorite ? "#f08c00" : "none"} color={it.favorite ? "#f08c00" : "#868e96"} />
                </button>
                <button className="review-icon-btn" onClick={() => remove(it.id)} aria-label="移除">
                  <Trash2 size={16} color="#868e96" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <section className="review-manual">
        <h3>手动复习</h3>
        <div className="review-manual-row">
          <button className="secondary-button" disabled={stats.unmastered === 0} onClick={() => beginReview("unmastered")}>
            <Bookmark size={15} /> 需加强（{stats.unmastered}）
          </button>
          <button className="secondary-button" disabled={stats.favorite === 0} onClick={() => beginReview("favorite")}>
            <Star size={15} /> 收藏题（{stats.favorite}）
          </button>
        </div>
      </section>

      <Link href="/review/words" className="review-words-link">
        <CheckCircle2 size={18} /> 我的生词本 →
      </Link>
    </main>
  );
}
