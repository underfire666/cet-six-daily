"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { getSyncIdentityGeneration } from "@/lib/sync/adapters";
import {
  parsePrivateReviewStart,
  parsePrivateReviewGrade,
  savePrivateReviewSession,
  clearPrivateReviewSession,
  type PrivateReviewSession,
  type PrivateReviewStartResponse,
  type PrivateReviewGradeResponse,
} from "./review";

export interface UsePrivateReviewSessionResult {
  status: "loading" | "idle" | "reviewing" | "submitting" | "submitted" | "error";
  session: PrivateReviewSession | null;
  error: string | null;
  startReview: () => Promise<void>;
  selectAnswer: (questionId: string, optionId: string) => void;
  clearAnswer: (questionId: string) => void;
  goToQuestion: (index: number) => void;
  nextQuestion: () => void;
  prevQuestion: () => void;
  submit: () => Promise<boolean>;
  restart: () => Promise<void>;
  unansweredCount: number;
}

export function usePrivateReviewSession(paperId: string): UsePrivateReviewSessionResult {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const ownerId = session?.user?.id;
  const scope = JSON.stringify([authStatus, ownerId, paperId, getSyncIdentityGeneration()]);

  const [state, setState] = useState<{
    scope: string;
    status: UsePrivateReviewSessionResult["status"];
    session: PrivateReviewSession | null;
    error: string | null;
  }>({ scope, status: "loading", session: null, error: null });

  const request = useRef<{ id: number; controller?: AbortController }>({ id: 0 });

  const persist = useCallback((s: PrivateReviewSession) => {
    try { savePrivateReviewSession(s); } catch (e) {
      setState(prev => prev.scope === scope ? { ...prev, error: e instanceof Error ? e.message : "本地存档失败" } : prev);
    }
  }, [scope]);

  const startReview = useCallback(async () => {
    if (authStatus !== "authenticated" || !ownerId) return;
    request.current.controller?.abort();
    const controller = new AbortController();
    const id = ++request.current.id;
    request.current.controller = controller;
    const generation = getSyncIdentityGeneration();
    const current = () => !controller.signal.aborted && request.current.id === id && getSyncIdentityGeneration() === generation;
    setState(prev => prev.scope === scope ? { ...prev, status: "loading", error: null } : prev);
    try {
      const res = await fetch(`/api/private-papers/${encodeURIComponent(paperId)}/wrong-items/review/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 5 }),
        cache: "no-store",
        signal: controller.signal,
      });
      if (!res.ok) {
        const msg = res.status === 404 ? "该私有卷不存在或没有有效错题" : res.status === 401 ? "登录状态已失效" : res.status === 422 ? "当前内容版本没有可复习的错题" : "开始复习失败，请重试";
        throw new Error(msg);
      }
      const raw = await res.json();
      const data: PrivateReviewStartResponse = parsePrivateReviewStart(raw, ownerId);
      const newSession: PrivateReviewSession = {
        version: 1,
        ownerId,
        paperId,
        reviewBatchId: data.reviewBatchId,
        contentHash: data.contentHash,
        questions: data.questions,
        answers: Object.fromEntries(data.questions.map(q => [q.questionId, null])),
        currentIndex: 0,
        submitted: false,
      };
      persist(newSession);
      if (current()) setState({ scope, status: "reviewing", session: newSession, error: null });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      if (current()) setState(prev => prev.scope === scope ? { ...prev, status: "error", error: error instanceof Error ? error.message : "开始复习失败" } : prev);
    }
  }, [scope, authStatus, ownerId, paperId, persist]);

  // On mount / scope change: try to restore from localStorage
  useEffect(() => {
    if (authStatus === "unauthenticated") {
      router.replace("/login?callbackUrl=/me/private-papers");
      return;
    }
    if (authStatus !== "authenticated" || !ownerId) return;
    // We don't know contentHash yet without starting; check if there's any saved session for this paper
    // Actually we need contentHash for the key. Let's just set idle and let user click start.
    // But the spec says "刷新恢复时保持同一批次" — we need to know contentHash.
    // The start API returns contentHash, and we save with it. On refresh, we don't know it.
    // Solution: also save a pointer to the latest contentHash for this paper.
    // Or: try all review keys for this owner+paper.
    const prefix = `private-review:${ownerId}:${paperId}:`;
    let found: PrivateReviewSession | null = null;
    try {
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i);
        if (k && k.startsWith(prefix)) {
          try {
            const parsed = JSON.parse(window.localStorage.getItem(k) || "null");
            const validated = parsed && parsed.ownerId === ownerId && parsed.paperId === paperId ? parsed as PrivateReviewSession : null;
            if (validated && (!found || (validated.submittedAt || "") > (found.submittedAt || ""))) {
              found = validated;
            }
          } catch { /* skip corrupt */ }
        }
      }
    } catch { /* ignore */ }
    if (found) {
      setState({ scope, status: found.submitted ? "submitted" : "reviewing", session: found, error: null });
    } else {
      setState({ scope, status: "idle", session: null, error: null });
    }
  }, [scope, authStatus, ownerId, paperId, router]);

  const selectAnswer = useCallback((questionId: string, optionId: string) => {
    setState(prev => {
      if (prev.scope !== scope || !prev.session || prev.session.submitted) return prev;
      if (!prev.session.questions.some(q => q.questionId === questionId)) return prev;
      const updated: PrivateReviewSession = { ...prev.session, answers: { ...prev.session.answers, [questionId]: optionId } };
      persist(updated);
      return { ...prev, session: updated };
    });
  }, [scope, persist]);

  const clearAnswer = useCallback((questionId: string) => {
    setState(prev => {
      if (prev.scope !== scope || !prev.session || prev.session.submitted) return prev;
      const updated: PrivateReviewSession = { ...prev.session, answers: { ...prev.session.answers, [questionId]: null } };
      persist(updated);
      return { ...prev, session: updated };
    });
  }, [scope, persist]);

  const goToQuestion = useCallback((index: number) => {
    setState(prev => {
      if (prev.scope !== scope || !prev.session || prev.session.submitted) return prev;
      if (index < 0 || index >= prev.session.questions.length) return prev;
      const updated: PrivateReviewSession = { ...prev.session, currentIndex: index };
      persist(updated);
      return { ...prev, session: updated };
    });
  }, [scope, persist]);

  const nextQuestion = useCallback(() => {
    setState(prev => {
      if (prev.scope !== scope || !prev.session || prev.session.submitted) return prev;
      const next = Math.min(prev.session.currentIndex + 1, prev.session.questions.length - 1);
      const updated: PrivateReviewSession = { ...prev.session, currentIndex: next };
      persist(updated);
      return { ...prev, session: updated };
    });
  }, [scope, persist]);

  const prevQuestion = useCallback(() => {
    setState(prev => {
      if (prev.scope !== scope || !prev.session || prev.session.submitted) return prev;
      const p = Math.max(prev.session.currentIndex - 1, 0);
      const updated: PrivateReviewSession = { ...prev.session, currentIndex: p };
      persist(updated);
      return { ...prev, session: updated };
    });
  }, [scope, persist]);

  const submit = useCallback(async (): Promise<boolean> => {
    if (authStatus !== "authenticated" || !ownerId) return false;
    const currentSession = state.scope === scope ? state.session : null;
    if (!currentSession || currentSession.submitted) return false;

    request.current.controller?.abort();
    const controller = new AbortController();
    const id = ++request.current.id;
    request.current.controller = controller;
    const generation = getSyncIdentityGeneration();
    const current = () => !controller.signal.aborted && request.current.id === id && getSyncIdentityGeneration() === generation;

    setState(prev => prev.scope === scope ? { ...prev, status: "submitting", error: null } : prev);
    try {
      const answers: Record<string, string> = {};
      for (const [qid, ans] of Object.entries(currentSession.answers)) {
        answers[qid] = ans ?? "";
      }
      const res = await fetch(`/api/private-papers/${encodeURIComponent(paperId)}/wrong-items/review/grade`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentHash: currentSession.contentHash, answers }),
        cache: "no-store",
        signal: controller.signal,
      });
      if (!res.ok) {
        const msg = res.status === 404 ? "该私有卷或错题已不存在" : res.status === 401 ? "登录状态已失效" : res.status === 422 ? "内容版本已更新，此批次失效，请重新开始复习" : "提交失败，请重试";
        throw new Error(msg);
      }
      const raw = await res.json();
      const questionIds = currentSession.questions.map(q => q.questionId);
      const result: PrivateReviewGradeResponse = parsePrivateReviewGrade(raw, ownerId, paperId, currentSession.contentHash, questionIds);
      const submitted: PrivateReviewSession = {
        ...currentSession,
        submitted: true,
        submittedAt: new Date().toISOString(),
        result,
      };
      persist(submitted);
      if (current()) setState({ scope, status: "submitted", session: submitted, error: null });
      return true;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return false;
      if (current()) setState(prev => prev.scope === scope ? { ...prev, status: "reviewing", error: error instanceof Error ? error.message : "提交失败" } : prev);
      return false;
    }
  }, [scope, authStatus, ownerId, paperId, state, persist]);

  const restart = useCallback(async () => {
    if (authStatus !== "authenticated" || !ownerId) return;
    // Clear old session
    const currentSession = state.scope === scope ? state.session : null;
    if (currentSession) {
      clearPrivateReviewSession(ownerId, paperId, currentSession.contentHash);
    }
    await startReview();
  }, [scope, authStatus, ownerId, paperId, state, startReview]);

  const currentState = state.scope === scope ? state : undefined;
  const unansweredCount = currentState?.session ? Object.values(currentState.session.answers).filter(a => a === null).length : 0;

  // Cleanup on unmount / scope change
  useEffect(() => {
    const requests = request.current;
    return () => { requests.controller?.abort(); requests.id++; };
  }, []);

  return {
    status: currentState?.status ?? "loading",
    session: currentState?.session ?? null,
    error: currentState?.error ?? null,
    startReview,
    selectAnswer,
    clearAnswer,
    goToQuestion,
    nextQuestion,
    prevQuestion,
    submit,
    restart,
    unansweredCount,
  };
}
