"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { CET6Paper } from "@/content/papers";
import type { PaperSessionAction, PaperSessionState, PaperResultSnapshot } from "@/types/paper";
import {
  createPaperSession,
  reducePaperSession,
  calculatePaperResult,
  isPaperCompletable,
  getWrongQuestionIds,
} from "@/lib/paper/session";
import {
  saveAndSyncPaperSession,
  findInProgressSession,
  findLatestCompletedSession,
} from "@/lib/paper/storage";
import {
  buildSectionQuestionIds,
  buildQuestionIdToCorrect,
  buildSectionMeta,
} from "@/lib/paper/content";
import { settlePaperReview, createPaperReviewItems, enqueuePaperReviewSync } from "@/lib/paper/review";
import { calculatePaperXp, enqueuePaperXpSync } from "@/lib/paper/xp";

export interface PaperProviderProps {
  paper: CET6Paper;
  ownerNamespace: string;
  isLoggedIn: boolean;
  onIssue?: (message: string) => void;
  children: React.ReactNode;
}

interface PaperContextValue {
  paper: CET6Paper;
  session: PaperSessionState | null;
  loading: boolean;
  startOrResume: () => void;
  startNew: () => void;
  dispatch: (action: PaperSessionAction) => void;
  submitPaper: () => PaperResultSnapshot | null;
  sectionQuestionIds: Record<string, string[]>;
  questionIdToCorrect: Record<string, string | undefined>;
  canSubmit: boolean;
  wrongQuestionIds: string[];
  saveStatus: "idle" | "saving" | "saved" | "failed";
}

const PaperContext = createContext<PaperContextValue | null>(null);

interface PaperProviderState {
  session: PaperSessionState | null;
  loading: boolean;
}

function createNewPaperSession(paper: CET6Paper, ownerNamespace: string): PaperSessionState {
  const now = new Date().toISOString();
  const sessionId = typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : "paper-" + Date.now() + "-" + Math.random().toString(36).slice(2);
  const sectionMeta = buildSectionMeta(paper);
  return createPaperSession({
    sessionId,
    paperId: paper.paperId,
    paperContentVersion: paper.contentVersion ?? "1.0.0",
    examSpecId: paper.examSpecId ?? "cet6-current-2026",
    ownerNamespace,
    now,
    sectionIds: sectionMeta,
  });
}

function loadSessionFromStorage(paperId: string, ownerNamespace: string): PaperProviderState {
  if (typeof window === "undefined") return { session: null, loading: true };
  const inProgress = findInProgressSession(paperId, ownerNamespace);
  const hasAnswers = inProgress && Object.keys(inProgress.answers ?? {}).length > 0;
  if (inProgress && hasAnswers) return { session: inProgress, loading: false };
  const completed = findLatestCompletedSession(paperId, ownerNamespace);
  if (completed) return { session: completed, loading: false };
  if (inProgress) return { session: inProgress, loading: false };
  return { session: null, loading: false };
}

export function PaperProvider({ paper, ownerNamespace, isLoggedIn, onIssue, children }: PaperProviderProps) {
  // SSR 和首次客户端渲染保持一致（loading=true, session=null），避免 hydration mismatch
  const [state, setState] = useState<PaperProviderState>({ session: null, loading: true });
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "failed">("idle");
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hydratedRef = useRef(false);

  // 挂载后从 localStorage 恢复 session（仅执行一次）
  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;
    setState(loadSessionFromStorage(paper.paperId, ownerNamespace));
  }, [paper.paperId, ownerNamespace]);

  const session = state.session;
  const loading = state.loading;

  const sectionQuestionIds = buildSectionQuestionIds(paper);
  const questionIdToCorrect = buildQuestionIdToCorrect(paper);

  const persist = useCallback((s: PaperSessionState) => {
    setSaveStatus("saving");
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      const result = saveAndSyncPaperSession(s, isLoggedIn);
      if (result.ok) {
        setSaveStatus("saved");
      } else {
        setSaveStatus("failed");
        onIssue?.(result.issue ?? "保存失败");
      }
    }, 300);
  }, [isLoggedIn, onIssue]);

  const dispatch = useCallback((action: PaperSessionAction) => {
    setState((prev) => {
      if (!prev.session) return prev;
      const next = reducePaperSession(prev.session, action, sectionQuestionIds);
      if (next !== prev.session) {
        persist(next);
      }
      return { ...prev, session: next };
    });
  }, [sectionQuestionIds, persist]);

  const startNew = useCallback(() => {
    const newSession = createNewPaperSession(paper, ownerNamespace);
    setState((prev) => ({ ...prev, session: newSession }));
    persist(newSession);
  }, [paper, ownerNamespace, persist]);

  const startOrResume = useCallback(() => {
    setState((prev) => {
      if (prev.session) return prev;
      const existing = findInProgressSession(paper.paperId, ownerNamespace);
      if (existing) {
        return { ...prev, session: existing };
      }
      const newSession = createNewPaperSession(paper, ownerNamespace);
      persist(newSession);
      return { ...prev, session: newSession };
    });
  }, [paper, ownerNamespace, persist]);

  const canSubmit = useMemo(() => {
    if (!session) return false;
    return isPaperCompletable(session, sectionQuestionIds);
  }, [session, sectionQuestionIds]);

  const submitPaper = useCallback((): PaperResultSnapshot | null => {
    if (!session || !canSubmit) return null;
    const now = new Date().toISOString();
    const result = calculatePaperResult(session, questionIdToCorrect, sectionQuestionIds, now);
    const action: PaperSessionAction = { type: "submit_paper", result, now };
    dispatch(action);

    try {
      const completedSession = { ...session, phase: "completed" as const, result };
      const reviewResult = settlePaperReview(paper, completedSession, typeof window !== "undefined" ? window.localStorage : undefined);
      if (reviewResult.settled && reviewResult.addedCount > 0 && isLoggedIn) {
        const items = createPaperReviewItems(paper, completedSession);
        enqueuePaperReviewSync(items);
      }
      dispatch({ type: "mark_review_settled", now });
    } catch (e) {
      console.warn("[Paper] Review settlement failed:", e);
    }

    try {
      const xp = calculatePaperXp(result);
      if (xp > 0) {
        enqueuePaperXpSync(paper.paperId, session.sessionId, xp);
      }
      dispatch({ type: "mark_xp_settled", now });
    } catch (e) {
      console.warn("[Paper] XP settlement failed:", e);
    }

    return result;
  }, [session, canSubmit, questionIdToCorrect, sectionQuestionIds, dispatch, paper, isLoggedIn]);

  const wrongQuestionIds = useMemo(() => {
    if (!session) return [];
    return getWrongQuestionIds(session, questionIdToCorrect);
  }, [session, questionIdToCorrect]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  const value: PaperContextValue = {
    paper,
    session,
    loading,
    startOrResume,
    startNew,
    dispatch,
    submitPaper,
    sectionQuestionIds,
    questionIdToCorrect,
    canSubmit,
    wrongQuestionIds,
    saveStatus,
  };

  return <PaperContext.Provider value={value}>{children}</PaperContext.Provider>;
}

export function usePaper(): PaperContextValue {
  const ctx = useContext(PaperContext);
  if (!ctx) throw new Error("usePaper must be used within PaperProvider");
  return ctx;
}
