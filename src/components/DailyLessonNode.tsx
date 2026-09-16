import Link from "next/link";
import {
  ArrowRight,
  Check,
  Clock3,
  Flag,
  LockKeyhole,
  RotateCw,
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
        ? "已完成学习"
        : adjusted
          ? "学习已调整"
          : "学习计划";
  const icon = locked ? (
    <LockKeyhole size={40} />
  ) : completed ? (
    <Check size={44} strokeWidth={3} />
  ) : adjusted ? (
    <RotateCw size={40} />
  ) : (
    <Flag size={44} fill="currentColor" strokeWidth={1.6} />
  );
  const label = locked
    ? `${shortDate(lesson.date)}解锁`
    : adjusted
      ? "查看调整后的计划"
      : completed
        ? "重新练习"
        : lesson.inProgress
          ? "继续学习"
          : "开始学习";
  const href = `/lesson/${lesson.date}${completed ? "?review=1" : ""}`;
  return (
    <section
      className={`lesson-node ${locked || adjusted ? "subdued" : ""}`}
      aria-label="所选日期学习任务"
    >
      <div className="node-scene" data-node-anchor>
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
      </div>
      <div className="lesson-action">
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
        {adjusted && (
          <p className="lesson-footnote">
            已安排至 {shortDate(lesson.rescheduledTo!)}
          </p>
        )}
      </div>
    </section>
  );
}
