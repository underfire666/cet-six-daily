"use client";
import { translationTaskById } from "@/content/learning";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, Languages, Zap } from "lucide-react";

import { useTranslation } from "./TranslationProvider";
import { todayInShanghai } from "@/lib/dates";
import { examReturnHref } from "@/lib/exam-browse-route";
import { completeExitHref, recordsReturnFromSearch } from "@/lib/exam-records-route";

export function TranslationComplete({ id, onSession, onHome }: { id: string; onSession?: (id: string) => void; onHome?: () => void }) {
  const { ready, store, dailyComplete, start } = useTranslation();
  const router = useRouter();
  const search = useSearchParams().toString();
  const exitHref = completeExitHref(examReturnHref(search) ?? "/practice/exams", search);
  const selectedReturnLabel = recordsReturnFromSearch(search) ? "返回学习记录" : "返回真题题库";
  const session = store.sessions[id];
  const returnToCatalog = () => {
    if (onHome) onHome();
    else router.push(exitHref);
  };

  if (!ready) return <div className="exercise-loading">正在结算…</div>;
  if (!session || !session.applied) {
    return (
      <main className="exercise-gate">
        <h1>这篇翻译还没完成</h1>
        <p>返回翻译页，重新开始吧。</p>
        {onHome ? <button className="exercise-button" onClick={onHome}>返回翻译</button> :
          <Link className="exercise-button" href="/practice/translation">返回翻译</Link>}
      </main>
    );
  }
  const task = translationTaskById(session.taskId)!;
  const selected = session.mode === "selected";
  const completedDate = session.completedAt ? todayInShanghai(new Date(session.completedAt)) : null;
  const sameDayRepeat = Object.values(store.sessions).some((previous) =>
    previous.id !== session.id && previous.applied && previous.taskId === session.taskId &&
    previous.completedAt && session.completedAt && previous.completedAt <= session.completedAt &&
    todayInShanghai(new Date(previous.completedAt)) === completedDate,
  );
  const next = () => {
    if (selected) {
      returnToCatalog();
      return;
    }
    const mode =
      session.mode === "extra" || dailyComplete ? "extra" : "daily";
    const nextId = start(mode);
    if (nextId) {
      if (onSession) onSession(nextId);
      else router.push(`/practice/translation/session/${nextId}`);
    }
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
      {selected && (session.rewardXp ?? 0) === 0 && (
        <p className="subjective-complete-sub" role="status">
          {sameDayRepeat
            ? "这道题今天已计入 XP，重复练习不重复奖励。"
            : "这道题已获得首次奖励，本次巩固未获得表现分。"}
        </p>
      )}
      <div className="subjective-complete-actions">
        <button className="subjective-button" onClick={next}>
          <Languages size={18} />
          {selected ? selectedReturnLabel : session.mode === "daily" && !dailyComplete
            ? "继续下一篇"
            : "再练一篇"}
        </button>
        {selected ? <Link className="subjective-text-button" href="/">返回学习首页</Link> :
          onHome ? <button className="subjective-text-button" onClick={onHome}>返回翻译首页</button> :
            <Link className="subjective-text-button" href="/practice/translation">返回翻译首页</Link>}
      </div>
    </main>
  );
}
