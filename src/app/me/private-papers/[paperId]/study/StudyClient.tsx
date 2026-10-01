"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RotateCcw,
  BookOpen,
  RefreshCw,
} from "lucide-react";
import type { PrivateFlatQuestion } from "@/lib/private-papers/readiness";
import { scorePrivateAnswers, countValidAnswers } from "@/lib/private-papers/readiness";
import {
  loadStudyProgress,
  saveStudyProgress,
  clearStudyProgress,
  getProgressStatusMessage,
  INITIAL_PROGRESS,
  type StudyProgressState,
  type ProgressLoadStatus,
} from "@/lib/private-papers/progress-storage";

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
  const { status } = useSession();

  const [studyState, setStudyState] = useState<StudyProgressState>(INITIAL_PROGRESS);
  const [progressStatus, setProgressStatus] = useState<ProgressLoadStatus>("no_archive");
  const [isRestoring, setIsRestoring] = useState(true);
  const [storageAvailable, setStorageAvailable] = useState(true);
  const [showUnansweredConfirm, setShowUnansweredConfirm] = useState(false);
  const [verifyStatus, setVerifyStatus] = useState<VerifyStatus>("idle");
  const [verifyMessage, setVerifyMessage] = useState<string | null>(null);

  const epochRef = useRef(0);
  const submitBtnRef = useRef<HTMLButtonElement>(null);
  const modalFirstBtnRef = useRef<HTMLButtonElement>(null);

  const { answers, currentIndex, submitted } = studyState;
  const total = questions.length;

  const answeredCount = useMemo(
    () => countValidAnswers(questions, answers),
    [questions, answers],
  );
  const unansweredCount = Math.max(0, total - answeredCount);

  const currentQuestion = questions[currentIndex];
  const score = useMemo(() => scorePrivateAnswers(questions, answers), [questions, answers]);

  const progressMessage = getProgressStatusMessage(progressStatus);

  // 1. 从 sessionStorage 恢复进度（仅挂载时执行一次；key 含 ownerId:paperId:contentHash）
  useEffect(() => {
    if (status !== "authenticated") return;
    if (!ready) return;
    const epoch = ++epochRef.current;
    const rafId = requestAnimationFrame(() => {
      if (epoch !== epochRef.current) return;
      const result = loadStudyProgress(ownerId, paperId, contentHash, questions);
      if (epoch !== epochRef.current) return;
      setStudyState({ answers: result.answers, currentIndex: result.currentIndex, submitted: result.submitted });
      setProgressStatus(result.status);
      setStorageAvailable(result.status !== "storage_read_failed");
      setIsRestoring(false);
    });
    return () => cancelAnimationFrame(rafId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, ready]);

  // 2. 权限与内容有效性重新验证
  const verifyPaper = useCallback(async () => {
    if (status !== "authenticated" || !ready || submitted) return;
    const epoch = epochRef.current;
    setVerifyStatus("verifying");
    setVerifyMessage(null);
    try {
      const res = await fetch(`/api/private-papers/${encodeURIComponent(paperId)}/verify`, { method: "GET", cache: "no-store" });
      if (epoch !== epochRef.current) return;
      if (res.status === 401 || res.status === 403) {
        setVerifyStatus("invalid");
        setVerifyMessage("登录状态已失效，请重新登录后再继续。");
        return;
      }
      if (res.status === 404) {
        setVerifyStatus("invalid");
        setVerifyMessage("该私有卷已被删除或您已失去访问权限，无法继续作答。");
        return;
      }
      if (!res.ok) {
        setVerifyStatus("failed");
        setVerifyMessage("无法验证试卷状态，请检查网络后重试。当前答案已保留在内存中。");
        return;
      }
      const data = await res.json();
      if (epoch !== epochRef.current) return;
      if (data.contentHash && data.contentHash !== contentHash) {
        setVerifyStatus("invalid");
        setVerifyMessage("试卷内容已被修改，旧作答进度已失效。请返回详情页重新开始。");
        return;
      }
      setVerifyStatus("verified");
      setVerifyMessage(null);
    } catch {
      if (epoch !== epochRef.current) return;
      setVerifyStatus("failed");
      setVerifyMessage("网络异常，无法验证试卷状态。当前答案已保留在内存中，请稍后重试。");
    }
  }, [status, ready, submitted, paperId, contentHash]);

  useEffect(() => {
    if (status === "authenticated" && ready && !submitted) { requestAnimationFrame(() => verifyPaper()); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, ready, submitted]);

  useEffect(() => {
    if (status !== "authenticated" || !ready || submitted) return;
    const handleVisibility = () => { if (document.visibilityState === "visible") { verifyPaper(); } };
    const handleFocus = () => { verifyPaper(); };
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("focus", handleFocus);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("focus", handleFocus);
    };
  }, [status, ready, submitted, verifyPaper]);

  // 3. 弹窗可访问性
  useEffect(() => {
    if (!showUnansweredConfirm) return;
    const t = setTimeout(() => { modalFirstBtnRef.current?.focus(); }, 0);
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); setShowUnansweredConfirm(false); }
    };
    document.addEventListener("keydown", handleKeyDown);
    const submitBtn = submitBtnRef.current;
    return () => {
      clearTimeout(t);
      document.removeEventListener("keydown", handleKeyDown);
      submitBtn?.focus();
    };
  }, [showUnansweredConfirm]);

  // 4. 操作函数
  function persistProgress(next: StudyProgressState) {
    if (!ready || verifyStatus === "invalid") return;
    const ok = saveStudyProgress(ownerId, paperId, contentHash, next);
    if (!ok && storageAvailable) {
      setStorageAvailable(false);
      setProgressStatus("storage_read_failed");
    }
  }

  function selectAnswer(questionIndex: number, optionId: string) {
    if (submitted || isRestoring || verifyStatus === "invalid") return;
    const next: StudyProgressState = { ...studyState, answers: { ...answers, [questionIndex]: optionId } };
    setStudyState(next);
    persistProgress(next);
  }

  function goTo(index: number) {
    if (index < 0 || index >= total || isRestoring || verifyStatus === "invalid") return;
    const next: StudyProgressState = { ...studyState, currentIndex: index };
    setStudyState(next);
    persistProgress(next);
  }

  async function handleSubmit() {
    if (submitted || isRestoring || verifyStatus === "invalid") return;
    if (verifyStatus !== "verified") {
      await verifyPaper();
      if ((verifyStatus as string) === "invalid" || verifyStatus === "failed") { return; }
    }
    if (unansweredCount > 0 && !showUnansweredConfirm) {
      setShowUnansweredConfirm(true);
      return;
    }
    const next: StudyProgressState = { ...studyState, submitted: true };
    setStudyState(next);
    setShowUnansweredConfirm(false);
    persistProgress(next);
    if (typeof window !== "undefined") { window.scrollTo({ top: 0, behavior: "smooth" }); }
  }

  function handleRetry() {
    clearStudyProgress(ownerId, paperId);
    setStudyState(INITIAL_PROGRESS);
    setShowUnansweredConfirm(false);
    setProgressStatus("no_archive");
    setVerifyStatus("idle");
  }

  // 5. 渲染
  if (status !== "authenticated") {
    return (<main className="me-page"><p className="me-loading">加载中…</p></main>);
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
            <button type="button" onClick={handleRetry} className="pp-primary-btn"><RotateCcw size={16} /> 重新练习</button>
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
          <button type="button" onClick={verifyPaper} className="pp-study-retry-btn" aria-label="重新验证"><RefreshCw size={14} /> 重试</button>
        </div>
      )}

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
                <button key={opt.id} type="button" className={`pp-study-option-btn ${selected ? "selected" : ""}`} onClick={() => selectAnswer(currentIndex, opt.id)} disabled={submitted}>
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
          <button type="button" className="pp-cancel-btn" onClick={() => goTo(currentIndex - 1)} disabled={currentIndex === 0}><ChevronLeft size={16} /> 上一题</button>
          {currentIndex < total - 1 ? (
            <button type="button" className="pp-primary-btn" onClick={() => goTo(currentIndex + 1)} >下一题 <ChevronRight size={16} /></button>
          ) : (
            <button ref={submitBtnRef} type="button" className="pp-primary-btn pp-submit-btn" onClick={handleSubmit} ><CheckCircle2 size={16} /> 提交答案</button>
          )}
        </div>
        <div className="pp-study-dots" role="navigation" aria-label="题目导航">
          {questions.map((q, i) => (
            <button key={q.questionId || i} type="button" className={`pp-study-dot ${i === currentIndex ? "current" : ""} ${answers[i] ? "answered" : ""}`} onClick={() => goTo(i)} aria-label={`第 ${i + 1} 题${answers[i] ? "（已答）" : "（未答）"}${i === currentIndex ? "（当前）" : ""}`} aria-current={i === currentIndex ? "true" : undefined} >{i + 1}</button>
          ))}
        </div>
      </section>

      {showUnansweredConfirm && (
        <div className="pp-modal-overlay" onClick={() => setShowUnansweredConfirm(false)} aria-hidden="true">
          <div className="pp-modal" role="dialog" aria-modal="true" aria-labelledby="pp-unanswered-title" aria-describedby="pp-unanswered-desc" onClick={(e) => e.stopPropagation()}>
            <h3 id="pp-unanswered-title">还有 {unansweredCount} 题未作答</h3>
            <p id="pp-unanswered-desc">确定要提交吗？未作答的题目将计为错误。</p>
            <div className="pp-modal-actions">
              <button ref={modalFirstBtnRef} type="button" className="pp-cancel-btn" onClick={() => setShowUnansweredConfirm(false)}>继续作答</button>
              <button type="button" className="pp-primary-btn pp-submit-btn" onClick={handleSubmit}>确认提交</button>
            </div>
          </div>
        </div>
      )}

      <div className="me-spacer" />
    </main>
  );
}
