"use client";
import { listeningMaterialById } from "@/content/learning";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, Headphones, Repeat, Zap } from "lucide-react";

import { listeningLesson } from "@/lib/listening/questions";
import { todayInShanghai } from "@/lib/dates";
import { examReturnHref } from "@/lib/exam-browse-route";
import { completeExitHref, recordsReturnFromSearch } from "@/lib/exam-records-route";
import { unresolvedQuestions } from "../lesson/UnmasteredReview";
import { useListening } from "./ListeningProvider";

export function ListeningComplete({ id, onSession, onHome }: { id: string; onSession?: (id: string) => void; onHome?: () => void }) {
  const { ready, store, dailyComplete, start } = useListening();
  const router = useRouter();
  const search = useSearchParams().toString();
  const exitHref = completeExitHref(examReturnHref(search) ?? "/practice/exams", search);
  const selectedReturnLabel = recordsReturnFromSearch(search) ? "返回学习记录" : "返回真题题库";
  const session = store.sessions[id];
  const returnToCatalog = () => {
    if (onHome) onHome();
    else router.push(exitHref);
  };
  const nextGroup = () => {
    if (session?.mode === "selected") {
      returnToCatalog();
      return;
    }
    const mode =
      session?.mode === "extra" || dailyComplete ? "extra" : "daily";
    const nextId = start(mode);
    if (nextId) {
      if (onSession) onSession(nextId);
      else router.push(`/practice/listening/session/${nextId}`);
    }
  };
  if (!ready) return <div className="exercise-loading">正在准备听力…</div>;
  if (!session || !session.applied)
    return (
      <main className="exercise-gate">
        <h1>这组听力还没完成</h1>
        <p>返回听力页，选择一组开始吧。</p>
        {onHome ? <button className="exercise-button" onClick={onHome}>返回听力</button> :
          <Link className="exercise-button" href="/practice/listening">返回听力</Link>}
      </main>
    );
  const material = listeningMaterialById(session.materialId)!;
  const definition = listeningLesson(material);
  const firstTry = definition.questions.filter(
    (q) => session.lesson.records[q.id]?.initialResult === "first_try_correct",
  ).length;
  const retryMastered = definition.questions.filter((q) => {
    const r = session.lesson.records[q.id]?.initialResult;
    return r === "second_try_correct" || r === "ai_hint_correct";
  }).length;
  const needImprove = unresolvedQuestions(session.lesson, definition).length;
  const collected = session.collectedWordIds.length;
  const selected = session.mode === "selected";
  const completedDate = session.completedAt ? todayInShanghai(new Date(session.completedAt)) : null;
  const sameDayRepeat = Object.values(store.sessions).some((previous) =>
    previous.id !== session.id && previous.applied && previous.materialId === session.materialId &&
    previous.completedAt && session.completedAt && previous.completedAt <= session.completedAt &&
    todayInShanghai(new Date(previous.completedAt)) === completedDate,
  );
  return (
    <main className="listening-complete">
      <div className="listening-complete-badge">
        <Check size={42} strokeWidth={2.7} />
      </div>
      <h1>听力完成</h1>
      <p className="listening-complete-sub">又听懂一组英语，耳朵更近一步。</p>
      <div className="listening-stats">
        <div className="listening-stat">
          <span>首次答对</span>
          <strong>{firstTry} 题</strong>
        </div>
        <div className="listening-stat">
          <span>重试掌握</span>
          <strong>{retryMastered} 题</strong>
        </div>
        <div className="listening-stat">
          <span>仍需加强</span>
          <strong>{needImprove} 题</strong>
        </div>
        <div className="listening-stat">
          <span>本组生词</span>
          <strong>{collected} 个</strong>
        </div>
      </div>
      <div className="listening-extra-row">
        <span>
          <Repeat size={15} style={{ verticalAlign: -2 }} /> 播放{" "}
          {session.playCount} 次
        </span>
        {session.transcriptViewedBeforeAnswer && (
          <small>答题前看过原文</small>
        )}
      </div>
      <div className="listening-xp">
        <span>
          <Zap size={16} style={{ verticalAlign: -2 }} />
          本组听力
        </span>
        <strong>+{session.rewardXp ?? 0} XP</strong>
      </div>
      {selected && (session.rewardXp ?? 0) === 0 && (
        <p className="listening-complete-sub" role="status">
          {sameDayRepeat
            ? "这组题今天已计入 XP，重复练习不重复奖励。"
            : "这组题已获得首次奖励，本次巩固未获得答题表现分。"}
        </p>
      )}
      <div className="listening-complete-actions">
        <button className="listening-button" onClick={nextGroup}>
          <Headphones size={18} />
          {selected ? selectedReturnLabel : session.mode === "daily" && !dailyComplete
            ? "继续下一组"
            : "今天再听一组"}
        </button>
        {selected ? <Link className="listening-text-button" href="/">返回学习首页</Link> :
          onHome ? <button className="listening-text-button" onClick={onHome}>返回听力首页</button> :
            <Link className="listening-text-button" href="/practice/listening">返回听力首页</Link>}
      </div>
    </main>
  );
}
