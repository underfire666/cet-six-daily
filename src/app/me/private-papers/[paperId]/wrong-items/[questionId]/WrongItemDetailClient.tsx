"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, AlertCircle, Check, X, Clock, Trash2, RotateCcw, Loader2 } from "lucide-react";
import { usePrivateWrongManagement } from "@/lib/private-papers/use-wrong-management";
import { WrongItemRemoveDialog } from "@/components/private-papers/WrongItemRemoveDialog";
import { usePrivateWrongItems } from "@/lib/private-papers/use-wrong-items";
import { formatPrivateWrongDate as formatDate, type PrivateWrongItemView } from "@/lib/private-papers/wrong-items";

export default function WrongItemDetailClient({ paperId, questionId, contentHash }: { paperId: string; questionId: string; contentHash?: string }) {
  const { data, loading, error, refresh, scope: paperScope, ownerId } = usePrivateWrongItems(paperId);
  const scope = JSON.stringify([paperScope, questionId, contentHash]);
  const matches = data?.items.filter(item => item.questionId === questionId && (!contentHash || item.contentHash === contentHash)) ?? [];
  const item = matches.find(item => item.status === "active" && item.removedAt === null) ?? matches.find(item => item.removedAt !== null) ?? matches[0];

  const [removeDialog, setRemoveDialog] = useState<{ scope: string; item: PrivateWrongItemView } | null>(null);
  const management = usePrivateWrongManagement(scope, ownerId, refresh);
  const actionLoading = management.busy !== null, actionError = management.error;
  const closeDialog = () => { management.cancel(); setRemoveDialog(null); };
  const doRemove = async (target: PrivateWrongItemView) => { if (await management.run(target, "remove")) closeDialog(); };
  const doRestore = async (target: PrivateWrongItemView) => { await management.run(target, "restore"); };
  const dialogItem = !loading && !error && removeDialog?.scope === scope && item?.id === removeDialog.item.id && item.revision === removeDialog.item.revision && item.status === "active" && item.removedAt === null ? removeDialog.item : null;

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
          <button type="button" onClick={() => management.clearError()} className="pp-icon-btn" aria-label="关闭"><X size={16} /></button>
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
              onClick={() => setRemoveDialog({ scope, item })}
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

      <WrongItemRemoveDialog item={dialogItem} busy={actionLoading} error={actionError} onClose={closeDialog} onConfirm={() => { if (dialogItem) void doRemove(dialogItem); }} />

      <div className="me-spacer" />
    </main>
  );
}
