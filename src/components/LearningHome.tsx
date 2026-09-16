"use client";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowUpRight, CalendarDays, Sprout } from "lucide-react";
import { countdownText, shiftMonth, validDate } from "@/lib/dates";
import { getLesson, mockExamDate, mockUser } from "@/data/mock";
import { useToday } from "./StudyProvider";
import { TopStatus } from "./TopStatus";
import { StudyCalendar } from "./StudyCalendar";
import { DailyLessonNode } from "./DailyLessonNode";
import { PracticeModules } from "./PracticeModules";
function ExamCountdown({ today }: { today: string }) {
  return (
    <div className="exam-countdown">
      <CalendarDays size={17} />
      <span>{countdownText(today, mockExamDate)}</span>
      <span className="exam-dot" />
    </div>
  );
}
export function LearningHome() {
  const today = useToday();
  const query = useSearchParams().get("date");
  const selected = query && validDate(query) ? query : today;
  const month = selected.slice(0, 7);
  const stageRef = useRef<HTMLDivElement>(null);
  const [path, setPath] = useState("");
  const select = (date: string) => {
    window.history.replaceState(
      null,
      "",
      date === today ? "/" : `/?date=${date}`,
    );
  };
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const measure = () => {
      const cell = stage.querySelector(`[data-date="${selected}"]`);
      const node = stage.querySelector("[data-node-anchor]");
      if (!cell || !node) {
        setPath("");
        return;
      }
      const outer = stage.getBoundingClientRect();
      const a = cell.getBoundingClientRect();
      const b = node.getBoundingClientRect();
      if (window.innerWidth >= 768) {
        const x = a.right - outer.left + 3;
        const y = a.top + a.height / 2 - outer.top;
        const endX = b.left - outer.left;
        const endY = b.top + b.height / 2 - outer.top;
        setPath(
          `M ${x} ${y} C ${x + 65} ${y}, ${endX - 90} ${endY}, ${endX} ${endY}`,
        );
      } else {
        const x = a.left + a.width / 2 - outer.left;
        const y = a.bottom - outer.top;
        const endX = b.left + b.width / 2 - outer.left;
        const endY = b.top - outer.top;
        setPath(
          `M ${x} ${y} C ${x} ${y + 45}, ${endX} ${endY - 70}, ${endX} ${endY}`,
        );
      }
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(stage);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [selected, month]);
  return (
    <>
      <TopStatus />
      <main className="home">
        <section className="welcome">
          <div>
            <div className="eyebrow">A LITTLE EVERY DAY</div>
            <h1>
              {mockUser.nickname}，今天也向前一点
              <span className="greeting-dot">.</span>
            </h1>
            <p>不必一口气走很远，每天一点就很好。</p>
          </div>
          <ExamCountdown today={today} />
        </section>
        <section className="journey">
          <div className="journey-heading">
            <div>
              <span className="chapter-label">CET-6</span>
              <span className="journey-title">你的每日学习路线</span>
            </div>
            <span className="journey-caption">
              <Sprout size={15} />
              让努力慢慢发芽
            </span>
          </div>
          <div className="study-stage" ref={stageRef}>
            <svg className="journey-connection" aria-hidden="true">
              <path d={path} />
            </svg>
            <StudyCalendar
              today={today}
              month={month}
              selected={selected}
              onSelect={select}
              onToday={() => select(today)}
              onMonth={(delta) => {
                const next = shiftMonth(month, delta);
                select(next === today.slice(0, 7) ? today : `${next}-01`);
              }}
            />
            <DailyLessonNode
              lesson={getLesson(selected, today)}
              onSelect={select}
            />
          </div>
          <div className="journey-footer">
            <span>
              <span className="small-spark">✦</span>{" "}
              每个打勾的日子，都在带你靠近目标。
            </span>
            <span>
              ONE DAY CLOSER <ArrowUpRight size={13} />
            </span>
          </div>
        </section>
        <PracticeModules />
        <footer className="home-footer">
          <Sprout size={15} />
          <span>保持节奏，好事正在发生。</span>
        </footer>
      </main>
    </>
  );
}
