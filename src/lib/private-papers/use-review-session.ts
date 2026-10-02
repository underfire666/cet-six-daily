"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { getSyncIdentityGeneration } from "@/lib/sync/adapters";
import { parsePrivateWrongItems } from "./wrong-items";
import { parsePrivateReviewStart, parsePrivateReviewGrade, restorePrivateReviewSession, savePrivateReviewSession, clearPrivateReviewSession, sameReviewQuestion, type PrivateReviewSession, type PrivateReviewQuestion } from "./review";

export interface UsePrivateReviewSessionResult {
  status: "loading" | "idle" | "reviewing" | "submitting" | "submitted" | "error" | "invalid";
  session: PrivateReviewSession | null;
  error: string | null;
  storageError: string | null;
  syncStatus: "idle" | "saving" | "saved" | "error" | "conflict";
  syncError: string | null;
  startReview: () => Promise<void>;
  recheck: () => Promise<void>;
  selectAnswer: (questionId: string, optionId: string) => void;
  clearAnswer: (questionId: string) => void;
  goToQuestion: (index: number) => void;
  nextQuestion: () => void;
  prevQuestion: () => void;
  submit: () => Promise<boolean>;
  restart: () => Promise<void>;
  resolveConflict: (choice: "cloud" | "local") => void;
  unansweredCount: number;
}

type State = Pick<UsePrivateReviewSessionResult, "status" | "session" | "error" | "storageError" | "syncStatus" | "syncError"> & { scope: string };

function message(error: unknown, fallback: string): string {
  return error instanceof Error && /[\u4e00-\u9fff]/.test(error.message) ? error.message : fallback;
}

function sessionFromServerProgress(p: { reviewBatchId: string; contentHash: string; questions: PrivateReviewQuestion[]; answers: Record<string, string | null>; currentIndex: number; submitted: boolean; result?: PrivateReviewSession["result"]; revision: number; updatedAt: string }, ownerId: string, paperId: string): PrivateReviewSession {
  return { version: 1, ownerId, paperId, reviewBatchId: p.reviewBatchId, contentHash: p.contentHash, questions: p.questions, answers: p.answers, currentIndex: p.currentIndex, submitted: p.submitted, submittedAt: p.submitted ? p.updatedAt : undefined, result: p.result, updatedAt: p.updatedAt };
}

export function usePrivateReviewSession(paperId: string): UsePrivateReviewSessionResult {
  const { data: authSession, status: authStatus } = useSession();
  const router = useRouter();
  const ownerId = authSession?.user?.id;
  const scope = JSON.stringify([authStatus, ownerId, paperId, getSyncIdentityGeneration()]);
  const [state, setState] = useState<State>({ scope, status: "loading", session: null, error: null, storageError: null, syncStatus: "idle", syncError: null });
  const live = useRef<State | null>(null);
  const activeScope = useRef<string | null>(null);
  const request = useRef<{ id: number; controller?: AbortController }>({ id: 0 });
  const serverRevision = useRef<number>(0);
  const dirty = useRef<boolean>(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSave = useRef<{ answers: Record<string, string | null>; currentIndex: number } | null>(null);

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

  const scheduleSave = useCallback((answers: Record<string, string | null>, currentIndex: number, immediate = false) => {
    pendingSave.current = { answers: { ...answers }, currentIndex };
    dirty.current = true;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    const doSave = async () => {
      if (!pendingSave.current || activeScope.current !== scope) return;
      const payload = pendingSave.current;
      pendingSave.current = null;
      const prev = live.current;
      if (!prev?.session || prev.session.submitted) return;
      commit({ ...prev, syncStatus: "saving", syncError: null });
      try {
        const res = await fetch(`/api/private-papers/${encodeURIComponent(paperId)}/wrong-items/review/progress/save`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reviewBatchId: prev.session.reviewBatchId, contentHash: prev.session.contentHash, answers: payload.answers, currentIndex: payload.currentIndex, baseRevision: serverRevision.current }),
          cache: "no-store",
        });
        if (res.status === 409) {
          const data = await res.json().catch(() => ({}));
          commit({ ...prev, syncStatus: "conflict", syncError: data.error || "云端有更新的复习进度" });
          return;
        }
        if (!res.ok) throw new Error("同步失败");
        const data = await res.json();
        serverRevision.current = data.revision;
        dirty.current = false;
        commit({ ...prev, syncStatus: "saved", syncError: null });
      } catch (e) {
        if (activeScope.current === scope) commit({ ...prev, syncStatus: "error", syncError: message(e, "答案同步失败，将在网络恢复后重试") });
      }
    };
    if (immediate) { void doSave(); }
    else { saveTimer.current = setTimeout(() => { void doSave(); }, 800); }
  }, [scope, paperId, commit]);

  const recheck = useCallback(async () => {
    if (authStatus !== "authenticated" || !ownerId || activeScope.current !== scope) return;
    const previous = live.current?.scope === scope ? live.current : null;
    const { controller, current } = begin();
    commit({ scope, status: "loading", session: previous?.session ?? null, error: null, storageError: previous?.storageError ?? null, syncStatus: previous?.syncStatus ?? "idle", syncError: previous?.syncError ?? null });
    try {
      // Fetch server review progress first
      const progressRes = await fetch(`/api/private-papers/${encodeURIComponent(paperId)}/wrong-items/review/progress`, { cache: "no-store", signal: controller.signal });
      if (!current()) return;
      let serverProgress: PrivateReviewSession | null = null;
      let serverInvalidated = false;
      if (progressRes.ok) {
        const data = await progressRes.json();
        if (data.progress) {
          serverProgress = sessionFromServerProgress(data.progress, ownerId, paperId);
          serverRevision.current = data.progress.revision;
        } else if (data.invalidated) {
          serverInvalidated = true;
        }
      }
      // Existing owner-scoped GET reauthorizes before restoring
      const res = await fetch(`/api/private-papers/${encodeURIComponent(paperId)}/wrong-items`, { cache: "no-store", signal: controller.signal });
      if (!current()) return;
      if (!res.ok) {
        if (res.status === 401 || res.status === 404) {
          commit({ scope, status: "invalid", session: null, storageError: null, error: res.status === 401 ? "登录状态已失效，请重新登录。" : "该私有卷已删除或你没有访问权限，请返回错题本。", syncStatus: "idle", syncError: null });
          return;
        }
        throw new Error("无法确认复习批次，请重试；当前答案尚未提交。");
      }
      const data = parsePrivateWrongItems(await res.json(), ownerId, paperId);
      if (!current()) return;

      // Decide which session to use: local dirty > server > local clean
      let candidate: PrivateReviewSession | null = null;
      let storageError: string | null = null;

      if (serverInvalidated) {
        // Server says batch is invalid (content changed or questions removed)
        if (previous?.session) {
          try { clearPrivateReviewSession(ownerId, paperId, previous.session.contentHash); } catch (e) { storageError = e instanceof Error ? e.message : "旧存档清理失败"; }
        }
        commit({ scope, status: "invalid", session: null, storageError, error: "内容版本或错题已变化，此批次失效，请重新开始复习。", syncStatus: "idle", syncError: null });
        return;
      }

      if (serverProgress) {
        // Validate server questions against current wrong items
        const serverValid = serverProgress.questions.every(q => data.items.some(item => item.status === "active" && item.removedAt === null && item.contentHash === serverProgress!.contentHash && item.questionId === q.questionId && item.question && sameReviewQuestion(q, { questionId: item.questionId, ...item.question })));
        if (!serverValid) {
          commit({ scope, status: "invalid", session: null, storageError: null, error: "内容版本或错题已变化，此批次失效，请重新开始复习。", syncStatus: "idle", syncError: null });
          return;
        }
        // If local has unsaved dirty changes and they differ from server, keep local
        if (dirty.current && previous?.session && previous.session.reviewBatchId === serverProgress.reviewBatchId) {
          candidate = previous.session;
        } else {
          candidate = serverProgress;
          dirty.current = false;
        }
      } else {
        // No server progress, try local
        const restored = previous ? { session: previous.session, warning: previous.storageError } : restorePrivateReviewSession(ownerId, paperId);
        candidate = restored.session;
        storageError = restored.warning;
      }

      // Validate candidate questions against current wrong items
      if (candidate && !candidate.questions.every(q => data.items.some(item => item.status === "active" && item.removedAt === null && item.contentHash === candidate!.contentHash && item.questionId === q.questionId && item.question && sameReviewQuestion(q, { questionId: item.questionId, ...item.question })))) {
        let sErr = storageError;
        try { clearPrivateReviewSession(ownerId, paperId, candidate.contentHash); } catch (e) { sErr = e instanceof Error ? e.message : "旧存档清理失败"; }
        commit({ scope, status: "invalid", session: null, storageError: sErr, error: "内容版本或错题已变化，此批次失效，请重新开始复习。", syncStatus: "idle", syncError: null });
        return;
      }

      if (candidate?.submitted) {
        // A saved result is untrusted browser data; confirm it with read-only server grading.
        const response = await fetch(`/api/private-papers/${encodeURIComponent(paperId)}/wrong-items/review/grade`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contentHash: candidate.contentHash, reviewBatchId: candidate.reviewBatchId, answers: candidate.answers, baseRevision: serverRevision.current }), cache: "no-store", signal: controller.signal });
        if (!current()) return;
        if ([401, 404, 422].includes(response.status)) {
          commit({ scope, status: "invalid", session: null, storageError, error: "无法访问原试卷或内容版本已变化，此批次失效，请重新开始复习。", syncStatus: "idle", syncError: null });
          return;
        }
        if (response.status === 409) {
          // Already submitted on server, adopt server result
          const resultData = await response.json().catch(() => ({}));
          if (resultData.submitted && resultData.questions) {
            const serverSession = sessionFromServerProgress(resultData, ownerId, paperId);
            serverRevision.current = resultData.revision;
            const sErr = persist(serverSession);
            commit({ scope, status: "submitted", session: serverSession, error: null, storageError: sErr, syncStatus: "saved", syncError: null });
            return;
          }
          throw new Error("无法确认已提交的复习结果，请重新检查。");
        }
        if (!response.ok) throw new Error("无法确认已提交的复习结果，请重新检查。");
        const result = parsePrivateReviewGrade(await response.json(), ownerId, paperId, candidate.contentHash, candidate.questions.map(q => q.questionId), candidate.reviewBatchId);
        if (!current()) return;
        if (!result.results.every((r, i) => r.userAnswer === candidate.answers[r.questionId] && sameReviewQuestion(r, candidate.questions[i]))) throw new Error("已保存的复习结果与批次不一致，请重新检查。");
        const confirmed = { ...candidate, result };
        const sErr = persist(confirmed);
        commit({ scope, status: "submitted", session: confirmed, error: null, storageError: sErr, syncStatus: dirty.current ? "idle" : "saved", syncError: null });
      } else {
        commit({ scope, status: candidate ? "reviewing" : "idle", session: candidate, error: null, storageError, syncStatus: dirty.current ? "idle" : (candidate ? "saved" : "idle"), syncError: null });
      }
    } catch (e) {
      if (current()) commit({ scope, status: "error", session: previous?.session ?? null, storageError: previous?.storageError ?? null, error: message(e, "无法确认复习批次，请检查网络后重试；当前答案尚未提交。"), syncStatus: previous?.syncStatus ?? "idle", syncError: previous?.syncError ?? null });
    }
  }, [authStatus, ownerId, paperId, scope, begin, commit, persist]);

  const startReview = useCallback(async () => {
    if (authStatus !== "authenticated" || !ownerId || activeScope.current !== scope) return;
    const previous = live.current?.scope === scope ? live.current : null;
    const { controller, current } = begin();
    commit({ scope, status: "loading", session: previous?.session ?? null, error: null, storageError: previous?.storageError ?? null, syncStatus: "saving", syncError: null });
    try {
      const res = await fetch(`/api/private-papers/${encodeURIComponent(paperId)}/wrong-items/review/start`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ limit: 5 }), cache: "no-store", signal: controller.signal });
      if (!current()) return;
      if (!res.ok) throw new Error(res.status === 404 ? "该私有卷不存在或没有访问权限" : res.status === 401 ? "登录状态已失效，请重新登录" : res.status === 422 ? "当前内容版本没有可复习的错题" : "开始复习失败，请重试；原批次仍保留。");
      const data = parsePrivateReviewStart(await res.json(), ownerId);
      if (!current()) return;
      const session: PrivateReviewSession = { version: 1, ownerId, paperId, reviewBatchId: data.reviewBatchId, contentHash: data.contentHash, questions: data.questions, answers: Object.fromEntries(data.questions.map(q => [q.questionId, null])), currentIndex: 0, submitted: false, updatedAt: new Date().toISOString() };
      serverRevision.current = data.revision ?? 1;
      dirty.current = false;
      const storageError = persist(session);
      commit({ scope, status: "reviewing", session, error: null, storageError, syncStatus: "saved", syncError: null });
    } catch (e) {
      if (current()) commit({ scope, status: "error", session: previous?.session ?? null, storageError: previous?.storageError ?? null, error: message(e, "开始复习失败，请检查网络后重试；原批次仍保留。"), syncStatus: "idle", syncError: null });
    }
  }, [authStatus, ownerId, scope, paperId, begin, commit, persist]);

  useEffect(() => {
    activeScope.current = scope;
    live.current = null;
    dirty.current = false;
    serverRevision.current = 0;
    if (authStatus === "unauthenticated") router.replace("/login?callbackUrl=/me/private-papers");
    const timer = window.setTimeout(() => { void recheck(); }, 0);
    const focus = () => { void recheck(); };
    const visible = () => { if (document.visibilityState === "visible") void recheck(); };
    window.addEventListener("focus", focus);
    document.addEventListener("visibilitychange", visible);
    const requests = request.current;
    return () => {
      clearTimeout(timer);
      if (saveTimer.current) clearTimeout(saveTimer.current);
      activeScope.current = null;
      requests.controller?.abort(); requests.id++;
      window.removeEventListener("focus", focus);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [scope, authStatus, router, recheck]);

  const edit = useCallback((update: (session: PrivateReviewSession) => PrivateReviewSession | null) => {
    const previous = live.current;
    if (activeScope.current !== scope || previous?.scope !== scope || previous.status !== "reviewing" || !previous.session || previous.session.submitted) return;
    const changed = update(previous.session);
    if (!changed) return;
    const session = { ...changed, updatedAt: new Date().toISOString() };
    const storageError = persist(session);
    commit({ ...previous, session, storageError });
    scheduleSave(session.answers, session.currentIndex);
  }, [scope, persist, commit, scheduleSave]);

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
    commit({ ...previous, status: "submitting", error: null, syncStatus: "saving", syncError: null });
    try {
      const res = await fetch(`/api/private-papers/${encodeURIComponent(paperId)}/wrong-items/review/grade`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contentHash: session.contentHash, reviewBatchId: session.reviewBatchId, answers: session.answers, baseRevision: serverRevision.current }), cache: "no-store", signal: controller.signal });
      if (!sameBatch()) return false;
      if (!res.ok) {
        if ([401, 404, 422].includes(res.status)) {
          commit({ ...previous, status: "invalid", session: null, error: res.status === 401 ? "登录状态已失效，请重新登录。" : "试卷或内容版本已变化，此批次失效，请重新开始复习。", syncStatus: "idle", syncError: null });
          return false;
        }
        if (res.status === 409) {
          commit({ ...previous, status: "reviewing", syncStatus: "conflict", syncError: "云端有更新的复习进度，请刷新后重试" });
          return false;
        }
        throw new Error("提交失败，答案已保留，结果尚未确认，请重试。");
      }
      const data = await res.json();
      if (!sameBatch()) return false;
      const submitted: PrivateReviewSession = { ...session, submitted: true, submittedAt: data.updatedAt || new Date().toISOString(), updatedAt: data.updatedAt || new Date().toISOString(), result: data.result };
      serverRevision.current = data.revision;
      dirty.current = false;
      const storageError = persist(submitted);
      commit({ scope, status: "submitted", session: submitted, error: null, storageError, syncStatus: "saved", syncError: null });
      return true;
    } catch (e) {
      if (sameBatch()) commit({ ...previous, status: "reviewing", error: `提交失败，答案已保留，结果尚未确认，请重试。${message(e, "")}`, syncStatus: "error", syncError: message(e, "提交同步失败") });
      return false;
    }
  }, [authStatus, ownerId, scope, paperId, begin, commit, persist]);

  const resolveConflict = useCallback((choice: "cloud" | "local") => {
    const previous = live.current;
    if (!previous || activeScope.current !== scope) return;
    if (choice === "cloud") {
      dirty.current = false;
      commit({ ...previous, syncStatus: "idle", syncError: null });
      void recheck();
    } else {
      // Keep local, force push with current server revision
      if (previous.session && !previous.session.submitted) {
        scheduleSave(previous.session.answers, previous.session.currentIndex, true);
      }
    }
  }, [scope, commit, recheck, scheduleSave]);

  const visible = state.scope === scope ? state : null;
  return {
    status: visible?.status ?? "loading",
    session: visible?.session ?? null,
    error: visible?.error ?? null,
    storageError: visible?.storageError ?? null,
    syncStatus: visible?.syncStatus ?? "idle",
    syncError: visible?.syncError ?? null,
    startReview, recheck, selectAnswer, clearAnswer, goToQuestion, nextQuestion, prevQuestion, submit, restart: startReview, resolveConflict,
    unansweredCount: visible?.session ? visible.session.questions.filter(q => visible.session?.answers[q.questionId] === null).length : 0,
  };
}
