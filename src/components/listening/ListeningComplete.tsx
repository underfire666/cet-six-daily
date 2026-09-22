"use client";
import { listeningMaterialById } from "@/content/learning";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Headphones, Repeat, Zap } from "lucide-react";

import { listeningLesson } from "@/lib/listening/questions";
import { unresolvedQuestions } from "../lesson/UnmasteredReview";
import { useListening } from "./ListeningProvider";

export function ListeningComplete({ id }: { id: string }) {
  const { ready, store, dailyComplete, start } = useListening();
  const router = useRouter();
  const session = store.sessions[id];
  const nextGroup = () => {
    const mode =
      session?.mode === "extra" || dailyComplete ? "extra" : "daily";
    const nextId = start(mode);
    if (nextId) router.push(`/practice/listening/session/${nextId}`);
  };
  if (!ready) return <div className="exercise-loading">正在准备听力…</div>;
  if (!session || !session.applied)
    return (
      <main className="exercise-gate">
        <h1>这组听力还没完成</h1>
        <p>返回听力页，选择一组开始吧。</p>
        <Link className="exercise-button" href="/practice/listening">
          返回听力
        </Link>
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
      <div className="listening-complete-actions">
        <button className="listening-button" onClick={nextGroup}>
          <Headphones size={18} />
          {session.mode === "daily" && !dailyComplete
            ? "继续下一组"
            : "今天再听一组"}
        </button>
        <Link className="listening-text-button" href="/practice/listening">
          返回听力首页
        </Link>
      </div>
    </main>
  );
}
