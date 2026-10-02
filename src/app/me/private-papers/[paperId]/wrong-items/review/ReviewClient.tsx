"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, AlertCircle, Loader2, BookOpen, CheckCircle2, XCircle, RotateCcw, ChevronLeft, ChevronRight } from "lucide-react";
import { usePrivateReviewSession } from "@/lib/private-papers/use-review-session";

function optionLabel(id: string, options: Array<{ id: string; text: string }>) {
  return options.find(o => o.id === id)?.text ?? id;
}

export default function ReviewClient({ paperId }: { paperId: string }) {
  const review = usePrivateReviewSession(paperId);
  const [showConfirm, setShowConfirm] = useState(false);
  const confirmRef = useRef<HTMLDivElement>(null);

  // Close confirm on Escape
  useEffect(() => {
    if (!showConfirm) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setShowConfirm(false); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [showConfirm]);

  const handleSubmitClick = () => {
    if (review.unansweredCount > 0) {
      setShowConfirm(true);
    } else {
      void review.submit();
    }
  };

  const handleConfirmSubmit = () => {
    setShowConfirm(false);
    void review.submit();
  };

  const session = review.session;
  const currentQ = session?.questions[session.currentIndex];

  return (
    <main className="me-page">
      <header className="me-header">
        <Link href={`/me/private-papers/${encodeURIComponent(paperId)}/wrong-items`} className="me-back-link" aria-label="返回错题本">
          <ArrowLeft size={20} />
        </Link>
        <h1>错题复习</h1>
      </header>

      {/* Loading */}
      {review.status === "loading" && (
        <p className="me-loading">加载中…</p>
      )}

      {/* Error */}
      {review.status === "error" && (
        <div className="pp-error pp-error-large" role="alert">
          <AlertCircle size={24} />
          <p>{review.error}</p>
          <button type="button" onClick={() => { void review.startReview(); }} className="pp-primary-btn">重试</button>
          <Link href={`/me/private-papers/${encodeURIComponent(paperId)}/wrong-items`} className="pp-cancel-btn">返回错题本</Link>
        </div>
      )}

      {/* Idle — not started */}
      {review.status === "idle" && (
        <div className="pp-empty-state">
          <BookOpen size={48} style={{ opacity: 0.3, marginBottom: "12px" }} />
          <h3 style={{ margin: "0 0 8px" }}>开始错题复习</h3>
          <p className="pp-preview-note" style={{ maxWidth: "340px", textAlign: "center" }}>
            每次最多复习 5 道当前内容版本仍有效的错题，按最近答错时间排序。复习进度仅保存在当前浏览器，不影响原学习记录、错题次数或 XP。
          </p>
          <button type="button" onClick={() => { void review.startReview(); }} className="pp-primary-btn" style={{ marginTop: "16px" }}>
            开始复习
          </button>
          <Link href={`/me/private-papers/${encodeURIComponent(paperId)}/wrong-items`} className="pp-cancel-btn" style={{ marginTop: "8px", textDecoration: "none" }}>
            返回错题本
          </Link>
        </div>
      )}

      {/* Reviewing / Submitting */}
      {(review.status === "reviewing" || review.status === "submitting") && session && currentQ && (
        <>
          {/* Progress indicator */}
          <div className="pp-review-progress">
            <span className="pp-review-progress-text">
              第 {session.currentIndex + 1} / {session.questions.length} 题
            </span>
            <div className="pp-review-dots">
              {session.questions.map((q, i) => (
                <button
                  key={q.questionId}
                  type="button"
                  onClick={() => review.goToQuestion(i)}
                  className={`pp-review-dot ${i === session.currentIndex ? "active" : ""} ${session.answers[q.questionId] ? "answered" : ""}`}
                  aria-label={`第 ${i + 1} 题`}
                />
              ))}
            </div>
          </div>

          {/* Question card */}
          <div className="pp-review-question-card">
            {currentQ.passage && (
              <div className="pp-review-passage">
                <h4>阅读材料</h4>
                <p>{currentQ.passage}</p>
              </div>
            )}
            <h3 className="pp-review-prompt">{currentQ.prompt}</h3>
            <div className="pp-review-options">
              {currentQ.options.map(opt => {
                const selected = session.answers[currentQ.questionId] === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => review.selectAnswer(currentQ.questionId, opt.id)}
                    className={`pp-review-option ${selected ? "selected" : ""}`}
                    disabled={review.status === "submitting"}
                  >
                    <span className="pp-review-option-id">{opt.id}</span>
                    <span className="pp-review-option-text">{opt.text}</span>
                    {selected && <CheckCircle2 size={18} className="pp-review-option-check" />}
                  </button>
                );
              })}
            </div>
            {session.answers[currentQ.questionId] && (
              <button type="button" onClick={() => review.clearAnswer(currentQ.questionId)} className="pp-review-clear-answer" disabled={review.status === "submitting"}>
                清除选择
              </button>
            )}
          </div>

          {/* Navigation */}
          <div className="pp-review-nav">
            <button
              type="button"
              onClick={review.prevQuestion}
              disabled={session.currentIndex === 0 || review.status === "submitting"}
              className="pp-secondary-btn"
            >
              <ChevronLeft size={16} /> 上一题
            </button>
            {session.currentIndex < session.questions.length - 1 ? (
              <button
                type="button"
                onClick={review.nextQuestion}
                disabled={review.status === "submitting"}
                className="pp-primary-btn"
              >
                下一题 <ChevronRight size={16} />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmitClick}
                disabled={review.status === "submitting"}
                className="pp-primary-btn"
              >
                {review.status === "submitting" ? <><Loader2 size={16} className="spin" /> 提交中…</> : "提交复习"}
              </button>
            )}
          </div>

          {review.unansweredCount > 0 && review.status === "reviewing" && (
            <p className="pp-review-unanswered-note">
              <AlertCircle size={14} /> 还有 {review.unansweredCount} 题未作答，提交后计为错误。
            </p>
          )}
        </>
      )}

      {/* Submitted — results */}
      {review.status === "submitted" && session?.result && (
        <>
          <div className="pp-review-result-summary">
            <div className="pp-review-result-score">
              <span className="pp-review-result-correct">{session.result.correct}</span>
              <span className="pp-review-result-total">/ {session.result.total} 正确</span>
            </div>
            {session.result.unanswered > 0 && (
              <p className="pp-review-result-unanswered">
                <AlertCircle size={14} /> {session.result.unanswered} 题未作答，已计为错误。
              </p>
            )}
            <p className="pp-preview-note" style={{ fontSize: "12px", marginTop: "8px" }}>
              复习结果仅保存在当前浏览器，不修改错题次数、学习进度或 XP。
            </p>
          </div>

          <div className="pp-review-result-list">
            {session.result.results.map((r, idx) => (
              <div key={r.questionId} className={`pp-review-result-item ${r.isCorrect ? "correct" : "wrong"}`}>
                <div className="pp-review-result-header">
                  <span className="pp-review-result-index">第 {idx + 1} 题</span>
                  {r.isCorrect
                    ? <span className="pp-review-result-tag correct"><CheckCircle2 size={14} /> 答对</span>
                    : <span className="pp-review-result-tag wrong"><XCircle size={14} /> {r.userAnswer === null ? "未作答" : "答错"}</span>}
                </div>
                <p className="pp-review-result-prompt">{r.prompt}</p>
                <div className="pp-review-result-answers">
                  <div className={`pp-wrong-answer ${r.isCorrect ? "correct" : "wrong"}`}>
                    <span className="pp-wrong-answer-label">你的答案</span>
                    <span className="pp-wrong-answer-text">{r.userAnswer === null ? "未作答" : optionLabel(r.userAnswer, r.options)}</span>
                  </div>
                  <div className="pp-wrong-answer correct">
                    <span className="pp-wrong-answer-label">正确答案</span>
                    <span className="pp-wrong-answer-text">{optionLabel(r.correctAnswer, r.options)}</span>
                  </div>
                </div>
                {(r.shortExplanation || r.detailedExplanation) && (
                  <div className="pp-review-result-explanation">
                    <h4>解析</h4>
                    {r.shortExplanation && <p>{r.shortExplanation}</p>}
                    {r.detailedExplanation && <p style={{ whiteSpace: "pre-wrap" }}>{r.detailedExplanation}</p>}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="pp-review-result-actions">
            <button type="button" onClick={() => { void review.restart(); }} className="pp-primary-btn">
              <RotateCcw size={16} /> 重新复习
            </button>
            <Link href={`/me/private-papers/${encodeURIComponent(paperId)}/wrong-items`} className="pp-cancel-btn" style={{ textDecoration: "none" }}>
              返回错题本
            </Link>
          </div>
        </>
      )}

      {/* Confirm submit dialog */}
      {showConfirm && (
        <div className="pp-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
          <div className="pp-modal" ref={confirmRef}>
            <h3 id="confirm-title">确认提交复习？</h3>
            <p>还有 <strong>{review.unansweredCount}</strong> 题未作答，提交后将计为错误。提交后本批答案不可修改。</p>
            <div className="pp-modal-actions">
              <button type="button" onClick={() => setShowConfirm(false)} className="pp-cancel-btn" autoFocus>
                继续作答
              </button>
              <button type="button" onClick={handleConfirmSubmit} className="pp-primary-btn">
                确认提交
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="me-spacer" />
    </main>
  );
}
