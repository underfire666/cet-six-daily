"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, Zap } from "lucide-react";
import { useVocabulary } from "./VocabularyProvider";
import { useLearning } from "../LearningProvider";
import {
  UnmasteredReview,
  unresolvedQuestions,
} from "../lesson/UnmasteredReview";
import { batchProgress } from "@/lib/vocabulary/store";
import { ExtraLearningDialog } from "./ExtraLearningDialog";
export function VocabularyComplete({ id }: { id: string }) {
  const { ready, store, start, dailyComplete } = useVocabulary();
  const { settings } = useLearning();
  const router = useRouter();
  const [mistakes, setMistakes] = useState(false);
  const [extraOpen, setExtraOpen] = useState(false);
  const badge = useRef<HTMLDivElement>(null);
  const session = store.sessions[id];
  useEffect(() => {
    if (ready && session && session.phase !== "complete")
      router.replace(`/practice/vocabulary/session/${id}`);
  }, [ready, session, id, router]);
  useEffect(() => {
    if (
      session?.phase === "complete" &&
      settings.celebrationEnabled &&
      !matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      badge.current?.animate(
        [
          { transform: "scale(.7)", opacity: 0.3 },
          { transform: "scale(1.05)", opacity: 1, offset: 0.7 },
          { transform: "scale(1)", opacity: 1 },
        ],
        { duration: 1000 },
      );
  }, [session?.phase, settings.celebrationEnabled]);
  if (!ready) return <div className="exercise-loading">正在整理成果…</div>;
  if (!session)
    return (
      <main className="exercise-gate">
        <h1>这份学习记录已无法读取</h1>
        <Link href="/practice/vocabulary" className="exercise-button">
          返回词汇
        </Link>
      </main>
    );
  if (session.phase !== "complete")
    return <div className="exercise-loading">正在返回练习…</div>;
  const unresolved = unresolvedQuestions(
    session.lesson,
    session.definition,
  ).length;
  const batch = session.batchId ? store.batches[session.batchId] : undefined;
  const summary = batch ? batchProgress(store, batch.id) : undefined;
  const batchComplete = !!batch && summary!.completed >= batch.target;
  const rewardXp = batchComplete ? summary!.xp : (session.rewardXp ?? 0);
  const resultSessions = batchComplete
    ? batch.sessionIds.map((sid) => store.sessions[sid])
    : [session];
  const learned = resultSessions.reduce((n, s) => n + s.wordIds.length, 0);
  const independent = resultSessions.reduce(
    (n, s) =>
      n +
      Object.values(s.lesson.records).filter(
        (r) => r.initialResult === "first_try_correct",
      ).length,
    0,
  );
  const again = () => {
    if (batchComplete || (session.mode === "learn" && dailyComplete)) {
      setExtraOpen(true);
      return;
    }
    const next = start(
      session.mode,
      session.mode === "single_review" ? session.wordIds[0] : undefined,
    );
    router.push(
      next ? `/practice/vocabulary/session/${next}` : "/practice/vocabulary",
    );
  };
  return (
    <main className="exercise-complete">
      <div className="exercise-complete-badge" ref={badge}>
        <Check size={52} />
      </div>
      <span className="exercise-eyebrow">又记牢一点</span>
      <h1>
        {batchComplete
          ? "额外学习完成"
          : batch
            ? "本组词汇完成"
            : "本次词汇完成"}
      </h1>
      <p className="exercise-complete-description">
        {batch
          ? `本批次 ${summary!.completed} / ${batch.target} 个 · 已计入额外学习`
          : "这些词，正在慢慢变熟悉。"}
      </p>
      <div className="exercise-results">
        <div>
          <span>
            {batchComplete
              ? "本批次学习"
              : session.mode === "learn" || session.mode === "extra"
                ? "本组学习"
                : "复习"}
          </span>
          <strong>
            {learned}
            <small>个</small>
          </strong>
        </div>
        <div>
          <span>独立答对</span>
          <strong>{independent}</strong>
        </div>
        <div>
          <span>需要加强</span>
          <strong>{learned - independent}</strong>
        </div>
      </div>
      <p className="exercise-accuracy-note">
        独立答对指未使用提示、首次提交正确。
      </p>
      <div className="exercise-streak">
        <Zap size={23} />
        <strong>
          +{rewardXp} XP
          {batchComplete ? " · 本批次" : ""}
        </strong>
      </div>
      {rewardXp === 0 && (
        <p className="exercise-subtle">
          {batchComplete ? "本批次" : "本组"}为已学词巩固，相关单词今日已获得 XP，不重复奖励。
        </p>
      )}
      <p className="exercise-subtle">已更新掌握记录和下次复习时间。</p>
      {unresolved > 0 && (
        <button
          className="exercise-text-button"
          onClick={() => setMistakes(true)}
        >
          {batch ? "本组未掌握" : "本次未掌握"} · {unresolved} 个词 →
        </button>
      )}
      <div className="exercise-complete-actions">
        <button className="exercise-button" onClick={again}>
          {batchComplete ? "继续再学一组" : batch ? "继续本批次" : "继续学习"}
        </button>
        <Link href="/practice/vocabulary" className="exercise-text-button">
          返回词汇首页
        </Link>
        <Link
          href="/practice/vocabulary/wordbook"
          className="exercise-text-button"
        >
          查看生词本
        </Link>
      </div>
      {mistakes && (
        <UnmasteredReview
          session={session.lesson}
          lesson={session.definition}
          onClose={() => setMistakes(false)}
        />
      )}
      {extraOpen && <ExtraLearningDialog onClose={() => setExtraOpen(false)} />}
    </main>
  );
}
