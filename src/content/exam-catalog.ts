import history from "./imported/cet6-history-manifest.json";
import listening from "./imported/cet6-listening-manifest.json";
import { getReadingArticles, getListeningMaterials, getTranslationTasks, getWritingTasks } from "./learning";

export const examModules = ["listening", "reading", "translation", "writing"] as const;
export type ExamModule = (typeof examModules)[number];
export const examCatalogIds = history.documents.map(document => document.id);
export const examYears = [...new Set(history.documents.map(document => document.id.slice(0, 4)))].sort().reverse();

export interface ExamExercise {
  id: string;
  module: ExamModule;
  title: string;
  questionCount: number;
  minutes: number;
  available: boolean;
}
export interface ExamCatalogEntry {
  id: string;
  year: string;
  period: string;
  set: string;
  title: string;
  listeningSharedWith?: string;
  readingSharedWith?: string;
  exercises: Record<ExamModule, ExamExercise[]>;
}

/** Catalog entries reference canonical content IDs, including shared sets. No new Paper is created. */
export function getExamCatalog(): ExamCatalogEntry[] {
  const readingItems = new Map(getReadingArticles().filter(item => item.sourceType === "past_exam").map(item => [item.id, item]));
  const listeningItems = new Map(getListeningMaterials().filter(item => item.sourceType === "past_exam").map(item => [item.id, item]));
  const translationItems = new Map(getTranslationTasks().filter(item => item.sourceType === "past_exam").map(item => [item.id, item]));
  const writingItems = new Map(getWritingTasks().filter(item => item.sourceType === "past_exam").map(item => [item.id, item]));
  return history.documents.map(document => {
    const [year, period, set] = document.id.split("-");
    const audio = listening.documents.find(item => item.document === document.id);
    const readingSet = document.readingIds[0]?.match(/:set(\d):/)?.[1];
    return {
      id: document.id, year, period, set,
      title: `${year} 年 ${Number(period)} 月 · 第 ${set} 套`,
      listeningSharedWith: audio && audio.listeningDocument !== document.id ? audio.listeningDocument.split("-")[2] : undefined,
      readingSharedWith: readingSet !== set ? readingSet : undefined,
      exercises: {
        reading: document.readingIds.map(id => {
          const item = readingItems.get(id);
          const label = id.endsWith(":cloze") ? "选词填空" : id.endsWith(":matching") ? "长篇匹配" : id.endsWith(":careful1") ? "仔细阅读（一）" : "仔细阅读（二）";
          return { id, module: "reading" as const, title: label, questionCount: item?.questions.length ?? 0, minutes: item?.estimatedMinutes ?? 0, available: !!item };
        }),
        listening: (audio?.materialIds ?? []).map((id, index) => {
          const item = listeningItems.get(id);
          const section = index < 2 ? "长对话" : index < 4 ? "听力篇章" : "讲座与讲话";
          return { id, module: "listening" as const, title: `${section} ${index < 2 ? index + 1 : index < 4 ? index - 1 : index - 3}`, questionCount: item?.questions.length ?? 0, minutes: item?.estimatedMinutes ?? 0, available: !!item && item.audio.type === "file" && !!item.audio.src };
        }),
        translation: [{ id: document.translationId, module: "translation" as const, title: "段落翻译", questionCount: 1, minutes: translationItems.get(document.translationId)?.estimatedMinutes ?? 0, available: translationItems.has(document.translationId) }],
        writing: [{ id: document.writingId, module: "writing" as const, title: "六级写作", questionCount: 1, minutes: 30, available: writingItems.has(document.writingId) }],
      },
    };
  }).sort((a, b) => b.year.localeCompare(a.year) || b.period.localeCompare(a.period) || a.set.localeCompare(b.set));
}

export function getExamExercise(module: ExamModule, id: string): ExamExercise | undefined {
  return getExamCatalog().flatMap(entry => entry.exercises[module]).find(item => item.id === id && item.available);
}
