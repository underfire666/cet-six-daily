"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, AlertCircle, Loader2, BookX, RefreshCw, ChevronRight, Trash2, RotateCcw, X } from "lucide-react";
import { usePrivateWrongManagement } from "@/lib/private-papers/use-wrong-management";
import { WrongItemRemoveDialog } from "@/components/private-papers/WrongItemRemoveDialog";
import { usePrivateWrongItems } from "@/lib/private-papers/use-wrong-items";
import { formatPrivateWrongDate as formatDate, type PrivateWrongItemView } from "@/lib/private-papers/wrong-items";

function optionLabel(id: string, options: Array<{id: string; text: string}>) { return options.find(o => o.id === id)?.text ?? id; }

interface RemoveDialogState { scope: string; item: PrivateWrongItemView; }

export default function WrongItemsClient({ paperId }: { paperId: string }) {
  const { data, loading, error, refresh, scope, ownerId } = usePrivateWrongItems(paperId);
  const items = data?.items ?? [];
  const counts = data?.counts ?? { active: 0, removed: 0, contentChanged: 0, total: 0 };
  const refreshing = loading;

  const [removeDialog, setRemoveDialog] = useState<RemoveDialogState | null>(null);
  const management = usePrivateWrongManagement(scope, ownerId, refresh);
  const actionLoading = management.busy, actionError = management.error;
  const activeItems = items.filter(item => item.removedAt === null && item.status === "active" && item.question);
  const removedItems = items.filter(item => item.removedAt !== null);
  const invalidItems = items.filter(item => item.removedAt === null && (item.status !== "active" || !item.question));

  const closeDialog = () => { management.cancel(); setRemoveDialog(null); };
  const doRemove = async (item: PrivateWrongItemView) => { if (await management.run(item, "remove")) closeDialog(); };
  const doRestore = async (item: PrivateWrongItemView) => { await management.run(item, "restore"); };
  const dialogItem = !loading && !error && removeDialog?.scope === scope && items.some(i => i.id === removeDialog.item.id && i.revision === removeDialog.item.revision && i.status === "active" && i.removedAt === null) ? removeDialog.item : null;

  if (loading) {
    return (
      <main className="me-page">
        <p className="me-loading">加载中…</p>
      </main>
    );
  }

  return (
    <main className="me-page">
      <header className="me-header">
        <Link href={`/me/private-papers/${encodeURIComponent(paperId)}`} className="me-back-link" aria-label="返回">
          <ArrowLeft size={20} />
        </Link>
        <h1>私有错题本</h1>
        <button
          type="button"
          onClick={() => { void refresh(); }}
          className="pp-icon-btn pp-wrong-refresh"
          disabled={refreshing}
          aria-label="刷新"
          style={{ marginLeft: "auto" }}
        >
          {refreshing ? <Loader2 size={18} className="spin" /> : <RefreshCw size={18} />}
        </button>
      </header>

      {error && (
        <div className="pp-error pp-error-large" role="alert">
          <AlertCircle size={24} />
          <p>{error}</p>
          <button type="button" onClick={() => { void refresh(); }} className="pp-secondary-btn">重试</button>
          <Link href={`/me/private-papers/${encodeURIComponent(paperId)}`} className="pp-cancel-btn">返回详情</Link>
        </div>
      )}

      {actionError && (
        <div className="pp-error" role="alert" style={{ margin: "12px 16px" }}>
          <AlertCircle size={18} />
          <p>{actionError}</p>
          <button type="button" onClick={() => management.clearError()} className="pp-icon-btn" aria-label="关闭错误提示"><X size={16} /></button>
        </div>
      )}

      {!error && items.length === 0 && (
        <div className="pp-empty-state">
          <BookX size={48} style={{ opacity: 0.3, marginBottom: "12px" }} />
          <h3 style={{ margin: "0 0 8px" }}>暂无错题</h3>
          <p className="pp-preview-note" style={{ maxWidth: "320px", textAlign: "center" }}>
            完成学习并提交后，答错的题目会自动收录到这里。仅记录当前内容版本的有效错题，不回填历史提交。
          </p>
          <Link href={`/me/private-papers/${encodeURIComponent(paperId)}/study`} className="pp-primary-btn" style={{ marginTop: "16px", textDecoration: "none" }}>
            开始学习
          </Link>
        </div>
      )}

      {!error && items.length > 0 && (
        <>
          <div className="pp-wrong-list-header">
            <p className="pp-preview-note" style={{ margin: 0 }}>
              共 <strong>{counts.active}</strong> 道有效错题
              {counts.removed > 0 ? `，${counts.removed} 道已移出` : ""}
              {counts.contentChanged > 0 ? `，${counts.contentChanged} 道旧版本已失效` : ""}
              。按最近答错时间排序。
            </p>
            {counts.active > 0 ? (
              <Link href={`/me/private-papers/${encodeURIComponent(paperId)}/wrong-items/review`} className="pp-primary-btn pp-wrong-review-btn" style={{ textDecoration: "none", whiteSpace: "nowrap" }}>
                复习错题
              </Link>
            ) : (
              <span className="pp-wrong-review-disabled" title="当前内容版本没有有效错题">
                复习错题
              </span>
            )}
          </div>

          {activeItems.length > 0 && (
            <div className="pp-wrong-section">
              <h2 className="pp-wrong-section-title">有效错题（{activeItems.length}）</h2>
              <div className="pp-wrong-list">
                {activeItems.map((item, idx) => (
                  <div key={item.id} className="pp-wrong-item-card pp-wrong-item-card-clickable">
                    <Link
                      href={`/me/private-papers/${encodeURIComponent(paperId)}/wrong-items/${encodeURIComponent(item.questionId)}?contentHash=${encodeURIComponent(item.contentHash)}`}
                      className="pp-wrong-item-link"
                      style={{ textDecoration: "none", color: "inherit" }}
                    >
                      <div className="pp-wrong-item-header">
                        <span className="pp-wrong-item-index">第 {idx + 1} 题</span>
                        <span className="pp-wrong-item-count">错误 {item.wrongCount} 次</span>
                      </div>
                      <p className="pp-wrong-item-prompt">{item.question?.prompt}</p>
                      {item.question && <div className="pp-wrong-item-answers">
                        <div className="pp-wrong-answer wrong">
                          <span className="pp-wrong-answer-label">你的答案</span>
                          <span className="pp-wrong-answer-text">
                            {item.userAnswer === null ? "未作答" : optionLabel(item.userAnswer, item.question.options)}
                          </span>
                        </div>
                        <div className="pp-wrong-answer correct">
                          <span className="pp-wrong-answer-label">正确答案</span>
                          <span className="pp-wrong-answer-text">
                            {optionLabel(item.correctAnswer, item.question.options)}
                          </span>
                        </div>
                      </div>}
                      <div className="pp-wrong-item-footer">
                        <span className="pp-wrong-item-date">最近答错：{formatDate(item.lastSeenAt)}</span>
                        <ChevronRight size={16} style={{ opacity: 0.4 }} />
                      </div>
                    </Link>
                    <div className="pp-wrong-item-actions">
                      <button
                        type="button"
                        onClick={() => setRemoveDialog({ scope, item })}
                        className="pp-secondary-btn pp-wrong-remove-btn"
                        disabled={actionLoading !== null}
                        aria-label={`移出错题本：${item.question?.prompt ?? item.questionId}`}
                      >
                        {actionLoading === item.id ? <Loader2 size={16} className="spin" /> : <Trash2 size={16} />}
                        移出错题本
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {removedItems.length > 0 && (
            <div className="pp-wrong-section pp-wrong-section-removed">
              <h2 className="pp-wrong-section-title">已移出（{removedItems.length}）</h2>
              <p className="pp-preview-note" style={{ margin: "0 0 12px", fontSize: "13px" }}>
                移出仅隐藏这些错题，不代表已掌握。以后在原私有卷的新一轮学习中再次答错，它们会重新进入错题本。
              </p>
              <div className="pp-wrong-list">
                {removedItems.map((item, idx) => (
                  <div key={item.id} className="pp-wrong-item-card pp-wrong-item-card-removed">
                    <div className="pp-wrong-item-header">
                      <span className="pp-wrong-item-index">第 {idx + 1} 题</span>
                      <span className="pp-wrong-item-count">错误 {item.wrongCount} 次</span>
                      <span className="pp-wrong-removed-badge">已移出</span>
                    </div>
                    <Link className="pp-wrong-item-prompt pp-wrong-removed-link" href={`/me/private-papers/${encodeURIComponent(paperId)}/wrong-items/${encodeURIComponent(item.questionId)}?contentHash=${encodeURIComponent(item.contentHash)}`}>{item.question?.prompt ?? "内容已更新，此错题已失效"}</Link>
                    <div className="pp-wrong-item-footer">
                      <span className="pp-wrong-item-date">移出时间：{item.removedAt ? formatDate(item.removedAt) : "未知"}</span>
                    </div>
                    <div className="pp-wrong-item-actions">
                      {item.status === "active" && item.question ? (
                        <button
                          type="button"
                          onClick={() => { void doRestore(item); }}
                          className="pp-primary-btn pp-wrong-restore-btn"
                          disabled={actionLoading !== null}
                          aria-label={`恢复到错题本：${item.question?.prompt ?? item.questionId}`}
                        >
                          {actionLoading === item.id ? <Loader2 size={16} className="spin" /> : <RotateCcw size={16} />}
                          恢复到错题本
                        </button>
                      ) : (
                        <span className="pp-preview-note" style={{ fontSize: "12px", color: "var(--pp-text-muted)" }}>
                          内容版本已变更，无法恢复
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {invalidItems.length > 0 && (
            <div className="pp-wrong-section pp-wrong-section-invalid">
              <h2 className="pp-wrong-section-title">旧版本错题（{invalidItems.length}）</h2>
              <div className="pp-wrong-list">
                {invalidItems.map((item, idx) => (
                  <div key={item.id} className="pp-wrong-item-card pp-wrong-item-card-invalid">
                    <div className="pp-wrong-item-header">
                      <span className="pp-wrong-item-index">第 {idx + 1} 题</span>
                      <span className="pp-wrong-item-count">错误 {item.wrongCount} 次</span>
                    </div>
                    <p className="pp-wrong-item-prompt">内容已更新，此错题已失效</p>
                    <div className="pp-wrong-item-footer">
                      <span className="pp-wrong-item-date">最近答错：{formatDate(item.lastSeenAt)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <WrongItemRemoveDialog item={dialogItem} busy={actionLoading !== null} error={actionError} onClose={closeDialog} onConfirm={() => { if (dialogItem) void doRemove(dialogItem); }} />

      <div className="me-spacer" />
    </main>
  );
}
