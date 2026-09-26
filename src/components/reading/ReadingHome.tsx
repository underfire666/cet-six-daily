"use client";
import Link from "next/link";
import { ArrowLeft, BookOpen, Check } from "lucide-react";
import { useReading } from "./ReadingProvider";
import { useLocalPracticeRoute } from "@/components/practice/useLocalPracticeRoute";
import { ReadingSessionPlayer } from "./ReadingSessionPlayer";
import { ReadingComplete } from "./ReadingComplete";

export function ReadingHome() {
  const route = useLocalPracticeRoute("reading");
  if (route.stage.kind === "session") {
    const id = route.stage.id;
    return <ReadingSessionPlayer id={id} onComplete={() => route.openComplete(id)} onExit={route.goHome} />;
  }
  if (route.stage.kind === "complete")
    return <ReadingComplete id={route.stage.id} onSession={route.openSession} onHome={route.goHome} />;
  return <ReadingDashboard onSession={route.openSession} />;
}

function ReadingDashboard({ onSession }: { onSession: (id: string) => void }) {
  const reading = useReading();
  const done = reading.progress.completedArticleIds.length;
  const total = reading.progress.articleIds.length;
  const completed = reading.dailyComplete;
  const begin = (mode: "daily" | "extra") => {
    const id = reading.start(mode);
    if (id) onSession(id);
  };
  const main = () => {
    if (reading.active) {
      onSession(reading.active.id);
      return;
    }
    if (!completed) begin("daily");
    else begin("extra");
  };
  const mainLabel = reading.active ? "继续阅读" : completed ? "继续阅读" : "开始阅读";
  return (
    <main className="reading-page">
      <header className="reading-heading">
        <Link href="/" aria-label="返回首页">
          <ArrowLeft size={19} />
        </Link>
        <h1>阅读</h1>
      </header>
      {reading.notice && <p className="reading-notice">{reading.notice}</p>}
      <section className="reading-today">
        <div className="reading-section-title">
          <span>
            <BookOpen size={18} />
            今日阅读
          </span>
          <small>每天一点，读懂六级文章</small>
        </div>
        <div className="reading-count">
          <strong>{done}</strong>
          <span>/ {total} 篇</span>
          {completed && <span className="reading-done-flag">✓ 完成</span>}
        </div>
        <p className="reading-sub">
          {completed
            ? "今日任务完成，再读一篇也不多。"
            : total === 0 ? "暂无可用阅读内容，请稍后再试。" : total < 3 ? `当前可用 ${total} 篇，先完成这些内容。` : "读完 3 篇短文，顺便收获生词。"}
        </p>
        <div className="reading-bar" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done}>
          <span style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
        </div>
        <div className="reading-actions">
          <button className="reading-button" onClick={main} disabled={!reading.ready || !total}>
            <BookOpen size={18} />
            {mainLabel}
          </button>
        </div>
        {reading.previousDaily && reading.previousDaily.id !== reading.active?.id && (
          <button
            className="reading-text-button"
            onClick={() =>
              onSession(reading.previousDaily!.id)
            }
          >
            继续 {reading.previousDaily.planDate} 未完成的阅读
          </button>
        )}
        <div className="reading-extra-stats">
          <span>
            额外阅读 <strong>{reading.dayStats.extra}</strong> 篇
          </span>
          <span>
            今日阅读 <strong>+{reading.dayStats.xp} XP</strong>
          </span>
        </div>
        <Link
          className="reading-text-button"
          href="/practice/vocabulary/wordbook"
        >
          <Check size={14} />
          查看我的生词
        </Link>
      </section>
    </main>
  );
}
