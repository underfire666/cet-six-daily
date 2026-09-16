import { addDays, dayDifference } from "@/lib/dates";
import type { Lesson, ModuleKey, User } from "@/types/study";
export const mockUser: User = {
  nickname: "一翔",
  streak: 7,
  level: 12,
  title: "进阶者",
  xp: 1240,
  nextLevelXp: 1500,
};
// Fixed at implementation time: 2026-09-15 + 87 calendar days. Not an official exam date.
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
