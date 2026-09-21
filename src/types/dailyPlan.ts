import type { SubjectiveSessionMode } from "./subjective";

export type StudyPhase = "foundation" | "improvement" | "sprint";
export type DailyPlanStatus = "empty" | "in_progress" | "completed" | "adjusted";
export type DailyTaskStatus =
  | "locked"
  | "available"
  | "in_progress"
  | "completed"
  | "rescheduled";
export type TaskPriority = "low" | "normal" | "high";
export type TaskSource = "system" | "user" | "rescheduled";

export type PlanModule =
  | "vocabulary"
  | "reading"
  | "listening"
  | "translation"
  | "writing";

export interface DailyTask {
  id: string;
  module: PlanModule;
  /** 显示给用户的目标，如 "20 个" / "1 篇" */
  target: string;
  estimatedMinutes: number;
  order: number;
  priority: TaskPriority;
  source: TaskSource;
  /** 从哪天顺延而来 */
  rescheduledFrom?: string;
  /** 编辑后用户显式删除 */
  removed?: boolean;
}

export interface DailyPlan {
  /** 当天单独设置；缺省时沿用全局偏好。 */
  preferences?: StudyPreferences;
  date: string;
  phase: StudyPhase;
  estimatedMinutes: number;
  tasks: DailyTask[];
  status: DailyPlanStatus;
  generatedAt: string;
  adjusted: boolean;
  adjustmentReason?:
    | "missed_task"
    | "preference_change"
    | "exam_date_change"
    | "load_balance";
  planVersion: 1;
}

export type Intensity = "light" | "standard" | "intense";
export type SimpleWeight = "focus" | "normal" | "sparse";
export type PreferenceMode = "simple" | "advanced";

export interface StudyPreferences {
  examDate: string;
  intensity: Intensity;
  mode: PreferenceMode;
  simple: Record<PlanModule, SimpleWeight>;
  /** 高级模式：百分比，和为 100 */
  advanced: Record<PlanModule, number>;
  planVersion: 1;
}

export interface DailyPlanStore {
  schemaVersion: 1;
  plans: Record<string, DailyPlan>;
  preferences: StudyPreferences;
  /** daily-plan-complete:<date> -> xp，防重复领取 */
  completionLedger: Record<string, number>;
  /** 用户手动编辑过的日期，避免被自动重新生成覆盖 */
  customizedDates: string[];
}

/** 各专项今日完成度，由 Adapter 从专项 Provider 读取 */
export interface ModuleCompletion {
  completed: boolean;
  /** 今日已完成数量（0..n） */
  done: number;
  /** 今日目标数量 */
  total: number;
}

export interface CompletionSnapshot {
  date: string;
  modules: Record<PlanModule, ModuleCompletion>;
}

export type { SubjectiveSessionMode };
