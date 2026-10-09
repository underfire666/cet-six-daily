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

/**
 * Validate that a returnTo URL is an internal records page with safe filter params.
 * Returns the normalized path+search, or null if invalid.
 * Never accepts external URLs, protocol-relative URLs, or other internal routes.
 */
export function safeRecordsReturnUrl(returnTo: string | null | undefined): string | null {
  if (!returnTo) return null;
  // Must be a path-only URL starting with /practice/exams/records
  if (!returnTo.startsWith("/practice/exams/records")) return null;
  // Reject protocol-relative, encoded, or suspicious patterns
  if (returnTo.includes("://") || returnTo.includes("\\") || returnTo.includes("\n") || returnTo.includes("\r")) return null;
  try {
    // Parse path and query separately
    const qIndex = returnTo.indexOf("?");
    const path = qIndex >= 0 ? returnTo.slice(0, qIndex) : returnTo;
    const search = qIndex >= 0 ? returnTo.slice(qIndex + 1) : "";
    // Path must be exactly the records list page (no sub-routes like /reading/xxx)
    if (path !== "/practice/exams/records") return null;
    // Validate query params are only status and module with safe values
    if (search) {
      const params = new URLSearchParams(search);
      for (const key of params.keys()) {
        if (key !== "status" && key !== "module") return null;
      }
      const state = readExamRecords(search);
      // Re-roundtrip to ensure only valid values survive
      const normalized = examRecordsHref(state);
      return normalized;
    }
    return "/practice/exams/records";
  } catch {
    return null;
  }
}

/** Build a returnTo query param for session/review pages, only when non-default. */
export function recordsReturnParam(state: ExamRecordsState): string {
  const href = examRecordsHref(state);
  return href === "/practice/exams/records" ? "" : `returnTo=${encodeURIComponent(href)}`;
}

/**
 * Read and validate returnTo from the current page URL.
 * Returns the safe records page URL, or null if not present/invalid.
 * Call in client components after mount (window available).
 */
export function readReturnToFromLocation(): string | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  return safeRecordsReturnUrl(params.get("returnTo"));
}

/**
 * Get the exit href for a selected-mode session.
 * Prefers validated returnTo (records page), falls back to exam browser,
 * then module home for non-selected modes.
 */
export function sessionExitHref(mode: string, moduleHome: string): string {
  const returnTo = readReturnToFromLocation();
  if (returnTo) return returnTo;
  return mode === "selected" ? "/practice/exams" : moduleHome;
}

/**
 * Combined exit resolver for Complete pages: checks returnTo (records) first,
 * then exam param (exam browser), then falls back to default.
 */
export function completeExitHref(defaultHref: string): string {
  const returnTo = readReturnToFromLocation();
  if (returnTo) return returnTo;
  // Fall back to exam browser if exam param present
  if (typeof window !== "undefined") {
    const params = new URLSearchParams(window.location.search);
    if (params.get("exam")) {
      return "/practice/exams";
    }
  }
  return defaultHref;
}
