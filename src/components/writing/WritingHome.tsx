"use client";
import Link from "next/link";
import { ArrowLeft, History, NotebookPen } from "lucide-react";
import { useWriting } from "./WritingProvider";
import { useLocalPracticeRoute } from "@/components/practice/useLocalPracticeRoute";
import { WritingSessionPlayer } from "./WritingSessionPlayer";
import { WritingComplete } from "./WritingComplete";

export function WritingHome() {
  const route = useLocalPracticeRoute("writing");
  if (route.stage.kind === "session") {
    const id = route.stage.id;
    return <WritingSessionPlayer id={id} onComplete={() => route.openComplete(id)} onExit={route.goHome} />;
  }
  if (route.stage.kind === "complete")
    return <WritingComplete id={route.stage.id} onSession={route.openSession} onHome={route.goHome} />;
  return <WritingDashboard onSession={route.openSession} />;
}

function WritingDashboard({ onSession }: { onSession: (id: string) => void }) {
  const w = useWriting();
  const done = w.progress.completedTaskIds.length;
  const total = w.progress.taskIds.length;
  const completed = w.dailyComplete;

  const begin = (mode: "daily" | "extra") => {
    const id = w.start(mode);
    if (id) onSession(id);
  };
  const main = () => {
    if (w.active) {
      onSession(w.active.id);
      return;
    }
    if (!completed) begin("daily");
    else begin("extra");
  };
  const mainLabel = w.active ? "继续写作" : completed ? "再写一篇" : "开始写作";

  return (
    <main className="subjective-page">
      <header className="subjective-heading">
        <Link href="/" aria-label="返回首页">
          <ArrowLeft size={19} />
        </Link>
        <h1>写作</h1>
      </header>
      {w.notice && <p className="subjective-notice">{w.notice}</p>}
      {w.ready && !total && <p className="subjective-notice">暂无可用写作内容，请稍后再试。</p>}
      <section className="subjective-today">
        <div className="subjective-section-title">
          <span>
            <NotebookPen size={18} />
            今日写作
          </span>
          <small>每天写一点，让表达越来越像六级作文</small>
        </div>
        <div className="subjective-count">
          <strong>{done}</strong>
          <span>/ {total} 篇</span>
          {completed && <span className="subjective-done-flag">✓ 完成</span>}
        </div>
        <p className="subjective-sub">
          {completed ? "今日任务完成，再写一篇也不错。" : "先把今天这一篇写完。"}
        </p>
        <div
          className="subjective-bar"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={done}
        >
          <span style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
        </div>
        <div className="subjective-actions">
          <button
            className="subjective-button"
            onClick={main}
            disabled={!w.ready || !total}
          >
            <NotebookPen size={18} />
            {mainLabel}
          </button>
        </div>
        {w.previousDaily && w.previousDaily.id !== w.active?.id && (
          <button
            className="subjective-text-button"
            onClick={() =>
              onSession(w.previousDaily!.id)
            }
          >
            继续 {w.previousDaily.planDate} 未完成的写作
          </button>
        )}
        {w.extraActive && !completed && (
          <button
            className="subjective-text-button"
            onClick={() =>
              onSession(w.extraActive!.id)
            }
          >
            继续未完成的额外写作
          </button>
        )}
        <div className="subjective-extra-stats">
          <span>
            今日额外写作 <strong>{w.dayStats.extra}</strong> 篇
          </span>
          <span>
            今日写作 <strong>+{w.dayStats.xp} XP</strong>
          </span>
        </div>
        {w.history.length > 0 && (
          <div className="subjective-history-block">
            <div className="subjective-history-title">
              <History size={14} />
              最近 {Math.min(3, w.history.length)} 次
            </div>
            {w.history.slice(-3).reverse().map((entry, i) => {
              const realIndex = w.history.length - 1 - i;
              return (
                <div key={realIndex} className="subjective-history-item">
                  <span>{new Date(entry.createdAt).toLocaleDateString("zh-CN")}</span>
                  <span>
                    {entry.score} / {entry.feedback.maxScore} · {entry.wordCount} 词
                  </span>
                  {entry.sessionId && (
                    <button
                      className="subjective-link-button"
                      onClick={() =>
                        onSession(entry.sessionId!)
                      }
                    >
                      查看
                    </button>
                  )}
                  <button
                    className="subjective-link-button"
                    onClick={() => w.removeHistory(realIndex)}
                  >
                    删除
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
