import {
  Check,
  ChevronLeft,
  ChevronRight,
  LockKeyhole,
  RotateCw,
} from "lucide-react";
import { monthCells, shortDate } from "@/lib/dates";
import { useLearning } from "./LearningProvider";
export function StudyCalendar({
  today,
  month,
  selected,
  onSelect,
  onMonth,
  onToday,
}: {
  today: string;
  month: string;
  selected: string;
  onSelect: (date: string) => void;
  onMonth: (delta: number) => void;
  onToday: () => void;
}) {
  const { getLesson } = useLearning();
  return (
    <section className="calendar" aria-label="学习月历">
      <div className="calendar-heading">
        <h2>
          {month.slice(0, 4)} <span>年</span> {Number(month.slice(5))}{" "}
          <span>月</span>
        </h2>
        <div className="calendar-controls">
          <button onClick={onToday} className="today-button">
            今天
          </button>
          <button onClick={() => onMonth(-1)} aria-label="上个月">
            <ChevronLeft size={19} />
          </button>
          <button onClick={() => onMonth(1)} aria-label="下个月">
            <ChevronRight size={19} />
          </button>
        </div>
      </div>
      <div className="calendar-grid">
        <div className="weekdays">
          {["一", "二", "三", "四", "五", "六", "日"].map((day) => (
            <span key={day}>{day}</span>
          ))}
        </div>
        <div className="days">
          {monthCells(month).map((date, index) => {
            if (!date)
              return <span key={`empty-${index}`} className="empty-day" />;
            const { status } = getLesson(date);
            const label = {
              today: "今天",
              completed: "已完成",
              adjusted: "已调整",
              locked: "未解锁",
              available: "未完成",
            }[status];
            return (
              <button
                key={date}
                data-date={date}
                className={`day ${status} ${date === today ? "today" : ""} ${date === selected ? "selected" : ""}`}
                onClick={() => onSelect(date)}
                aria-label={`${shortDate(date)}，${label}`}
                aria-pressed={date === selected}
                aria-current={date === today ? "date" : undefined}
              >
                <span className="day-face">
                  <span>{Number(date.slice(8))}</span>
                  <span className="day-indicator">
                    {status === "completed" ? (
                      <Check size={12} strokeWidth={3} />
                    ) : status === "adjusted" ? (
                      <RotateCw size={11} />
                    ) : status === "locked" ? (
                      <LockKeyhole size={10} />
                    ) : (
                      <span className="today-dot" />
                    )}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
