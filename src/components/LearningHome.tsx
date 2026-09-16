"use client";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CalendarDays } from "lucide-react";
import { countdownText, shiftMonth, validDate } from "@/lib/dates";
import { mockExamDate } from "@/data/mock";
import { useLearning } from "./LearningProvider";
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
    </div>
  );
}
export function LearningHome() {
  const { getLesson } = useLearning();
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
      const grid = stage.querySelector(".days");
      if (!cell || !node || !grid) {
        setPath("");
        return;
      }
      const outer = stage.getBoundingClientRect();
      const cellBounds = cell.getBoundingClientRect();
      const a = (
        cell.querySelector(".day-face") ?? cell
      ).getBoundingClientRect();
      const b = node.getBoundingClientRect();
      const gridBounds = grid.getBoundingClientRect();
      if (window.innerWidth >= 768) {
        // Travel through the row gutter so the route touches only its selected date.
        const x = a.left + a.width / 2 - outer.left;
        const y = a.bottom - outer.top;
        const rowGap = parseFloat(getComputedStyle(grid).rowGap) || 0;
        const laneY = cellBounds.bottom - outer.top + rowGap / 2;
        const endX = b.left - outer.left;
        const endY = b.top + b.height / 2 - outer.top;
        const bend = gridBounds.right - outer.left + 24;
        setPath(
          `M ${x} ${y} Q ${x} ${laneY} ${x + 12} ${laneY} H ${bend - 16} Q ${bend} ${laneY} ${bend} ${(laneY + endY) / 2} T ${endX} ${endY}`,
        );
      } else {
        // The column boundary leaves a clear lane beside the smaller date faces.
        const x = a.right - outer.left;
        const y = a.top + a.height / 2 - outer.top;
        const laneX = cellBounds.right - outer.left;
        const endX = b.left + b.width / 2 - outer.left;
        const endY = b.top - outer.top;
        const bend = gridBounds.bottom - outer.top + 14;
        setPath(
          `M ${x} ${y} Q ${laneX} ${y} ${laneX} ${y + 10} V ${bend - 10} Q ${laneX} ${bend} ${(laneX + endX) / 2} ${bend} T ${endX} ${endY}`,
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
          <h1>
            每天一点，靠近六级<span className="greeting-dot">.</span>
          </h1>
          <ExamCountdown today={today} />
        </section>
        <section className="journey">
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
            <DailyLessonNode lesson={getLesson(selected)} onSelect={select} />
          </div>
        </section>
        <PracticeModules />
      </main>
    </>
  );
}
