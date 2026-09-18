"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, Flame, Sprout, Zap } from "lucide-react";
import { modules } from "@/data/mock";
import {mockLesson} from '@/data/mockLesson';
import {UnmasteredReview,unresolvedQuestions} from './UnmasteredReview';
import { useLearning } from "../LearningProvider";
import { useToday } from "../StudyProvider";
import { LessonDialog } from "./LessonDialog";
export function LessonComplete({ date }: { date: string }) {
  const { ready, sessions, settings, markCelebration, notice } = useLearning();
  const today = useToday();
  const review = useSearchParams().get("review") === "1";
  const key = `${date}:${review ? "review" : "daily"}`;
  const session = sessions[key];
  const router = useRouter();
  const [choose, setChoose] = useState(false);
  const [reviewMistakes,setReviewMistakes]=useState(false);
  const badge = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ready && (date > today || session?.phase !== "complete"))
      router.replace(`/lesson/${date}${review ? "?review=1" : ""}`);
    if (session?.phase === "complete" && !session.celebrationSeen) {
      if (
        settings.celebrationEnabled &&
        !window.matchMedia("(prefers-reduced-motion: reduce)").matches
      )
        badge.current?.animate(
          [
            { transform: "scale(.65)", opacity: 0.3 },
            { transform: "scale(1.08)", opacity: 1, offset: 0.65 },
            { transform: "scale(1)", opacity: 1 },
          ],
          { duration: 1000, easing: "ease-out" },
        );
      markCelebration(key);
    }
  }, [
    ready,
    date,
    today,
    session,
    review,
    router,
    settings.celebrationEnabled,
    markCelebration,
    key,
  ]);
  if (!ready || session?.phase !== "complete" || !session.reward)
    return (
      <div className="exercise-loading" role="status">
        正在整理学习成果…
      </div>
    );
  const unmastered = unresolvedQuestions(session,mockLesson).length;
  return (
    <main className="exercise-complete">
      {notice && <p className="exercise-notice">{notice}</p>}
      <div className="exercise-complete-badge" ref={badge}>
        <Check size={52} strokeWidth={2.7} />
        <span className="exercise-badge-spark">✦</span>
      </div>
      <span className="exercise-eyebrow">每天向前一点</span>
      <h1>{review ? "练习完成" : date === today ? "今日完成" : "学习完成"}</h1>
      <p className="exercise-complete-description">
        又为六级，积累了一点底气。
      </p>
      <div className="exercise-results">
        <div>
          <span>完成度</span>
          <strong>
            100<small>%</small>
          </strong>
        </div>
        <div>
          <span>正确率</span>
          <strong>
            {session.reward.accuracy}
            <small>%</small>
          </strong>
        </div>
        <div>
          <span>
            <Zap size={14} />
            获得 XP
          </span>
          <strong>+{session.reward.xp}</strong>
        </div>
      </div>
      <p className="exercise-accuracy-note">正确率按首轮第一次提交计算。</p>
      <div className="exercise-streak">
        <Flame size={26} />
        <strong>连续学习 {session.reward.streak} 天</strong>
        <Sprout size={22} />
      </div>
      {unmastered > 0 && (
        <button className="exercise-text-button" onClick={()=>setReviewMistakes(true)}>本次未掌握 · {unmastered} 个知识点 →</button>
      )}
      {session.reward.xp === 0 && (
        <p className="exercise-subtle">
          复习不重复计奖，每个学习日最多获得一次奖励。
        </p>
      )}
      <div className="exercise-complete-actions">
        <button className="exercise-button" onClick={() => setChoose(true)}>
          今天再学一点
        </button>
        <Link className="exercise-text-button" href={`/?date=${date}`}>
          返回首页
        </Link>
      </div>
      {reviewMistakes && <UnmasteredReview session={session} lesson={mockLesson} onClose={()=>setReviewMistakes(false)}/>}
      {choose && (
        <LessonDialog title="想再练哪一项？" onClose={() => setChoose(false)}>
          <div className="exercise-module-list">
            {modules.map((module) => (
              <Link key={module.key} href={`/practice/${module.key}`}>
                <span>{module.name}</span>
                <span aria-hidden="true">→</span>
              </Link>
            ))}
          </div>
        </LessonDialog>
      )}
    </main>
  );
}
