"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Sparkles, Sprout } from "lucide-react";
import { mockLesson } from "@/data/mockLesson";
import { currentQuestion, sessionProgress } from "@/lib/lesson/session";
import { playFeedback } from "@/lib/lesson/feedback";
import { shortDate } from "@/lib/dates";
import { useLearning } from "../LearningProvider";
import { useToday } from "../StudyProvider";
import { LessonProgress } from "./LessonProgress";
import { QuestionRenderer } from "./QuestionRenderer";
import { AnswerFeedback } from "./AnswerFeedback";
import { AiHint, LessonExitDialog } from "./LessonDialog";
import type { SessionMode } from "@/types/session";

export function LessonEntry({ date }: { date: string }) {
  const learning = useLearning();
  const review = useSearchParams().get("review") === "1";
  const today = useToday();
  if (!learning.ready)
    return (
      <div className="exercise-loading" role="status">
        正在准备你的学习…
      </div>
    );
  const lesson = learning.getLesson(date);
  if (date > today || lesson.status === "adjusted")
    return (
      <main className="exercise-gate">
        <Sprout size={44} />
        <h1>{date > today ? "这一天，还没开始" : "学习已调整"}</h1>
        <p>
          {date > today
            ? `${shortDate(date)}解锁，到时候一起学习。`
            : `已安排至 ${shortDate(lesson.rescheduledTo!)}。`}
        </p>
        <Link
          className="exercise-button"
          href={`/?date=${date > today ? date : lesson.rescheduledTo}`}
        >
          返回首页
        </Link>
      </main>
    );
  const seeded =
    date < learning.profile.anchorDate &&
    lesson.status === "completed" &&
    !learning.profile.completedLessons[date];
  return (
    <LessonPlayer
      key={`${date}:${review || seeded ? "review" : "daily"}`}
      date={date}
      mode={review || seeded ? "review" : "daily"}
    />
  );
}
function LessonPlayer({ date, mode }: { date: string; mode: SessionMode }) {
  const { sessions, start, dispatch, settings, notice } = useLearning();
  const today = useToday();
  const router = useRouter();
  const key = `${date}:${mode}`;
  const session = sessions[key];
  const startedId = useRef<string | undefined>(undefined);
  const [dialog, setDialog] = useState<"hint" | "exit" | null>(null);
  useEffect(() => {
    startedId.current = start(date, mode);
  }, [date, mode, start]);
  useEffect(() => {
    if (session?.phase === "complete" && session.id === startedId.current)
      router.replace(
        `/lesson/${date}/complete${mode === "review" ? "?review=1" : ""}`,
      );
  }, [session?.phase, session?.id, date, mode, router]);
  if (!session || session.phase === "complete")
    return (
      <div className="exercise-loading" role="status">
        正在准备你的学习…
      </div>
    );
  const question = currentQuestion(session, mockLesson)!;
  const sendContinue = () =>
    dispatch(key, { type: "continue", today, now: new Date().toISOString() });
  const onAction = () => {
    if (session.phase === "feedback") sendContinue();
    else if (session.selected) {
      playFeedback(session.selected === question.answerId, settings);
      dispatch(key, { type: "check" });
    }
  };
  return (
    <div className="exercise-layout">
      <LessonProgress
        progress={sessionProgress(session, mockLesson)}
        onExit={() => setDialog("exit")}
      />
      <main
        className="exercise-body"
        key={`${question.id}:${session.round}:${session.phase === "review_intro"}`}
      >
        {notice && (
          <p className="exercise-notice" role="status">
            {notice}
          </p>
        )}
        {session.phase === "review_intro" ? (
          <section className="exercise-review-intro">
            <div className="exercise-leaf">
              <Sprout size={38} />
            </div>
            <span className="exercise-eyebrow">再巩固一下</span>
            <h1>
              把刚才的知识，
              <br />
              再用一次。
            </h1>
            <p>
              接下来回顾刚才没答对的内容。
              <br />
              每道题再试一次，然后就完成今天的学习。
            </p>
            <blockquote>
              小方法：先读完整句，再找到支撑答案的关键词。
            </blockquote>
          </section>
        ) : (
          <>
            {session.round === "retest" && (
              <p className="exercise-retest-label">巩固练习</p>
            )}
            <QuestionRenderer
              question={question}
              selected={session.selected}
              disabled={session.phase === "feedback"}
              onSelect={(optionId) =>
                dispatch(key, { type: "select", optionId })
              }
            />
            {session.phase !== "feedback" && (
              <button
                className="exercise-ai"
                onClick={() => {
                  dispatch(key, { type: "hint" });
                  setDialog("hint");
                }}
              >
                <Sparkles size={17} />问 AI
              </button>
            )}
          </>
        )}
      </main>
      {session.phase === "review_intro" ? (
        <footer className="exercise-footer">
          <div className="exercise-footer-inner">
            <button className="exercise-button" onClick={sendContinue}>
              开始巩固
            </button>
          </div>
        </footer>
      ) : (
        <AnswerFeedback
          key={`${question.id}:${session.round}`}
          session={session}
          question={question}
          onAction={onAction}
        />
      )}
      {dialog === "hint" && (
        <AiHint hint={question.hint} onClose={() => setDialog(null)} />
      )}
      {dialog === "exit" && (
        <LessonExitDialog
          onClose={() => setDialog(null)}
          onExit={() => router.push(`/?date=${date}`)}
        />
      )}
    </div>
  );
}
