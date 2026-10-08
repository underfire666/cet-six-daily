import { examCatalogIds, examModules, examYears, type ExamModule } from "@/content/exam-catalog";

export interface ExamBrowseState {
  year: string;
  period: string;
  set: string;
  exam: string;
  module: ExamModule;
}
export function readExamBrowse(search: string): ExamBrowseState {
  const params = new URLSearchParams(search);
  const year = params.get("year") ?? "";
  const period = params.get("period") ?? "";
  const set = params.get("set") ?? "";
  const exam = params.get("exam") ?? "";
  const selectedModule = params.get("module") ?? "";
  return {
    year: examYears.includes(year) ? year : "",
    period: ["03", "06", "09", "12"].includes(period) ? period : "",
    set: ["1", "2", "3"].includes(set) ? set : "",
    exam: examCatalogIds.includes(exam) ? exam : "",
    module: examModules.includes(selectedModule as ExamModule) ? selectedModule as ExamModule : "listening",
  };
}

function browseParams(state: ExamBrowseState): URLSearchParams {
  const params = new URLSearchParams();
  for (const key of ["year", "period", "set", "exam"] as const) if (state[key]) params.set(key, state[key]);
  if (state.module !== "listening") params.set("module", state.module);
  // Normalize values even when callers construct state rather than reading a URL.
  const clean = readExamBrowse(params.toString());
  const normalized = new URLSearchParams();
  for (const key of ["year", "period", "set", "exam"] as const) if (clean[key]) normalized.set(key, clean[key]);
  if (clean.module !== "listening") normalized.set("module", clean.module);
  return normalized;
}
export function examBrowseHref(state: ExamBrowseState): string {
  const search = browseParams(state).toString();
  return `/practice/exams${search ? `?${search}` : ""}`;
}
export function examPracticeHref(module: ExamModule, sessionId: string, state: ExamBrowseState): string {
  if (!examModules.includes(module) || !/^[\w:-]{1,128}$/.test(sessionId)) return examBrowseHref(state);
  const params = browseParams({ ...state, module });
  params.set("session", sessionId);
  return `/practice/${module}?${params.toString()}`;
}
/** A fixed internal destination; arbitrary returnTo and foreign URLs are never accepted. */
export function examReturnHref(search: string): string | null {
  const state = readExamBrowse(search);
  return state.exam ? examBrowseHref(state) : null;
}
