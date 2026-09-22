import { addDays, dayDifference } from "@/lib/dates";
import type { Lesson, ModuleKey } from "@/types/study";
// NOTE: mockUser 演示基线（1240 XP / Lv.12 / streak 7）已从生产逻辑移除，
// 生产用户状态由 src/lib/lesson/profile.ts userFor 从真实学习记录推导（0 基线）。
export const mockExamDate = "2026-12-11";
export const modules: {
  key: ModuleKey;
  name: string;
  english: string;
  description: string;
}[] = [
  {
    key: "vocabulary",
    name: "词汇",
    english: "WORDS",
    description: "让每一个新词，都变成熟悉的朋友。",
  },
  {
    key: "listening",
    name: "听力",
    english: "LISTEN",
    description: "慢慢听懂英语里的每一个细节。",
  },
  {
    key: "reading",
    name: "阅读",
    english: "READ",
    description: "读懂文字，也读懂更大的世界。",
  },
  {
    key: "translation",
    name: "翻译",
    english: "TRANSLATE",
    description: "在两种语言之间，找到自然的表达。",
  },
  {
    key: "writing",
    name: "写作",
    english: "WRITE",
    description: "把你的想法，写成清晰的英语。",
  },
];
export function getLesson(date: string, today: string): Lesson {
  const difference = dayDifference(date, today);
  const day = Number(date.slice(8));
  const status =
    difference < 0
      ? "locked"
      : difference === 0
        ? "today"
        : difference <= 7 || day % 3 !== 0
          ? "completed"
          : "adjusted";
  return {
    date,
    status,
    minutes: difference === 0 ? 14 : 10 + (day % 5) * 2,
    modules:
      difference === 0 || day % 2
        ? ["vocabulary", "reading", "listening"]
        : ["vocabulary", "translation", "writing"],
    ...(status === "adjusted"
      ? { rescheduledTo: addDays(today, 1 + (day % 3)) }
      : {}),
  };
}
