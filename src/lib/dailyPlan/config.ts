import type {
  DailyTask,
  PlanModule,
  SimpleWeight,
  StudyPreferences,
  StudyPhase,
} from "@/types/dailyPlan";

/** 考试阶段阈值（距考试天数） */
export const PHASE_THRESHOLDS = {
  foundation: 60, // >60 天
  improvement: 21, // 21..60 天
  sprint: 0, // <=21 天
} as const;

/** 各模块单项估时（分钟） */
export const MODULE_MINUTES: Record<PlanModule, number> = {
  vocabulary: 8,
  reading: 7,
  listening: 6,
  translation: 8,
  writing: 8,
};

/** 各模块单项目标显示 */
export const MODULE_TARGET: Record<PlanModule, string> = {
  vocabulary: "20 个",
  reading: "1 篇",
  listening: "1 组",
  translation: "1 篇",
  writing: "1 篇",
};

/** 每日学习时长偏好（分钟区间） */
export const INTENSITY_MINUTES: Record<
  "light" | "standard" | "intense",
  [number, number]
> = {
  light: [10, 15],
  standard: [15, 25],
  intense: [25, 35],
};

/** 每日负荷上限（分钟），顺延不超过此值 */
export const DAILY_LOAD_CAP = 35;

/** 顺延窗口：漏学任务最多往后 N 天 */
export const RESCHEDULE_WINDOW = 4;

/** 简单模式权重映射 */
export const SIMPLE_WEIGHT: Record<SimpleWeight, number> = {
  focus: 3,
  normal: 2,
  sparse: 1,
};

/** 默认偏好 */
export const DEFAULT_PREFERENCES: StudyPreferences = {
  examDate: "2026-12-11",
  intensity: "standard",
  mode: "simple",
  simple: {
    vocabulary: "focus",
    reading: "normal",
    listening: "normal",
    translation: "sparse",
    writing: "sparse",
  },
  advanced: {
    vocabulary: 30,
    reading: 25,
    listening: 20,
    translation: 15,
    writing: 10,
  },
  planVersion: 1,
};

export function studyPhase(daysUntilExam: number): StudyPhase {
  if (daysUntilExam > PHASE_THRESHOLDS.foundation) return "foundation";
  if (daysUntilExam > PHASE_THRESHOLDS.improvement) return "improvement";
  return "sprint";
}

/** 阶段系数：基础期任务少，冲刺期任务多 */
export function phaseFactor(phase: StudyPhase): number {
  switch (phase) {
    case "foundation":
      return 0.8;
    case "improvement":
      return 1;
    case "sprint":
      return 1.25;
  }
}

/** 偏好 -> 各模块权重 */
export function moduleWeights(pref: StudyPreferences): Record<PlanModule, number> {
  if (pref.mode === "advanced") {
    const total = Object.values(pref.advanced).reduce((n, x) => n + x, 0);
    if (total !== 100) {
      // 高级模式未达 100 时回退简单模式
      return moduleWeights({ ...pref, mode: "simple" });
    }
    return { ...pref.advanced };
  }
  return {
    vocabulary: SIMPLE_WEIGHT[pref.simple.vocabulary],
    reading: SIMPLE_WEIGHT[pref.simple.reading],
    listening: SIMPLE_WEIGHT[pref.simple.listening],
    translation: SIMPLE_WEIGHT[pref.simple.translation],
    writing: SIMPLE_WEIGHT[pref.simple.writing],
  };
}

let taskSeq = 0;
export function makeTask(
  module: PlanModule,
  order: number,
  extra?: Partial<DailyTask>,
): DailyTask {
  taskSeq += 1;
  return {
    id: `${Date.now().toString(36)}-${taskSeq}`,
    module,
    target: MODULE_TARGET[module],
    estimatedMinutes: MODULE_MINUTES[module],
    order,
    priority: module === "vocabulary" ? "high" : "normal",
    source: "system",
    ...extra,
  };
}
