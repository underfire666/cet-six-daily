import { examModules, type ExamModule } from "@/content/exam-catalog";
import type { RecordFilterModule, RecordFilterStatus } from "./exam-records";

export interface ExamRecordsState {
  status: RecordFilterStatus;
  module: RecordFilterModule;
}

export function readExamRecords(search: string): ExamRecordsState {
  const params = new URLSearchParams(search);
  const status = params.get("status") ?? "all";
  const mod = params.get("module") ?? "all";
  return {
    status: ["all", "in_progress", "completed"].includes(status) ? status as RecordFilterStatus : "all",
    module: mod === "all" || examModules.includes(mod as ExamModule) ? mod as RecordFilterModule : "all",
  };
}

export function examRecordsHref(state: ExamRecordsState): string {
  const params = new URLSearchParams();
  if (state.status !== "all") params.set("status", state.status);
  if (state.module !== "all") params.set("module", state.module);
  const search = params.toString();
  return `/practice/exams/records${search ? `?${search}` : ""}`;
}
