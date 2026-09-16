import Link from "next/link";
import {
  ArrowRight,
  Check,
  Clock3,
  Flag,
  LockKeyhole,
  RotateCw,
  Sparkles,
} from "lucide-react";
import { modules } from "@/data/mock";
import { shortDate } from "@/lib/dates";
import type { Lesson } from "@/types/study";
export function DailyLessonNode({
  lesson,
  onSelect,
}: {
  lesson: Lesson;
  onSelect: (date: string) => void;
}) {
  const locked = lesson.status === "locked";
  const adjusted = lesson.status === "adjusted";
  const completed = lesson.status === "completed";
  const title =
    lesson.status === "today"
      ? "今日学习"
      : completed
        ? "温故，也能知新"
        : adjusted
          ? "换一天，继续前进"
          : "下一步，也准备好了";
  const icon = locked ? (
    <LockKeyhole size={45} />
  ) : completed ? (
    <Check size={52} strokeWidth={3} />
  ) : adjusted ? (
    <RotateCw size={45} />
  ) : (
    <Flag size={49} fill="currentColor" strokeWidth={1.6} />
  );
  const label = locked
    ? `${shortDate(lesson.date)}解锁`
    : adjusted
      ? "查看调整后的计划"
      : completed
        ? "重新练习"
        : "开始学习";
  const href = `/lesson/${lesson.date}`;
  return (
    <section
      className={`lesson-node ${locked || adjusted ? "subdued" : ""}`}
      aria-label="所选日期学习任务"
    >
      <div className="lesson-eyebrow">
        <span />
        {lesson.status === "today"
          ? "YOUR DAILY LITTLE WIN"
          : shortDate(lesson.date)}
      </div>
      <div className="node-scene">
        <span className="orbit-dot dot-one" />
        <span className="orbit-dot dot-two" />
        <Sparkles className="node-spark" size={21} />
        <div
          className={`node-ring ${completed ? "complete-ring" : ""}`}
          data-node-anchor
        >
          {locked ? (
            <button className="round-node" disabled aria-label={label}>
              {icon}
            </button>
          ) : adjusted ? (
            <button
              className="round-node"
              onClick={() => onSelect(lesson.rescheduledTo!)}
              aria-label={label}
            >
              {icon}
            </button>
          ) : (
            <Link className="round-node" href={href} aria-label={label}>
              {icon}
            </Link>
          )}
        </div>
        <span className="node-tag">
          {completed
            ? "已完成"
            : locked
              ? "即将解锁"
              : adjusted
                ? "轻松调整"
                : "准备出发"}
        </span>
      </div>
      <div className="lesson-copy" key={lesson.date} aria-live="polite">
        <h2>{title}</h2>
        <p className="lesson-time">
          <Clock3 size={15} />约 {lesson.minutes} 分钟<span>·</span>
          {shortDate(lesson.date)}
        </p>
        <div className="lesson-modules">
          {lesson.modules.map((key) => (
            <span key={key}>
              {modules.find((module) => module.key === key)!.name}
            </span>
          ))}
        </div>
        {locked ? (
          <button className="primary-button" disabled>
            <LockKeyhole size={16} />
            {label}
          </button>
        ) : adjusted ? (
          <button
            className="primary-button"
            onClick={() => onSelect(lesson.rescheduledTo!)}
          >
            {label}
            <ArrowRight size={17} />
          </button>
        ) : (
          <Link className="primary-button" href={href}>
            {label}
            <ArrowRight size={18} />
          </Link>
        )}
        <p className="lesson-footnote">
          {adjusted
            ? `任务已安排至 ${shortDate(lesson.rescheduledTo!)}，不用着急。`
            : completed
              ? "再练一次，让知识记得更牢。"
              : locked
                ? "每天解锁一点，稳稳向前。"
                : "小小的一步，也算数。"}
        </p>
      </div>
    </section>
  );
}
