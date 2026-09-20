"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, NotebookPen, Zap } from "lucide-react";
import { useWriting } from "./WritingProvider";

export function WritingComplete({ id }: { id: string }) {
  const { ready, store, dailyComplete, start } = useWriting();
  const router = useRouter();
  const session = store.sessions[id];

  if (!ready) return <div className="exercise-loading">正在结算…</div>;
  if (!session || !session.applied) {
    return (
      <main className="exercise-gate">
        <h1>这篇写作还没完成</h1>
        <p>返回写作页，重新开始吧。</p>
        <Link className="exercise-button" href="/practice/writing">
          返回写作
        </Link>
      </main>
    );
  }
  const next = () => {
    const mode =
      session.mode === "extra" || dailyComplete ? "extra" : "daily";
    const nextId = start(mode);
    if (nextId) router.push(`/practice/writing/session/${nextId}`);
  };
  return (
    <main className="subjective-complete">
      <div className="subjective-complete-badge">
        <Check size={42} strokeWidth={2.7} />
      </div>
      <h1>写作完成</h1>
      <p className="subjective-complete-sub">又写出一篇，表达更像六级作文。</p>
      <div className="subjective-stats">
        <div className="subjective-stat">
          <span>六级估分</span>
          <strong>
            {session.feedback?.score} / {session.feedback?.maxScore}
          </strong>
        </div>
        <div className="subjective-stat">
          <span>字数</span>
          <strong>{session.wordCount ?? 0}</strong>
        </div>
        <div className="subjective-stat">
          <span>主要问题</span>
          <strong>{session.feedback?.issues.length ?? 0} 条</strong>
        </div>
      </div>
      <div className="subjective-xp">
        <span>
          <Zap size={16} style={{ verticalAlign: -2 }} />
          本次写作
        </span>
        <strong>+{session.rewardXp ?? 0} XP</strong>
      </div>
      <div className="subjective-complete-actions">
        <button className="subjective-button" onClick={next}>
          <NotebookPen size={18} />
          {session.mode === "daily" && !dailyComplete
            ? "继续下一篇"
            : "再写一篇"}
        </button>
        <Link className="subjective-text-button" href="/practice/writing">
          返回写作首页
        </Link>
      </div>
    </main>
  );
}
