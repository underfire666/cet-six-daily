"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Languages, Zap } from "lucide-react";
import { translationTaskById } from "@/data/mockTranslation";
import { useTranslation } from "./TranslationProvider";

export function TranslationComplete({ id }: { id: string }) {
  const { ready, store, dailyComplete, start } = useTranslation();
  const router = useRouter();
  const session = store.sessions[id];

  if (!ready) return <div className="exercise-loading">正在结算…</div>;
  if (!session || !session.applied) {
    return (
      <main className="exercise-gate">
        <h1>这篇翻译还没完成</h1>
        <p>返回翻译页，重新开始吧。</p>
        <Link className="exercise-button" href="/practice/translation">
          返回翻译
        </Link>
      </main>
    );
  }
  const task = translationTaskById(session.taskId)!;
  const next = () => {
    const mode =
      session.mode === "extra" || dailyComplete ? "extra" : "daily";
    const nextId = start(mode);
    if (nextId) router.push(`/practice/translation/session/${nextId}`);
  };
  return (
    <main className="subjective-complete">
      <div className="subjective-complete-badge">
        <Check size={42} strokeWidth={2.7} />
      </div>
      <h1>翻译完成</h1>
      <p className="subjective-complete-sub">又译完一段，英文表达更近一步。</p>
      <div className="subjective-stats">
        <div className="subjective-stat">
          <span>六级估分</span>
          <strong>
            {session.feedback?.score} / {session.feedback?.maxScore}
          </strong>
        </div>
        <div className="subjective-stat">
          <span>主要问题</span>
          <strong>{session.feedback?.issues.length ?? 0} 条</strong>
        </div>
        <div className="subjective-stat">
          <span>题目</span>
          <strong>{task.title}</strong>
        </div>
      </div>
      <div className="subjective-xp">
        <span>
          <Zap size={16} style={{ verticalAlign: -2 }} />
          本次翻译
        </span>
        <strong>+{session.rewardXp ?? 0} XP</strong>
      </div>
      <div className="subjective-complete-actions">
        <button className="subjective-button" onClick={next}>
          <Languages size={18} />
          {session.mode === "daily" && !dailyComplete
            ? "继续下一篇"
            : "再练一篇"}
        </button>
        <Link
          className="subjective-text-button"
          href="/practice/translation"
        >
          返回翻译首页
        </Link>
      </div>
    </main>
  );
}
