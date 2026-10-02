"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, AlertCircle, Check, X, Clock, Trash2, RotateCcw, Loader2 } from "lucide-react";
import { usePrivateWrongItems } from "@/lib/private-papers/use-wrong-items";
import { formatPrivateWrongDate as formatDate, type PrivateWrongItemView } from "@/lib/private-papers/wrong-items";

export default function WrongItemDetailClient({ paperId, questionId, contentHash }: { paperId: string; questionId: string; contentHash?: string }) {
  const { data, loading, error, refresh } = usePrivateWrongItems(paperId);
  const matches = data?.items.filter(item => item.questionId === questionId && (!contentHash || item.contentHash === contentHash)) ?? [];
  const item = matches.find(item => item.status === "active" && item.removedAt === null) ?? matches.find(item => item.removedAt !== null) ?? matches[0];

  const [removeDialog, setRemoveDialog] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const confirmBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (removeDialog && dialogRef.current) {
      dialogRef.current.showModal();
      setTimeout(() => confirmBtnRef.current?.focus(), 50);
    }
  }, [removeDialog]);

  const closeDialog = useCallback(() => {
    dialogRef.current?.close();
    setRemoveDialog(false);
  }, [setRemoveDialog]);

  const doRemove = useCallback(async (target: PrivateWrongItemView) => {
    setActionLoading(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/private-papers/${encodeURIComponent(paperId)}/wrong-items/${encodeURIComponent(target.questionId)}/remove`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentHash: target.contentHash, revision: target.revision }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || (res.status === 409 ? "该错题已被其他操作修改，请刷新后重试" : "移出错题本失败，请重试"));
      }
      closeDialog();
      await refresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "移出错题本失败，请重试");
    } finally {
      setActionLoading(false);
    }
  }, [paperId, refresh, closeDialog]);

  const doRestore = useCallback(async (target: PrivateWrongItemView) => {
    setActionLoading(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/private-papers/${encodeURIComponent(paperId)}/wrong-items/${encodeURIComponent(target.questionId)}/restore`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentHash: target.contentHash, revision: target.revision }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || (res.status === 409 ? "该错题已被其他操作修改，请刷新后重试" : "恢复错题失败，请重试"));
      }
      await refresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "恢复错题失败，请重试");
    } finally {
      setActionLoading(false);
    }
  }, [paperId, refresh]);

  if (loading) return <main className="me-page"><p className="me-loading">加载中…</p></main>;

  if (error || !item) {
    return (
      <main className="me-page">
        <header className="me-header">
          <Link href={`/me/private-papers/${encodeURIComponent(paperId)}/wrong-items`} className="me-back-link" aria-label="返回">
            <ArrowLeft size={20} />
          </Link>
          <h1>错题详情</h1>
        </header>
        <div className="pp-error pp-error-large" role="alert">
          <AlertCircle size={24} />
          <p>{error || "错题不存在"}</p>
          {error && <button type="button" className="pp-secondary-btn" onClick={() => { void refresh(); }}>重试</button>}
          <Link href={`/me/private-papers/${encodeURIComponent(paperId)}/wrong-items`} className="pp-cancel-btn">返回错题列表</Link>
        </div>
      </main>
    );
  }

  const isRemoved = item.removedAt !== null;
  const isRestorable = isRemoved && item.status === "active" && item.question;
  const { question } = item;

  if (item.status !== "active" || !question) return (
    <main className="me-page">
      <header className="me-header">
        <Link href={`/me/private-papers/${encodeURIComponent(paperId)}/wrong-items`} className="me-back-link" aria-label="返回">
          <ArrowLeft size={20} />
        </Link>
        <h1>错题详情</h1>
      </header>
      <section className="pp-detail-section" role="status">
        <h3>内容已更新，此错题已失效</h3>
        <p className="pp-preview-note">此记录属于旧版本，不使用新题目的答案或解析解释历史错题。</p>
        {isRemoved && <p className="pp-preview-note" style={{ color: "#6c757d" }}>该错题已于 {formatDate(item.removedAt!)} 移出错题本。</p>}
        <Link href={`/me/private-papers/${encodeURIComponent(paperId)}/wrong-items`} className="pp-secondary-btn">返回错题列表</Link>
        <Link href={`/me/private-papers/${encodeURIComponent(paperId)}`} className="pp-cancel-btn">返回试卷详情</Link>
      </section>
      <div className="me-spacer" />
    </main>
  );

  return (
    <main className="me-page">
      <header className="me-header">
        <Link href={`/me/private-papers/${encodeURIComponent(paperId)}/wrong-items`} className="me-back-link" aria-label="返回">
          <ArrowLeft size={20} />
        </Link>
        <h1>错题详情</h1>
      </header>

      {isRemoved && (
        <div className="pp-error" role="status" style={{ margin: "12px 16px", background: "rgba(108, 117, 125, 0.08)", borderColor: "rgba(108, 117, 125, 0.3)" }}>
          <AlertCircle size={18} style={{ color: "#6c757d" }} />
          <p style={{ color: "#6c757d" }}>该错题已于 {formatDate(item.removedAt!)} 移出错题本。移出仅隐藏，不代表已掌握；新一轮学习再次答错会重新收录。</p>
        </div>
      )}

      {actionError && (
        <div className="pp-error" role="alert" style={{ margin: "12px 16px" }}>
          <AlertCircle size={18} />
          <p>{actionError}</p>
          <button type="button" onClick={() => setActionError(null)} className="pp-icon-btn" aria-label="关闭"><X size={16} /></button>
        </div>
      )}

      {/* Meta */}
      <section className="pp-detail-section">
        <div className="pp-wrong-detail-meta">
          <div className="pp-wrong-meta-item">
            <span className="pp-wrong-meta-label">错误次数</span>
            <span className="pp-wrong-meta-value">{item.wrongCount}</span>
          </div>
          <div className="pp-wrong-meta-item">
            <span className="pp-wrong-meta-label"><Clock size={12} /> 首次答错</span>
            <span className="pp-wrong-meta-value">{formatDate(item.firstSeenAt)}</span>
          </div>
          <div className="pp-wrong-meta-item">
            <span className="pp-wrong-meta-label"><Clock size={12} /> 最近答错</span>
            <span className="pp-wrong-meta-value">{formatDate(item.lastSeenAt)}</span>
          </div>
        </div>
      </section>

      {/* Question */}
      <section className="pp-detail-section">
        <h3>题目</h3>
        <p className="pp-wrong-detail-prompt">{question.prompt}</p>
        <div className="pp-wrong-detail-options">
          {question.options.map((opt) => {
            const isUserAnswer = item.userAnswer === opt.id;
            const isCorrect = item.correctAnswer === opt.id;
            const isUnansweredWrong = item.userAnswer === null && isCorrect;
            let cls = "pp-wrong-option";
            if (isCorrect) cls += " correct";
            if (isUserAnswer && !isCorrect) cls += " wrong";
            return (
              <div key={opt.id} className={cls}>
                <div className="pp-wrong-option-marker">
                  {isCorrect ? <Check size={16} /> : isUserAnswer ? <X size={16} /> : null}
                </div>
                <div className="pp-wrong-option-text">
                  <span className="pp-wrong-option-id">{opt.id}</span>
                  <span>{opt.text}</span>
                </div>
                {isCorrect && <span className="pp-wrong-option-tag correct">正确答案</span>}
                {isUserAnswer && !isCorrect && <span className="pp-wrong-option-tag wrong">你的答案</span>}
                {isUnansweredWrong && <span className="pp-wrong-option-tag wrong">未作答</span>}
              </div>
            );
          })}
        </div>
        {item.userAnswer === null && (
          <p className="pp-wrong-detail-note unanswered">
            <AlertCircle size={14} /> 本题未作答，按判分规则计为错误。
          </p>
        )}
      </section>

      {/* Explanation */}
      {(question.shortExplanation || question.detailedExplanation) && (
        <section className="pp-detail-section">
          <h3>解析</h3>
          {question.shortExplanation && (
            <p className="pp-wrong-detail-explanation">{question.shortExplanation}</p>
          )}
          {question.detailedExplanation && (
            <p className="pp-wrong-detail-explanation detailed">{question.detailedExplanation}</p>
          )}
        </section>
      )}

      {/* Navigation */}
      <section className="pp-detail-section">
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
          <Link href={`/me/private-papers/${encodeURIComponent(paperId)}/wrong-items`} className="pp-secondary-btn" style={{ textDecoration: "none" }}>
            <ArrowLeft size={16} /> 返回错题列表
          </Link>
          <Link href={`/me/private-papers/${encodeURIComponent(paperId)}`} className="pp-cancel-btn" style={{ textDecoration: "none" }}>
            返回试卷详情
          </Link>
          {!isRemoved && (
            <button
              type="button"
              onClick={() => setRemoveDialog(true)}
              className="pp-wrong-remove-btn"
              disabled={actionLoading}
              style={{ marginLeft: "auto" }}
            >
              <Trash2 size={16} /> 移出错题本
            </button>
          )}
          {isRestorable && (
            <button
              type="button"
              onClick={() => { void doRestore(item); }}
              className="pp-primary-btn"
              disabled={actionLoading}
              style={{ marginLeft: "auto" }}
            >
              {actionLoading ? <Loader2 size={16} className="spin" /> : <RotateCcw size={16} />}
              恢复到错题本
            </button>
          )}
        </div>
      </section>

      <dialog ref={dialogRef} className="pp-modal pp-remove-dialog" onCancel={closeDialog}>
        <div className="pp-modal-content">
          <div className="pp-modal-header">
            <h3>移出错题本</h3>
            <button type="button" onClick={closeDialog} className="pp-icon-btn" aria-label="关闭"><X size={18} /></button>
          </div>
          <div className="pp-modal-body">
            <p style={{ margin: "0 0 12px" }}>确定要将这道错题移出错题本吗？</p>
            <div className="pp-modal-warning">
              <AlertCircle size={18} />
              <div>
                <p style={{ margin: "0 0 4px", fontWeight: 600 }}>移出仅隐藏，不代表已掌握</p>
                <p style={{ margin: 0, fontSize: "13px", color: "var(--pp-text-muted)" }}>
                  以后在原私有卷的新一轮学习中再次答错，这道题会重新进入错题本。同一次提交的重试不会重新收录。
                </p>
              </div>
            </div>
            <div className="pp-modal-item-preview">
              <p style={{ margin: 0, fontSize: "13px", color: "var(--pp-text-muted)" }}>题目：</p>
              <p style={{ margin: "4px 0 0", fontWeight: 500 }}>{question.prompt}</p>
            </div>
          </div>
          <div className="pp-modal-footer">
            <button type="button" onClick={closeDialog} className="pp-cancel-btn">取消</button>
            <button
              type="button"
              ref={confirmBtnRef}
              onClick={() => { void doRemove(item); }}
              className="pp-danger-btn"
              disabled={actionLoading}
            >
              {actionLoading ? <Loader2 size={16} className="spin" /> : <Trash2 size={16} />}
              确认移出
            </button>
          </div>
        </div>
      </dialog>

      <div className="me-spacer" />
    </main>
  );
}
