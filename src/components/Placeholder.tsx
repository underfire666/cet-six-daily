"use client";
import Link from "next/link";
import {
  ArrowLeft,
  BookOpen,
  Flag,
  LockKeyhole,
  Sparkles,
  UserRound,
} from "lucide-react";
import { getLesson, modules } from "@/data/mock";
import { shortDate } from "@/lib/dates";
import { useToday } from "./StudyProvider";
import { TopStatus } from "./TopStatus";
export function Placeholder({
  kind,
  value,
}: {
  kind: "lesson" | "practice" | "ai" | "me";
  value?: string;
}) {
  const today = useToday();
  const lesson = kind === "lesson" && value ? getLesson(value, today) : null;
  const practiceModule = modules.find((item) => item.key === value);
  const locked = lesson?.status === "locked";
  const adjusted = lesson?.status === "adjusted";
  const title = lesson
    ? locked
      ? `${shortDate(value!)}解锁`
      : adjusted
        ? "这一天的任务已调整"
        : lesson.status === "completed"
          ? "重新练习"
          : "今日学习关卡"
    : kind === "practice"
      ? `${practiceModule?.name}专项练习`
      : kind === "ai"
        ? "你的 AI 学习伙伴"
        : "我的学习空间";
  const description = lesson
    ? adjusted
      ? `任务已安排至 ${shortDate(lesson.rescheduledTo!)}，按照自己的节奏继续就好。`
      : locked
        ? "可以提前看看计划，到这一天再一起出发。"
        : "学习关卡已经准备好。答题内容将在后续版本与你见面。"
    : kind === "practice"
      ? practiceModule!.description
      : kind === "ai"
        ? "未来，在这里获得练习建议与表达灵感。"
        : "未来，在这里回顾你的成长与学习记录。";
  const Icon = locked
    ? LockKeyhole
    : lesson
      ? Flag
      : kind === "ai"
        ? Sparkles
        : kind === "me"
          ? UserRound
          : BookOpen;
  return (
    <>
      <TopStatus />
      <main className="placeholder-page">
        <span className="eyebrow">
          {lesson ? shortDate(value!) : "慢慢来，一起进步"}
        </span>
        <div className="placeholder-icon">
          <Icon size={46} />
        </div>
        <h1>{title}</h1>
        <p>{description}</p>
        {lesson && (
          <div className="placeholder-plan">
            约 {lesson.minutes} 分钟 ·{" "}
            {lesson.modules
              .map((key) => modules.find((item) => item.key === key)!.name)
              .join(" · ")}
          </div>
        )}
        <span className="preview-label">
          {locked ? "当天解锁后即可开始" : "功能预览 · 敬请期待"}
        </span>
        {adjusted && (
          <Link
            className="primary-button"
            href={`/?date=${lesson.rescheduledTo}`}
          >
            查看调整后的计划
          </Link>
        )}
        <Link
          className={adjusted ? "back-link" : "primary-button"}
          href={lesson ? `/?date=${value}` : "/"}
        >
          <ArrowLeft size={17} />
          返回首页
        </Link>
      </main>
    </>
  );
}
