"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { getSyncIdentityGeneration } from "@/lib/sync/adapters";
import { parsePrivateWrongItems } from "./wrong-items";
import { parsePrivateReviewStart, parsePrivateReviewGrade, restorePrivateReviewSession, savePrivateReviewSession, clearPrivateReviewSession, sameReviewQuestion, type PrivateReviewSession } from "./review";

export interface UsePrivateReviewSessionResult {
  status: "loading" | "idle" | "reviewing" | "submitting" | "submitted" | "error" | "invalid";
  session: PrivateReviewSession | null;
  error: string | null;
  storageError: string | null;
  startReview: () => Promise<void>;
  recheck: () => Promise<void>;
  selectAnswer: (questionId: string, optionId: string) => void;
  clearAnswer: (questionId: string) => void;
  goToQuestion: (index: number) => void;
  nextQuestion: () => void;
  prevQuestion: () => void;
  submit: () => Promise<boolean>;
  restart: () => Promise<void>;
  unansweredCount: number;
}
type State = Pick<UsePrivateReviewSessionResult, "status" | "session" | "error" | "storageError"> & { scope: string };
function message(error: unknown, fallback: string): string {
  return error instanceof Error && /[\u4e00-\u9fff]/.test(error.message) ? error.message : fallback;
}

export function usePrivateReviewSession(paperId: string): UsePrivateReviewSessionResult {
  const { data: authSession, status: authStatus } = useSession();
  const router = useRouter();
  const ownerId = authSession?.user?.id;
  const scope = JSON.stringify([authStatus, ownerId, paperId, getSyncIdentityGeneration()]);
  const [state, setState] = useState<State>({ scope, status: "loading", session: null, error: null, storageError: null });
  const live = useRef<State | null>(null);
  const activeScope = useRef<string | null>(null);
  const request = useRef<{ id: number; controller?: AbortController }>({ id: 0 });

  const commit = useCallback((next: State) => {
    if (activeScope.current !== next.scope) return;
    live.current = next;
    setState(next);
  }, []);
  const begin = useCallback(() => {
    request.current.controller?.abort();
    const controller = new AbortController(), id = ++request.current.id;
    request.current.controller = controller;
    const generation = getSyncIdentityGeneration();
    return { controller, current: () => activeScope.current === scope && !controller.signal.aborted && request.current.id === id && getSyncIdentityGeneration() === generation };
  }, [scope]);
  const persist = useCallback((session: PrivateReviewSession): string | null => {
    try { savePrivateReviewSession(session); return null; }
    catch (e) { return `${e instanceof Error ? e.message : "本地存档失败"}。当前答案仍保留在本页，刷新可能丢失进度。`; }
  }, []);

  const recheck = useCallback(async () => {
    if (authStatus !== "authenticated" || !ownerId || activeScope.current !== scope) return;
    const previous = live.current?.scope === scope ? live.current : null;
    const restored = previous ? { session: previous.session, warning: previous.storageError } : restorePrivateReviewSession(ownerId, paperId);
    const candidate = restored.session;
    const { controller, current } = begin();
    commit({ scope, status: "loading", session: candidate, error: null, storageError: restored.warning });
    try {
      // Existing owner-scoped GET reauthorizes before restoring a local batch.
      const res = await fetch(`/api/private-papers/${encodeURIComponent(paperId)}/wrong-items`, { cache: "no-store", signal: controller.signal });
      if (!current()) return;
      if (!res.ok) {
        if (res.status === 401 || res.status === 404) {
          commit({ scope, status: "invalid", session: null, storageError: restored.warning, error: res.status === 401 ? "登录状态已失效，请重新登录。" : "该私有卷已删除或你没有访问权限，请返回错题本。" });
          return;
        }
        throw new Error("无法确认复习批次，请重试；当前答案尚未提交。");
      }
      const data = parsePrivateWrongItems(await res.json(), ownerId, paperId);
      if (!current()) return;
      if (candidate && !candidate.questions.every(q => data.items.some(item => item.status === "active" && item.removedAt === null && item.contentHash === candidate.contentHash && item.questionId === q.questionId && item.question && sameReviewQuestion(q, { questionId: item.questionId, ...item.question })))) {
        let storageError = restored.warning;
        try { clearPrivateReviewSession(ownerId, paperId, candidate.contentHash); } catch (e) { storageError = e instanceof Error ? e.message : "旧存档清理失败"; }
        commit({ scope, status: "invalid", session: null, storageError, error: "内容版本或错题已变化，此批次失效，请重新开始复习。" });
        return;
      }
      if (candidate?.submitted) {
        // A saved result is untrusted browser data; confirm it with read-only server grading.
        const response = await fetch(`/api/private-papers/${encodeURIComponent(paperId)}/wrong-items/review/grade`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contentHash: candidate.contentHash, reviewBatchId: candidate.reviewBatchId, answers: candidate.answers }), cache: "no-store", signal: controller.signal });
        if (!current()) return;
        if ([401, 404, 422].includes(response.status)) {
          commit({ scope, status: "invalid", session: null, storageError: restored.warning, error: "无法访问原试卷或内容版本已变化，此批次失效，请重新开始复习。" });
          return;
        }
        if (!response.ok) throw new Error("无法确认已提交的复习结果，请重新检查。");
        const result = parsePrivateReviewGrade(await response.json(), ownerId, paperId, candidate.contentHash, candidate.questions.map(q => q.questionId), candidate.reviewBatchId);
        if (!current()) return;
        if (!result.results.every((r, i) => r.userAnswer === candidate.answers[r.questionId] && sameReviewQuestion(r, candidate.questions[i]))) throw new Error("已保存的复习结果与批次不一致，请重新检查。");
        const confirmed = { ...candidate, result };
        const storageError = persist(confirmed);
        commit({ scope, status: "submitted", session: confirmed, error: null, storageError });
      } else {
        commit({ scope, status: candidate ? "reviewing" : "idle", session: candidate, error: null, storageError: restored.warning });
      }
    } catch (e) {
      if (current()) commit({ scope, status: "error", session: candidate, storageError: restored.warning, error: message(e, "无法确认复习批次，请检查网络后重试；当前答案尚未提交。") });
    }
  }, [authStatus, ownerId, paperId, scope, begin, commit, persist]);

  const startReview = useCallback(async () => {
    if (authStatus !== "authenticated" || !ownerId || activeScope.current !== scope) return;
    const previous = live.current?.scope === scope ? live.current : null;
    const { controller, current } = begin();
    commit({ scope, status: "loading", session: previous?.session ?? null, error: null, storageError: previous?.storageError ?? null });
    try {
      const res = await fetch(`/api/private-papers/${encodeURIComponent(paperId)}/wrong-items/review/start`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ limit: 5 }), cache: "no-store", signal: controller.signal });
      if (!current()) return;
      if (!res.ok) throw new Error(res.status === 404 ? "该私有卷不存在或没有访问权限" : res.status === 401 ? "登录状态已失效，请重新登录" : res.status === 422 ? "当前内容版本没有可复习的错题" : "开始复习失败，请重试；原批次仍保留。");
      const data = parsePrivateReviewStart(await res.json(), ownerId);
      if (!current()) return;
      const session: PrivateReviewSession = { version: 1, ownerId, paperId, reviewBatchId: data.reviewBatchId, contentHash: data.contentHash, questions: data.questions, answers: Object.fromEntries(data.questions.map(q => [q.questionId, null])), currentIndex: 0, submitted: false, updatedAt: new Date().toISOString() };
      const storageError = persist(session);
      commit({ scope, status: "reviewing", session, error: null, storageError });
    } catch (e) {
      if (current()) commit({ scope, status: "error", session: previous?.session ?? null, storageError: previous?.storageError ?? null, error: message(e, "开始复习失败，请检查网络后重试；原批次仍保留。") });
    }
  }, [authStatus, ownerId, scope, paperId, begin, commit, persist]);

  useEffect(() => {
    activeScope.current = scope;
    live.current = null;
    if (authStatus === "unauthenticated") router.replace("/login?callbackUrl=/me/private-papers");
    const timer = window.setTimeout(() => { void recheck(); }, 0);
    const focus = () => { void recheck(); };
    const visible = () => { if (document.visibilityState === "visible") void recheck(); };
    window.addEventListener("focus", focus);
    document.addEventListener("visibilitychange", visible);
    const requests = request.current;
    return () => {
      clearTimeout(timer);
      activeScope.current = null;
      requests.controller?.abort(); requests.id++;
      window.removeEventListener("focus", focus);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [scope, authStatus, router, recheck]);

  // Storage writes happen outside state updaters, which React may replay.
  const edit = useCallback((update: (session: PrivateReviewSession) => PrivateReviewSession | null) => {
    const previous = live.current;
    if (activeScope.current !== scope || previous?.scope !== scope || previous.status !== "reviewing" || !previous.session || previous.session.submitted) return;
    const changed = update(previous.session);
    if (!changed) return;
    const session = { ...changed, updatedAt: new Date().toISOString() };
    const storageError = persist(session);
    commit({ ...previous, session, storageError });
  }, [scope, persist, commit]);
  const selectAnswer = useCallback((questionId: string, optionId: string) => edit(s => s.questions.find(q => q.questionId === questionId)?.options.some(o => o.id === optionId) ? { ...s, answers: { ...s.answers, [questionId]: optionId } } : null), [edit]);
  const clearAnswer = useCallback((questionId: string) => edit(s => s.questions.some(q => q.questionId === questionId) ? { ...s, answers: { ...s.answers, [questionId]: null } } : null), [edit]);
  const goToQuestion = useCallback((index: number) => edit(s => Number.isInteger(index) && index >= 0 && index < s.questions.length ? { ...s, currentIndex: index } : null), [edit]);
  const nextQuestion = useCallback(() => edit(s => ({ ...s, currentIndex: Math.min(s.currentIndex + 1, s.questions.length - 1) })), [edit]);
  const prevQuestion = useCallback(() => edit(s => ({ ...s, currentIndex: Math.max(s.currentIndex - 1, 0) })), [edit]);

  const submit = useCallback(async (): Promise<boolean> => {
    const previous = live.current;
    if (authStatus !== "authenticated" || !ownerId || previous?.scope !== scope || previous.status !== "reviewing" || !previous.session || previous.session.submitted) return false;
    const session = previous.session;
    const { controller, current } = begin();
    const sameBatch = () => current() && live.current?.session?.reviewBatchId === session.reviewBatchId;
    commit({ ...previous, status: "submitting", error: null });
    try {
      const res = await fetch(`/api/private-papers/${encodeURIComponent(paperId)}/wrong-items/review/grade`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contentHash: session.contentHash, reviewBatchId: session.reviewBatchId, answers: session.answers }), cache: "no-store", signal: controller.signal });
      if (!sameBatch()) return false;
      if (!res.ok) {
        if ([401, 404, 422].includes(res.status)) {
          commit({ ...previous, status: "invalid", session: null, error: res.status === 401 ? "登录状态已失效，请重新登录。" : "试卷或内容版本已变化，此批次失效，请重新开始复习。" });
          return false;
        }
        throw new Error("提交失败，答案已保留，结果尚未确认，请重试。");
      }
      const result = parsePrivateReviewGrade(await res.json(), ownerId, paperId, session.contentHash, session.questions.map(q => q.questionId), session.reviewBatchId);
      if (!sameBatch()) return false;
      if (!result.results.every((r, i) => r.userAnswer === session.answers[r.questionId] && sameReviewQuestion(r, session.questions[i]))) throw new Error("复习结果与当前答案不一致，请重新提交。");
      const submitted: PrivateReviewSession = { ...session, submitted: true, submittedAt: new Date().toISOString(), updatedAt: new Date().toISOString(), result };
      const storageError = persist(submitted);
      commit({ scope, status: "submitted", session: submitted, error: null, storageError });
      return true;
    } catch (e) {
      if (sameBatch()) commit({ ...previous, status: "reviewing", error: `提交失败，答案已保留，结果尚未确认，请重试。${message(e, "")}` });
      return false;
    }
  }, [authStatus, ownerId, scope, paperId, begin, commit, persist]);

  const visible = state.scope === scope ? state : null;
  return { status: visible?.status ?? "loading", session: visible?.session ?? null, error: visible?.error ?? null, storageError: visible?.storageError ?? null, startReview, recheck, selectAnswer, clearAnswer, goToQuestion, nextQuestion, prevQuestion, submit, restart: startReview, unansweredCount: visible?.session ? visible.session.questions.filter(q => visible.session?.answers[q.questionId] === null).length : 0 };
}
