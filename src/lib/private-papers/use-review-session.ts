"use client";
import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { getSyncIdentityGeneration } from "@/lib/sync/adapters";
import { restorePrivateReviewSession, savePrivateReviewSession, clearPrivateReviewSession, type PrivateReviewSession } from "./review";
import { PrivateReviewController, type ReviewState } from "./review-controller";

export interface UsePrivateReviewSessionResult extends ReviewState {
  startReview: () => Promise<void>; recheck: () => Promise<void>; retrySync: () => Promise<void>;
  selectAnswer: (questionId: string, optionId: string) => void; clearAnswer: (questionId: string) => void;
  goToQuestion: (index: number) => void; nextQuestion: () => void; prevQuestion: () => void;
  submit: () => Promise<boolean>; restart: () => Promise<void>;
  resolveConflict: (choice: "cloud" | "local") => void; unansweredCount: number;
}
const empty: ReviewState = { status: "loading", session: null, error: null, storageError: null, syncStatus: "idle", syncError: null };
export function usePrivateReviewSession(paperId: string): UsePrivateReviewSessionResult {
  const { data: authSession, status: authStatus } = useSession();
  const router = useRouter(), ownerId = authSession?.user?.id;
  const generation = getSyncIdentityGeneration();
  const scope = JSON.stringify([authStatus, ownerId, paperId, generation]);
  const [state, setState] = useState<ReviewState & { scope: string }>({ ...empty, scope });
  const active = useRef<PrivateReviewController | null>(null);
  useEffect(() => {
    if (authStatus !== "authenticated" || !ownerId) {
      if (authStatus === "unauthenticated") router.replace("/login?callbackUrl=/me/private-papers");
      return;
    }
    const controller: PrivateReviewController = new PrivateReviewController(ownerId, paperId, {
      fetch: (...args) => fetch(...args),
      readLocal: () => restorePrivateReviewSession(ownerId, paperId),
      writeLocal: savePrivateReviewSession,
      clearLocal: hash => clearPrivateReviewSession(ownerId, paperId, hash),
      isCurrent: () => active.current === controller && getSyncIdentityGeneration() === generation,
      onState: next => setState({ ...next, scope }),
    });
    active.current = controller;
    const timer = setTimeout(() => { void controller.load(); }, 0);
    const focus = () => { void controller.load(); };
    const visible = () => { if (document.visibilityState === "visible") void controller.load(); };
    const online = () => { void controller.load(); };
    window.addEventListener("focus", focus);
    window.addEventListener("online", online);
    document.addEventListener("visibilitychange", visible);
    return () => {
      clearTimeout(timer); controller.dispose();
      if (active.current === controller) active.current = null;
      window.removeEventListener("focus", focus);
      window.removeEventListener("online", online);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [authStatus, ownerId, paperId, scope, generation, router]);
  const edit = (update: (s: PrivateReviewSession) => PrivateReviewSession | null) => active.current?.edit(update);
  const visible = state.scope === scope ? state : empty;
  const startReview = async () => { await active.current?.start(); };
  const recheck = async () => { await active.current?.load(); };
  return {
    ...visible, startReview, recheck, retrySync: recheck, restart: startReview,
    selectAnswer: (qid, option) => edit(s => s.questions.find(q => q.questionId === qid)?.options.some(o => o.id === option) ? { ...s, answers: { ...s.answers, [qid]: option } } : null),
    clearAnswer: qid => edit(s => s.questions.some(q => q.questionId === qid) ? { ...s, answers: { ...s.answers, [qid]: null } } : null),
    goToQuestion: index => edit(s => Number.isInteger(index) && index >= 0 && index < s.questions.length ? { ...s, currentIndex: index } : null),
    nextQuestion: () => edit(s => ({ ...s, currentIndex: Math.min(s.currentIndex+1, s.questions.length-1) })),
    prevQuestion: () => edit(s => ({ ...s, currentIndex: Math.max(s.currentIndex-1,0) })),
    submit: async () => await active.current?.submit() ?? false,
    resolveConflict: choice => { void active.current?.load(choice); },
    unansweredCount: visible.session ? visible.session.questions.filter(q => visible.session?.answers[q.questionId] === null).length : 0,
  };
}
