export type DateKey = string;
export type CalendarStatus = "today" | "completed" | "adjusted" | "locked";
export type ModuleKey =
  "vocabulary" | "listening" | "reading" | "translation" | "writing";
export interface User {
  nickname: string;
  streak: number;
  level: number;
  title: string;
  xp: number;
  nextLevelXp: number;
}
export interface Lesson {
  date: DateKey;
  minutes: number;
  modules: ModuleKey[];
  status: CalendarStatus;
  rescheduledTo?: DateKey;
}
