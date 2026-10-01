"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  XCircle,
  AlertCircle,
  AlertTriangle,
  RotateCcw,
  BookOpen,
  RefreshCw,
  Cloud,
  CloudOff,
} from "lucide-react";
import type { PrivateFlatQuestion } from "@/lib/private-papers/readiness";
import { scorePrivateAnswers, countValidAnswers } from "@/lib/private-papers/readiness";
import {
  loadStudyProgress,
  saveStudyProgress,
  getProgressStatusMessage,
  INITIAL_PROGRESS,
  type StudyProgressState,
  type ProgressLoadStatus,
} from "@/lib/private-papers/progress-storage";
import {
  enqueuePrivateProgress,
  pushPrivateProgressQueue,
  fetchRemoteSnapshot,
  loadPrivateProgressQueue,
  discardPrivateProgressForOtherContent,
  PRIVATE_PROGRESS_SYNC_EVENT,
  generateAttemptId,
  clearPrivateProgressForPaper,
  type PrivateSyncStatus,
  type RemoteProgress,
} from "@/lib/private-papers/progress-sync";

interface StudyClientProps {
  ownerId: string;
  paperId: string;
  paperTitle: string;
  questions: PrivateFlatQuestion[];
  contentHash: string;
  ready: boolean;
  notReadyReason?: string;
}

type VerifyStatus = "idle" | "verifying" | "verified" | "failed" | "invalid";

export default function StudyClient({
  ownerId,
  paperId,
  paperTitle,
  questions,
  contentHash,
  ready,
  notReadyReason,
}: StudyClientProps) {
  const { status, data: session } = useSession();
  const identityMatches = status === "authenticated" && session?.user?.id === ownerId;
  const binding = `${ownerId}:${paperId}:${contentHash}`;
  const [restoredBinding, setRestoredBinding] = useState<string | null>(null);
  const [studyState, setStudyState] = useState<StudyProgressState>(INITIAL_PROGRESS);
  const [progressStatus, setProgressStatus] = useState<ProgressLoadStatus>("no_archive");
  const [storageAvailable, setStorageAvailable] = useState(true);
  const [showUnansweredConfirm, setShowUnansweredConfirm] = useState(false);
  const [verifyStatus, setVerifyStatus] = useState<VerifyStatus>("idle");
  const [verifyMessage, setVerifyMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // ── V14 Phase 1E.1: cloud sync state ──
  const [syncStatus, setSyncStatus] = useState<PrivateSyncStatus>("local_saved");
  const [conflictServerProgress, setConflictServerProgress] = useState<RemoteProgress | null>(null);
  const [showConflictDialog, setShowConflictDialog] = useState(false);
  const activeBinding = useRef<string | null>(null);
  const requestId = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const submitInFlight = useRef(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const submitBtnRef = useRef<HTMLButtonElement>(null);
  const modalFirstBtnRef = useRef<HTMLButtonElement>(null);
  const conflictDialogRef = useRef<HTMLDialogElement>(null);
  const conflictFirstBtnRef = useRef<HTMLButtonElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const knownRevisionRef = useRef(0);
  const syncGeneration = useRef(0);
  const studyRef = useRef(studyState);
  const updateStudy = useCallback((next: StudyProgressState) => { studyRef.current = next; setStudyState(next); }, []);
  const attemptIdRef = useRef<string | null>(null);
  if (attemptIdRef.current === null) attemptIdRef.current = generateAttemptId();
  const isRestoring = restoredBinding !== binding;
  const { answers, currentIndex, submitted } = studyState;
  const total = questions.length;
  const answeredCount = useMemo(() => countValidAnswers(questions, answers), [questions, answers]);
  const unansweredCount = Math.max(0, total - answeredCount);
  const currentQuestion = questions[currentIndex];
  const score = useMemo(() => scorePrivateAnswers(questions, answers), [questions, answers]);
  const progressMessage = getProgressStatusMessage(progressStatus);

  const pushSync = useCallback(async () => {
    if (activeBinding.current !== binding) return;
    const generation = syncGeneration.current;
    const attempt = attemptIdRef.current;
    const current = () => activeBinding.current === binding && generation === syncGeneration.current && attemptIdRef.current === attempt;
    try {
      const result = await pushPrivateProgressQueue({ userId: ownerId, paperId });
      if (!current()) return;
      if (result.invalid[paperId]) {
        setVerifyStatus("invalid");
        setVerifyMessage("试卷已删除、内容已变化或暂不能学习，请返回详情重新打开。当前答案不会继续上传。");
        return;
      }
      if (result.conflicts.includes(paperId)) {
        const snapshot = await fetchRemoteSnapshot(paperId);
        if (!current()) return;
        if (snapshot.progress && snapshot.progress.contentHash === contentHash) {
          setConflictServerProgress(snapshot.progress);
          setShowConflictDialog(true);
          setSyncStatus("conflict");
        } else setSyncStatus("failed");
        return;
      }
      if (result.revisions[paperId]) knownRevisionRef.current = Math.max(knownRevisionRef.current, result.revisions[paperId]);
      setSyncStatus(result.failed ? "failed" : result.pending ? "pending" : "synced");
    } catch {
      if (current()) setSyncStatus("failed");
    }
  }, [binding, ownerId, paperId, contentHash]);

  // Invalidate outstanding callbacks before any interaction after a session change.
  useLayoutEffect(() => {
    const requests = requestId;
    const controller = abortRef;
    const generations = syncGeneration;
    activeBinding.current = identityMatches ? binding : null;
    return () => {
      activeBinding.current = null;
      generations.current++;
      requests.current++;
      controller.current?.abort();
      if (debounceRef.current) { clearTimeout(debounceRef.current); debounceRef.current = null; }
    };
  }, [identityMatches, binding]);

  // Restore dirty local drafts before cloud hydration; a queue also survives tab closure.
  useEffect(() => {
    if (!identityMatches || !ready) return;
    let cancelled = false;
    (async () => {
      const local = loadStudyProgress(ownerId, paperId, contentHash, questions);
      let queue: ReturnType<typeof loadPrivateProgressQueue> = [];
      let queueReadable = true;
      try { discardPrivateProgressForOtherContent(ownerId, paperId, contentHash); queue = loadPrivateProgressQueue(ownerId).filter(m => m.entityId === paperId && m.payload.contentHash === contentHash); }
      catch { queueReadable = false; }
      let snapshot: Awaited<ReturnType<typeof fetchRemoteSnapshot>> | null = null;
      try { snapshot = await fetchRemoteSnapshot(paperId); } catch { /* Preserve local state and surface failed read. */ }
      if (cancelled || activeBinding.current !== binding) return;
      const pending = queue.at(-1)?.payload;
      const remote = snapshot?.progress;
      const validAnswers = (value: Record<number, string>) => Object.entries(value).every(([k,v]) => Number.isSafeInteger(Number(k)) && questions[Number(k)]?.options.some(o => o.id === v));
      if (remote && (!validAnswers(remote.answers) || remote.currentIndex >= total || remote.contentHash !== contentHash)) {
        setVerifyStatus("invalid"); setVerifyMessage("云端进度格式或内容已变化，请返回详情重新打开。");
        setRestoredBinding(binding); return;
      }
      // An old local archive without sync metadata is treated as a draft, never discarded.
      const dirty = !!pending || (local.status === "loaded" && (local.dirty || !local.attemptId));
      const draft = pending ? {
        answers: pending.answers as Record<number,string>, currentIndex: Number(pending.currentIndex), submitted: pending.submitted === true,
        attemptId: String(pending.attemptId), revision: Number(pending.baseRevision), dirty: true, mode: pending.mode === "restart" ? "restart" as const : "save" as const,
      } : local;
      let restored: StudyProgressState;
      if (dirty && validAnswers(draft.answers) && Number.isSafeInteger(draft.currentIndex) && draft.currentIndex >= 0 && draft.currentIndex < total) {
        restored = { answers: draft.answers, currentIndex: draft.currentIndex, submitted: draft.submitted, attemptId: draft.attemptId ?? remote?.attemptId ?? generateAttemptId(), revision: draft.revision ?? 0, dirty: true, mode: draft.mode ?? "save" };
      } else if (remote) {
        restored = { answers: remote.answers, currentIndex: remote.currentIndex, submitted: remote.submitted, attemptId: remote.attemptId, revision: remote.revision, dirty: false };
      } else {
        restored = { answers: local.answers, currentIndex: local.currentIndex, submitted: local.submitted, attemptId: local.attemptId ?? generateAttemptId(), revision: snapshot?.revision ?? local.revision ?? 0, dirty: local.status === "loaded", mode: snapshot?.invalidated ? "restart" : "save" };
      }
      attemptIdRef.current = restored.attemptId!;
      knownRevisionRef.current = restored.revision ?? 0;
      updateStudy(restored);
      setProgressStatus(local.status);
      setRestoredBinding(binding);
      const saved = saveStudyProgress(ownerId, paperId, contentHash, restored);
      setStorageAvailable(saved);
      if (!saved) setProgressStatus("storage_write_failed");
      if (!queueReadable) { setSyncStatus("failed"); return; }
      if (restored.dirty && !pending) {
        try { enqueuePrivateProgress(paperId, { attemptId: restored.attemptId!, contentHash, answers: restored.answers, currentIndex: restored.currentIndex, submitted: restored.submitted, baseRevision: restored.revision ?? 0, mode: restored.mode }); }
        catch { setSyncStatus("failed"); return; }
      }
      if (pending || restored.dirty) { setSyncStatus("pending"); void pushSync(); }
      else setSyncStatus(snapshot ? "synced" : "failed");
    })();
    return () => { cancelled = true; };
  }, [identityMatches, ready, binding, ownerId, paperId, contentHash, questions, total, pushSync, updateStudy]);

  useEffect(() => {
    if (!identityMatches || !ready) return;
    const online = () => { void pushSync(); };
    const acknowledge = (event: Event) => {
      const detail = (event as CustomEvent<{ userId: string; paperId: string; contentHash: string; attemptId: string; revision: number }>).detail;
      if (!detail || detail.userId !== ownerId || detail.paperId !== paperId || detail.contentHash !== contentHash || detail.attemptId !== attemptIdRef.current || activeBinding.current !== binding) return;
      knownRevisionRef.current = Math.max(knownRevisionRef.current, detail.revision);
      try {
        const pending = loadPrivateProgressQueue(ownerId).some(m => m.entityId === paperId);
        const next = { ...studyRef.current, attemptId: detail.attemptId, revision: knownRevisionRef.current, dirty: pending, mode: "save" as const };
        updateStudy(next);
        const saved = saveStudyProgress(ownerId, paperId, contentHash, next);
        if (!saved) setProgressStatus("storage_write_failed");
        setStorageAvailable(saved);
        setSyncStatus(pending ? "pending" : "synced");
      } catch { setSyncStatus("failed"); }
    };
    window.addEventListener("online", online);
    window.addEventListener(PRIVATE_PROGRESS_SYNC_EVENT, acknowledge);
    return () => { window.removeEventListener("online", online); window.removeEventListener(PRIVATE_PROGRESS_SYNC_EVENT, acknowledge); };
  }, [identityMatches, ready, ownerId, paperId, contentHash, binding, pushSync, updateStudy]);

  // Each operation awaits its own result. A superseded request can never authorize it.
  const verifyPaper = useCallback(async (): Promise<boolean> => {
    if (!identityMatches || !ready || activeBinding.current !== binding) return false;
    const id = ++requestId.current;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const current = () => id === requestId.current && activeBinding.current === binding;
    setVerifyStatus("verifying");
    setVerifyMessage(null);
    try {
      const res = await fetch(`/api/private-papers/${encodeURIComponent(paperId)}/verify`, { cache: "no-store", signal: controller.signal });
      if (!current()) return false;
      if (res.status === 401 || res.status === 403 || res.status === 404) {
        setVerifyStatus("invalid");
        setVerifyMessage(res.status === 404 ? "该私有卷已被删除或您已失去访问权限，无法继续作答。" : "登录状态已失效，请重新登录后再继续。");
        return false;
      }
      if (!res.ok) throw new Error("Verification unavailable");
      const data: unknown = await res.json();
      if (!current()) return false;
      if (!data || typeof data !== "object" || !("ownerId" in data) || !("contentHash" in data) || !("ready" in data)) throw new Error("Invalid verification response");
      if (data.ownerId !== ownerId || data.contentHash !== contentHash || data.ready !== true) {
        setVerifyStatus("invalid");
        setVerifyMessage("账号或试卷内容已变化，旧作答进度已失效。请返回列表或详情页重新开始。");
        return false;
      }
      setVerifyStatus("verified");
      return true;
    } catch {
      if (!current()) return false;
      setVerifyStatus("failed");
      setVerifyMessage("无法验证试卷状态，请检查网络后重试。当前答案保留在内存中。");
      return false;
    }
  }, [identityMatches, ready, binding, paperId, ownerId, contentHash]);

  useEffect(() => {
    if (!identityMatches || !ready) return;
    const raf = requestAnimationFrame(() => { void verifyPaper(); });
    const verifyVisible = () => {
      if (document.visibilityState === "visible" && !submitInFlight.current) void verifyPaper();
    };
    window.addEventListener("focus", verifyVisible);
    document.addEventListener("visibilitychange", verifyVisible);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("focus", verifyVisible);
      document.removeEventListener("visibilitychange", verifyVisible);
    };
  }, [identityMatches, ready, verifyPaper]);

  useEffect(() => {
    if (!showUnansweredConfirm) return;
    const dialog = dialogRef.current;
    const previous = submitBtnRef.current ?? document.activeElement;
    dialog?.showModal();
    modalFirstBtnRef.current?.focus();
    return () => {
      dialog?.close();
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
    };
  }, [showUnansweredConfirm]);

  // Conflict dialog focus management (mirrors the unanswered-confirm dialog).
  useEffect(() => {
    if (!showConflictDialog) return;
    const dialog = conflictDialogRef.current;
    const previous = document.activeElement;
    dialog?.showModal();
    conflictFirstBtnRef.current?.focus();
    return () => {
      dialog?.close();
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
    };
  }, [showConflictDialog]);

  function persistProgress(next: StudyProgressState) {
    if (activeBinding.current !== binding || !ready || verifyStatus === "invalid") return;
    const draft = { ...next, attemptId: attemptIdRef.current!, revision: knownRevisionRef.current, dirty: true };
    const ok = saveStudyProgress(ownerId, paperId, contentHash, draft);
    setStorageAvailable(ok);
    if (!ok) setProgressStatus("storage_write_failed");
    else if (progressStatus === "storage_write_failed" || progressStatus === "storage_read_failed") setProgressStatus("loaded");
    // Persist the queue immediately. Debounce only the network, not durable storage.
    try {
      enqueuePrivateProgress(paperId, { attemptId: draft.attemptId, contentHash, answers: draft.answers, currentIndex: draft.currentIndex, submitted: draft.submitted, baseRevision: draft.revision, mode: draft.mode });
      setSyncStatus("pending");
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => { if (activeBinding.current === binding) void pushSync(); }, 500);
    } catch { setSyncStatus("failed"); }
  }

  function selectAnswer(questionIndex: number, optionId: string) {
    if (activeBinding.current !== binding || submitted || isRestoring || submitInFlight.current || verifyStatus === "invalid") return;
    if (!questions[questionIndex]?.options.some(o => o.id === optionId)) return;
    const next = { ...studyState, answers: { ...answers, [questionIndex]: optionId } };
    updateStudy(next);
    persistProgress(next);
  }
  function goTo(index: number) {
    if (activeBinding.current !== binding || index < 0 || index >= total || isRestoring || submitInFlight.current || verifyStatus === "invalid") return;
    const next = { ...studyState, currentIndex: index };
    updateStudy(next);
    persistProgress(next);
  }

  function flushNow() {
    if (debounceRef.current) { clearTimeout(debounceRef.current); debounceRef.current = null; }
    void pushSync();
  }

  async function handleSubmit() {
    if (activeBinding.current !== binding || submitted || isRestoring || submitInFlight.current || verifyStatus === "invalid") return;
    submitInFlight.current = true;
    setIsSubmitting(true);
    try {
      if (!await verifyPaper() || activeBinding.current !== binding) return;
      if (unansweredCount > 0 && !showUnansweredConfirm) {
        setShowUnansweredConfirm(true);
        return;
      }
      const next = { ...studyState, submitted: true };
      updateStudy(next);
      setShowUnansweredConfirm(false);
      persistProgress(next);
      flushNow(); // submit must sync immediately
      window.scrollTo({ top: 0, behavior: "instant" });
    } finally {
      submitInFlight.current = false;
      if (activeBinding.current === binding) setIsSubmitting(false);
    }
  }
  async function handleRetry() {
    if (activeBinding.current !== binding || submitInFlight.current) return;
    submitInFlight.current = true; setIsSubmitting(true);
    try {
      if (!await verifyPaper() || activeBinding.current !== binding) return;
      const snapshot = await fetchRemoteSnapshot(paperId);
      if (activeBinding.current !== binding) return;
      syncGeneration.current++;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      attemptIdRef.current = generateAttemptId();
      knownRevisionRef.current = snapshot.revision;
      clearPrivateProgressForPaper(ownerId, paperId);
      const next: StudyProgressState = { ...INITIAL_PROGRESS, attemptId: attemptIdRef.current, revision: snapshot.revision, mode: "restart", dirty: true };
      updateStudy(next); setShowUnansweredConfirm(false); setShowConflictDialog(false); setConflictServerProgress(null);
      persistProgress(next); flushNow();
    } catch { if (activeBinding.current === binding) setSyncStatus("failed"); }
    finally { submitInFlight.current = false; if (activeBinding.current === binding) setIsSubmitting(false); }
  }

  async function handleAdoptCloud() {
    if (activeBinding.current !== binding) return;
    try {
      const snapshot = await fetchRemoteSnapshot(paperId);
      if (activeBinding.current !== binding || !snapshot.progress || snapshot.progress.contentHash !== contentHash) return;
      syncGeneration.current++;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      const remote = snapshot.progress;
      clearPrivateProgressForPaper(ownerId, paperId);
      attemptIdRef.current = remote.attemptId; knownRevisionRef.current = remote.revision;
      const next = { answers: remote.answers, currentIndex: remote.currentIndex, submitted: remote.submitted, attemptId: remote.attemptId, revision: remote.revision, dirty: false };
      updateStudy(next);
      const saved = saveStudyProgress(ownerId, paperId, contentHash, next);
      if (!saved) setProgressStatus("storage_write_failed");
      setStorageAvailable(saved); setShowConflictDialog(false); setConflictServerProgress(null); setSyncStatus("synced");
    } catch { if (activeBinding.current === binding) setSyncStatus("failed"); }
  }
  function handleKeepLocal() {
    const remote = conflictServerProgress;
    if (!remote || activeBinding.current !== binding) return;
    try {
      syncGeneration.current++;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      clearPrivateProgressForPaper(ownerId, paperId);
      const differentAttempt = attemptIdRef.current !== remote.attemptId;
      if (differentAttempt) attemptIdRef.current = generateAttemptId();
      knownRevisionRef.current = remote.revision;
      const next: StudyProgressState = { ...studyState, attemptId: attemptIdRef.current!, revision: remote.revision, dirty: true, mode: differentAttempt ? "restart" : "save" };
      updateStudy(next); setShowConflictDialog(false); setConflictServerProgress(null);
      persistProgress(next); flushNow();
    } catch { setSyncStatus("failed"); }
  }
  const handleRestartFromConflict = handleRetry;

  function renderConflictDialog() {
    return (<>
      {showConflictDialog && conflictServerProgress && (
        <dialog ref={conflictDialogRef} className="pp-modal pp-conflict-dialog" aria-labelledby="pp-conflict-title" aria-describedby="pp-conflict-desc" onCancel={() => setShowConflictDialog(false)} onKeyDown={(event) => {
            if (event.key !== "Tab") return;
            const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"));
            const first = buttons[0], last = buttons[buttons.length - 1];
            if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
            else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
          }}>
          <h3 id="pp-conflict-title"><AlertTriangle size={18} /> 进度冲突</h3>
          <p id="pp-conflict-desc">检测到其他设备对本篇有更新，请选择保留哪份进度。两端不同题目的作答不会自动合并。</p>
          <div className="pp-conflict-compare">
            <div className="pp-conflict-col">
              <strong>本机进度</strong>
              <p>已答 {answeredCount} 题 · 第 {currentIndex + 1}/{total} 题{submitted ? " · 已提交" : ""}</p>
            </div>
            <div className="pp-conflict-col">
              <strong>云端进度</strong>
              <p>已答 {Object.keys(conflictServerProgress.answers).length} 题 · 第 {conflictServerProgress.currentIndex + 1}/{total} 题{conflictServerProgress.submitted ? " · 已提交" : ""}</p>
              <p className="pp-preview-note">更新于 {conflictServerProgress.updatedAt ? new Date(conflictServerProgress.updatedAt).toLocaleString() : "—"}</p>
            </div>
          </div>
          <div className="pp-modal-actions">
            <button ref={conflictFirstBtnRef} type="button" className="pp-cancel-btn" onClick={handleAdoptCloud}>采用云端</button>
            <button type="button" className="pp-cancel-btn" onClick={handleKeepLocal}>保留本地</button>
            <button type="button" className="pp-primary-btn" onClick={handleRestartFromConflict}>重新开始</button>
          </div>
        </dialog>
      )}
    </>);
  }

  // 5. 渲染
  if (status !== "authenticated") {
    return (<main className="me-page"><p className="me-loading">加载中…</p></main>);
  }

  if (!identityMatches) {
    return <main className="me-page"><p role="alert">账号已变化，请返回列表重新打开私有卷。</p><Link href="/me/private-papers" className="pp-primary-btn">返回列表</Link></main>;
  }

  if (isRestoring && ready) {
    return (<main className="me-page"><p className="me-loading">正在恢复学习进度…</p></main>);
  }

  if (!ready) {
    return (
      <main className="me-page">
        <header className="me-header">
          <Link href={`/me/private-papers/${encodeURIComponent(paperId)}`} className="me-back-link" aria-label="返回"><ArrowLeft size={20} /></Link>
          <h1>开始学习</h1>
        </header>
        <div className="pp-error pp-error-large" role="alert">
          <AlertCircle size={24} />
          <p><strong>暂不能开始学习</strong></p>
          <p>{notReadyReason || "内容不符合本阶段学习要求。"}</p>
          <p className="pp-preview-note" style={{ marginTop: "12px", fontSize: "13px" }}>
            本阶段仅支持：reading section + careful_reading group + 内联 choice 选择题。草稿、缺少答案、包含听力/翻译/写作/完形/匹配等内容的卷暂不支持。
          </p>
          <Link href={`/me/private-papers/${encodeURIComponent(paperId)}`} className="pp-cancel-btn">返回详情</Link>
        </div>
        <div className="me-spacer" />
      </main>
    );
  }

  if (verifyStatus === "invalid") {
    return (
      <main className="me-page">
        <header className="me-header">
          <Link href={`/me/private-papers/${encodeURIComponent(paperId)}`} className="me-back-link" aria-label="返回"><ArrowLeft size={20} /></Link>
          <h1>无法继续</h1>
        </header>
        <div className="pp-error pp-error-large" role="alert">
          <AlertCircle size={24} />
          <p><strong>无法继续作答</strong></p>
          <p>{verifyMessage}</p>
          <div style={{ display: "flex", gap: "12px", marginTop: "16px", flexWrap: "wrap" }}>
            <Link href={`/me/private-papers/${encodeURIComponent(paperId)}`} className="pp-cancel-btn">返回详情</Link>
            <Link href="/me/private-papers" className="pp-primary-btn">返回列表</Link>
          </div>
        </div>
        <div className="me-spacer" />
      </main>
    );
  }

  if (submitted) {
    return (
      <main className="me-page">
        <header className="me-header">
          <Link href={`/me/private-papers/${encodeURIComponent(paperId)}`} className="me-back-link" aria-label="返回"><ArrowLeft size={20} /></Link>
          <h1>练习结果</h1>
        </header>
        {progressMessage && <div className="pp-study-status-banner" role="status">{progressMessage}</div>}
        {verifyStatus === "failed" && <div className="pp-study-status-banner" role="alert">{verifyMessage}<button type="button" onClick={() => void verifyPaper()} className="pp-study-retry-btn">重新验证</button></div>}
        {syncStatus === "failed" && (
          <div className="pp-sync-status-banner pp-sync-status-failed" role="alert">
            <CloudOff size={16} /><span>云端同步失败，当前结果已保留；请重试。</span>
            <button type="button" onClick={() => void pushSync()} className="pp-study-retry-btn"><RefreshCw size={14} /> 重试</button>
          </div>
        )}
        {syncStatus === "pending" && <div className="pp-sync-status-banner" role="status">等待云端同步…</div>}
        {syncStatus === "synced" && <div className="pp-sync-status-banner" role="status">进度已同步到云端</div>}
        {renderConflictDialog()}
        <section className="pp-detail-section">
          <div className="pp-study-score">
            <div className="pp-study-score-main">
              <span className="pp-study-score-num">{score.accuracy}</span>
              <span className="pp-study-score-unit">%</span>
            </div>
            <div className="pp-study-score-detail">
              <p>正确 <strong>{score.correct}</strong> / {score.total} 题</p>
              <p className="pp-preview-note">本阶段私有练习暂不计入 XP、Streak、学习统计、Daily Plan 或 Review。</p>
            </div>
          </div>
          <div className="pp-study-actions">
            <button type="button" onClick={handleRetry} disabled={isSubmitting} className="pp-primary-btn"><RotateCcw size={16} /> 重新练习</button>
            <Link href={`/me/private-papers/${encodeURIComponent(paperId)}`} className="pp-cancel-btn">返回详情</Link>
          </div>
        </section>
        <section className="pp-detail-section">
          <h3>答题回顾</h3>
          <div className="pp-study-review-list">
            {questions.map((q, i) => {
              const userAnswer = answers[i];
              const isCorrect = userAnswer === q.answerId;
              return (
                <div key={q.questionId || i} className={`pp-study-review-item ${isCorrect ? "correct" : "wrong"}`}>
                  <div className="pp-study-review-header">
                    <span className="pp-study-review-num">第 {i + 1} 题</span>
                    {isCorrect ? (<span className="pp-study-review-badge correct"><CheckCircle2 size={14} /> 正确</span>) : (<span className="pp-study-review-badge wrong"><XCircle size={14} /> 错误</span>)}
                  </div>
                  {q.passage && (<div className="pp-study-passage"><BookOpen size={14} /> 阅读材料<p>{q.passage}</p></div>)}
                  <p className="pp-study-prompt">{q.prompt}</p>
                  <div className="pp-study-options">
                    {q.options.map((opt) => {
                      const isUserAnswer = userAnswer === opt.id;
                      const isCorrectAnswer = q.answerId === opt.id;
                      let cls = "pp-study-option";
                      if (isCorrectAnswer) cls += " correct-answer";
                      else if (isUserAnswer) cls += " wrong-answer";
                      return (
                        <div key={opt.id} className={cls}>
                          <span className="pp-study-option-label">{opt.id}</span>
                          <span className="pp-study-option-text">{opt.text}</span>
                          {isCorrectAnswer && <CheckCircle2 size={16} className="pp-study-option-icon correct" />}
                          {isUserAnswer && !isCorrectAnswer && <XCircle size={16} className="pp-study-option-icon wrong" />}
                        </div>
                      );
                    })}
                  </div>
                  {(q.shortExplanation || q.detailedExplanation) && (<div className="pp-study-explanation"><strong>解析：</strong><p>{q.shortExplanation || q.detailedExplanation}</p></div>)}
                  {!q.shortExplanation && !q.detailedExplanation && (<p className="pp-study-no-explanation">暂无解析。</p>)}
                </div>
              );
            })}
          </div>
        </section>
        <div className="me-spacer" />
      </main>
    );
  }

  return (
    <main className="me-page">
      <header className="me-header">
        <Link href={`/me/private-papers/${encodeURIComponent(paperId)}`} className="me-back-link" aria-label="返回"><ArrowLeft size={20} /></Link>
        <h1>{paperTitle}</h1>
      </header>

      {progressMessage && (
        <div className="pp-study-status-banner" role="status"><AlertCircle size={16} /><span>{progressMessage}</span></div>
      )}

      {verifyStatus === "failed" && (
        <div className="pp-study-status-banner pp-study-status-warning" role="alert">
          <AlertCircle size={16} /><span>{verifyMessage}</span>
          <button type="button" onClick={() => void verifyPaper()} className="pp-study-retry-btn" aria-label="重新验证"><RefreshCw size={14} /> 重试</button>
        </div>
      )}

      <div className={`pp-sync-status-banner pp-sync-status-${syncStatus}`} role="status" aria-live="polite">
        {syncStatus === "local_saved" && (<><Cloud size={16} /><span>进度已保存在本地</span></>)}
        {syncStatus === "pending" && (<><Cloud size={16} /><span>正在同步到云端…</span></>)}
        {syncStatus === "synced" && (<><CheckCircle2 size={16} /><span>进度已同步到云端</span></>)}
        {syncStatus === "failed" && (
          <><CloudOff size={16} /><span>同步失败，将在网络恢复后重试</span>
            <button type="button" onClick={() => void pushSync()} className="pp-study-retry-btn" aria-label="重试同步"><RefreshCw size={14} /> 重试</button>
          </>
        )}
        {syncStatus === "conflict" && (
          <><AlertTriangle size={16} /><span>检测到其他设备的更新，请选择</span>
            <button type="button" onClick={() => setShowConflictDialog(true)} className="pp-study-retry-btn" aria-label="查看冲突">查看</button>
          </>
        )}
      </div>

      <section className="pp-detail-section">
        <div className="pp-study-progress">
          <div className="pp-study-progress-info">
            <span>第 {currentIndex + 1} / {total} 题</span>
            <span>已答 {answeredCount} 题</span>
          </div>
          <div className="pp-study-progress-bar">
            <div className="pp-study-progress-fill" style={{ width: `${total > 0 ? ((currentIndex + 1) / total) * 100 : 0}%` }} />
          </div>
          <p className="pp-preview-note" style={{ marginTop: "8px", fontSize: "12px" }}>
            {storageAvailable ? "进度保存在当前浏览器标签页，刷新后可恢复。" : "当前浏览器存储不可用，进度仅在本次会话内有效。"}
          </p>
        </div>
      </section>

      {currentQuestion && (
        <section className="pp-detail-section">
          {currentQuestion.passage && (<div className="pp-study-passage"><BookOpen size={14} /> 阅读材料<p>{currentQuestion.passage}</p></div>)}
          <h3 className="pp-study-prompt">{currentQuestion.prompt}</h3>
          <div className="pp-study-options">
            {currentQuestion.options.map((opt) => {
              const selected = answers[currentIndex] === opt.id;
              return (
                <button key={opt.id} type="button" className={`pp-study-option-btn ${selected ? "selected" : ""}`} onClick={() => selectAnswer(currentIndex, opt.id)} disabled={isSubmitting}>
                  <span className="pp-study-option-label">{opt.id}</span>
                  <span className="pp-study-option-text">{opt.text}</span>
                  {selected && <CheckCircle2 size={18} className="pp-study-option-check" />}
                </button>
              );
            })}
          </div>
        </section>
      )}

      <section className="pp-detail-section">
        <div className="pp-study-nav">
          <button type="button" className="pp-cancel-btn" onClick={() => goTo(currentIndex - 1)} disabled={currentIndex === 0 || isSubmitting}><ChevronLeft size={16} /> 上一题</button>
          {currentIndex < total - 1 ? (
            <button type="button" className="pp-primary-btn" onClick={() => goTo(currentIndex + 1)} disabled={isSubmitting}>下一题 <ChevronRight size={16} /></button>
          ) : (
            <button ref={submitBtnRef} type="button" className="pp-primary-btn pp-submit-btn" onClick={handleSubmit} disabled={isSubmitting}><CheckCircle2 size={16} /> 提交答案</button>
          )}
        </div>
        <div className="pp-study-dots" role="navigation" aria-label="题目导航">
          {questions.map((q, i) => (
            <button key={q.questionId || i} type="button" className={`pp-study-dot ${i === currentIndex ? "current" : ""} ${answers[i] ? "answered" : ""}`} onClick={() => goTo(i)} disabled={isSubmitting} aria-label={`第 ${i + 1} 题${answers[i] ? "（已答）" : "（未答）"}${i === currentIndex ? "（当前）" : ""}`} aria-current={i === currentIndex ? "true" : undefined} >{i + 1}</button>
          ))}
        </div>
      </section>

      {showUnansweredConfirm && (
        <dialog ref={dialogRef} className="pp-modal" aria-labelledby="pp-unanswered-title" aria-describedby="pp-unanswered-desc" onCancel={() => setShowUnansweredConfirm(false)} onKeyDown={(event) => {
            if (event.key !== "Tab") return;
            const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"));
            const first = buttons[0], last = buttons[buttons.length - 1];
            if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
            else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
          }}>
            <h3 id="pp-unanswered-title">还有 {unansweredCount} 题未作答</h3>
            <p id="pp-unanswered-desc">确定要提交吗？未作答的题目将计为错误。</p>
            <div className="pp-modal-actions">
              <button ref={modalFirstBtnRef} type="button" className="pp-cancel-btn" onClick={() => setShowUnansweredConfirm(false)}>继续作答</button>
              <button type="button" className="pp-primary-btn pp-submit-btn" onClick={handleSubmit} disabled={isSubmitting}>确认提交</button>
            </div>
        </dialog>
      )}

      {renderConflictDialog()}

      <div className="me-spacer" />
    </main>
  );
}
