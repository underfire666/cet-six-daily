"use client";

import Link from "next/link";
import { ArrowLeft, AlertCircle, Loader2, BookX, RefreshCw, ChevronRight } from "lucide-react";
import { usePrivateWrongItems } from "@/lib/private-papers/use-wrong-items";
import { formatPrivateWrongDate as formatDate } from "@/lib/private-papers/wrong-items";

function optionLabel(id: string, options: Array<{id: string; text: string}>) { return options.find(o => o.id === id)?.text ?? id; }

export default function WrongItemsClient({ paperId }: { paperId: string }) {
  const { data, loading, error, refresh } = usePrivateWrongItems(paperId);
  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const refreshing = loading;
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
              共 <strong>{total}</strong> 道有效错题{data?.invalidatedTotal ? `，${data.invalidatedTotal} 道旧版本错题已失效` : ""}。按最近答错时间排序。
            </p>
            {total > 0 ? (
              <Link href={`/me/private-papers/${encodeURIComponent(paperId)}/wrong-items/review`} className="pp-primary-btn pp-wrong-review-btn" style={{ textDecoration: "none", whiteSpace: "nowrap" }}>
                复习错题
              </Link>
            ) : (
              <span className="pp-wrong-review-disabled" title="当前内容版本没有有效错题">
                复习错题
              </span>
            )}
          </div>
          <div className="pp-wrong-list">
            {items.map((item, idx) => (
              <Link
                key={item.id}
                href={`/me/private-papers/${encodeURIComponent(paperId)}/wrong-items/${encodeURIComponent(item.questionId)}?contentHash=${encodeURIComponent(item.contentHash)}`}
                className="pp-wrong-item-card"
                style={{ textDecoration: "none", color: "inherit" }}
              >
                <div className="pp-wrong-item-header">
                  <span className="pp-wrong-item-index">第 {idx + 1} 题</span>
                  <span className="pp-wrong-item-count">
                    错误 {item.wrongCount} 次
                  </span>
                </div>
                <p className="pp-wrong-item-prompt">{item.question?.prompt ?? "内容已更新，此错题已失效"}</p>
                {item.status === "active" && item.question ? <div className="pp-wrong-item-answers">
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
                </div>
                : <p className="pp-preview-note">旧版本题目不再显示，请返回私有卷重新学习。</p>}
                <div className="pp-wrong-item-footer">
                  <span className="pp-wrong-item-date">最近答错：{formatDate(item.lastSeenAt)}</span>
                  <ChevronRight size={16} style={{ opacity: 0.4 }} />
                </div>
              </Link>
            ))}
          </div>
        </>
      )}

      <div className="me-spacer" />
    </main>
  );
}
