import { getExamCatalog, type ExamModule } from "@/content/exam-catalog";
import type { ListeningSession } from "@/types/listening";
import type { ReadingSession } from "@/types/reading";
import type { TranslationSession } from "@/types/translation";
import type { WritingSession } from "@/types/writing";

export type PracticeRecordStatus = "in_progress" | "completed";

export interface PracticeRecord {
  sessionId: string;
  module: ExamModule;
  contentId: string;
  examId: string | null;
  examYear: string | null;
  examPeriod: string | null;
  examSet: string | null;
  examTitle: string | null;
  exerciseTitle: string | null;
  sharedWith: string | null;
  status: PracticeRecordStatus;
  phase: string;
  startedAt: string;
  completedAt: string | null;
  xp: number | null;
  questionCount: number;
  answeredCount: number;
}

export interface PracticeRecordStores {
  listening: { sessions: Record<string, ListeningSession> };
  reading: { sessions: Record<string, ReadingSession> };
  translation: { sessions: Record<string, TranslationSession> };
  writing: { sessions: Record<string, WritingSession> };
}

const moduleLabels: Record<ExamModule, string> = {
  listening: "听力",
  reading: "阅读",
  translation: "翻译",
  writing: "写作",
};

export function moduleLabel(module: ExamModule): string {
  return moduleLabels[module];
}

/** Build a lookup from content ID to exam catalog exercise metadata. */
function buildContentLookup() {
  const catalog = getExamCatalog();
  const map = new Map<string, {
    examId: string;
    examYear: string;
    examPeriod: string;
    examSet: string;
    examTitle: string;
    exerciseTitle: string;
    sharedWith: string | null;
    questionCount: number;
  }>();
  for (const entry of catalog) {
    for (const mod of ["listening", "reading", "translation", "writing"] as ExamModule[]) {
      const sharedWith =
        mod === "listening" ? entry.listeningSharedWith ?? null :
        mod === "reading" ? entry.readingSharedWith ?? null : null;
      for (const exercise of entry.exercises[mod]) {
        if (!map.has(exercise.id)) {
          map.set(exercise.id, {
            examId: entry.id,
            examYear: entry.year,
            examPeriod: entry.period,
            examSet: entry.set,
            examTitle: entry.title,
            exerciseTitle: exercise.title,
            sharedWith,
            questionCount: exercise.questionCount,
          });
        }
      }
    }
  }
  return map;
}

function sessionContentId(module: ExamModule, session: {
  materialId?: string; articleId?: string; taskId?: string;
}): string | null {
  return session.materialId ?? session.articleId ?? session.taskId ?? null;
}

function countAnswered(
  session: ListeningSession | ReadingSession,
): number {
  const lesson = (session as { lesson?: { records?: Record<string, unknown> } }).lesson;
  if (!lesson?.records) return 0;
  return Object.values(lesson.records).filter((r) => {
    const record = r as { initial?: unknown[]; retest?: unknown[] };
    return (record.initial?.length ?? 0) > 0 || (record.retest?.length ?? 0) > 0;
  }).length;
}

function toRecord(
  module: ExamModule,
  session: ListeningSession | ReadingSession | TranslationSession | WritingSession,
  lookup: Map<string, {
    examId: string; examYear: string; examPeriod: string; examSet: string;
    examTitle: string; exerciseTitle: string; sharedWith: string | null;
    questionCount: number;
  }>,
): PracticeRecord | null {
  if (session.mode !== "selected") return null;
  const contentId = sessionContentId(module, session);
  if (!contentId) return null;
  const meta = lookup.get(contentId);
  const isCompleted = session.phase === "complete";
  const xp = session.applied && session.rewardXp != null ? session.rewardXp : null;
  const questionCount = meta?.questionCount ?? 0;
  const answeredCount =
    module === "listening" || module === "reading"
      ? countAnswered(session as ListeningSession | ReadingSession)
      : session.phase === "complete" ? 1 : (session as TranslationSession | WritingSession).draft ? 1 : 0;

  return {
    sessionId: session.id,
    module,
    contentId,
    examId: meta?.examId ?? null,
    examYear: meta?.examYear ?? null,
    examPeriod: meta?.examPeriod ?? null,
    examSet: meta?.examSet ?? null,
    examTitle: meta?.examTitle ?? null,
    exerciseTitle: meta?.exerciseTitle ?? null,
    sharedWith: meta?.sharedWith ?? null,
    status: isCompleted ? "completed" : "in_progress",
    phase: session.phase,
    startedAt: session.startedAt,
    completedAt: session.completedAt ?? null,
    xp,
    questionCount,
    answeredCount,
  };
}

/** Aggregate all selected-mode sessions from the four module stores. */
export function collectPracticeRecords(stores: PracticeRecordStores): PracticeRecord[] {
  const lookup = buildContentLookup();
  const records: PracticeRecord[] = [];

  for (const session of Object.values(stores.listening.sessions)) {
    const r = toRecord("listening", session, lookup);
    if (r) records.push(r);
  }
  for (const session of Object.values(stores.reading.sessions)) {
    const r = toRecord("reading", session, lookup);
    if (r) records.push(r);
  }
  for (const session of Object.values(stores.translation.sessions)) {
    const r = toRecord("translation", session, lookup);
    if (r) records.push(r);
  }
  for (const session of Object.values(stores.writing.sessions)) {
    const r = toRecord("writing", session, lookup);
    if (r) records.push(r);
  }

  return records;
}

export type RecordFilterStatus = "all" | "in_progress" | "completed";
export type RecordFilterModule = "all" | ExamModule;

export function filterRecords(
  records: PracticeRecord[],
  status: RecordFilterStatus,
  module: RecordFilterModule,
): PracticeRecord[] {
  return records.filter((r) => {
    if (status !== "all" && r.status !== status) return false;
    if (module !== "all" && r.module !== module) return false;
    return true;
  });
}

export function sortRecords(records: PracticeRecord[]): PracticeRecord[] {
  const inProgress = records
    .filter((r) => r.status === "in_progress")
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  const completed = records
    .filter((r) => r.status === "completed")
    .sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""));
  return [...inProgress, ...completed];
}

export function formatShanghaiTime(iso: string | null): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat("zh-CN", {
      timeZone: "Asia/Shanghai",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  } catch {
    return iso;
  }
}

export function practiceSessionHref(module: ExamModule, sessionId: string): string {
  return `/practice/${module}/session/${sessionId}`;
}

export function practiceRecordReviewHref(module: ExamModule, sessionId: string): string {
  return `/practice/exams/records/${module}/${sessionId}`;
}
