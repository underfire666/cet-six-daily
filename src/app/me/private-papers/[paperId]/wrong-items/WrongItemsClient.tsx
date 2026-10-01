"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { ArrowLeft, AlertCircle, Loader2, BookX, RefreshCw, ChevronRight } from "lucide-react";

interface WrongItemOption {
  id: string;
  text: string;
}

interface WrongItemQuestion {
  prompt: string;
  options: WrongItemOption[];
  shortExplanation?: string;
  detailedExplanation?: string;
  sectionId: string;
  groupId: string;
}

interface WrongItem {
  id: string;
  paperId: string;
  contentHash: string;
  questionId: string;
  attemptId: string;
  userAnswer: string | null;
  correctAnswer: string;
  wrongCount: number;
  status: string;
  firstSeenAt: string;
  lastSeenAt: string;
  question: WrongItemQuestion;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("zh-CN", {
      year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
    });
  } catch { return iso; }
}

function optionLabel(optionId: string, options: WrongItemOption[]): string {
  const opt = options.find(o => o.id === optionId);
  return opt ? opt.text : optionId;
}

export default function WrongItemsClient({ paperId }: { paperId: string }) {
  const { status, data: session } = useSession();
  const ownerId = session?.user?.id;
  const router = useRouter();
  const [items, setItems] = useState<WrongItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadedOwner, setLoadedOwner] = useState<string>();
  const [error, setError] = useState("");
  const [errorCode, setErrorCode] = useState<string>("");
  const [refreshing, setRefreshing] = useState(false);

  async function fetchItems(showSpinner = false) {
    if (showSpinner) setRefreshing(true);
    try {
      const res = await fetch(`/api/private-papers/${encodeURIComponent(paperId)}/wrong-items`, { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrorCode(data.error || `error_${res.status}`);
        if (res.status === 404) throw new Error("该私有卷不存在或你没有访问权限");
        if (res.status === 409 && data.error === "not_ready") throw new Error(data.reason || "试卷尚未准备好");
        throw new Error(data.error || `加载失败 (${res.status})`);
      }
      setItems(data.items || []);
      setTotal(data.total ?? 0);
      setError("");
      setErrorCode("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败");
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadedOwner(ownerId);
    }
  }

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login?callbackUrl=/me/private-papers");
      return;
    }
    if (status !== "authenticated" || !paperId) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchItems().then(() => { if (cancelled) return; });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, router, paperId, ownerId]);

  if (status !== "authenticated" || loading || loadedOwner !== ownerId) {
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
          onClick={() => fetchItems(true)}
          className="pp-icon-btn"
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
          {errorCode === "not_ready" && (
            <p className="pp-preview-note" style={{ fontSize: "13px", marginTop: "4px" }}>
              错题仅在试卷内容完整且可作答时显示。请先完善试卷内容。
            </p>
          )}
          <Link href={`/me/private-papers/${encodeURIComponent(paperId)}`} className="pp-cancel-btn">返回详情</Link>
        </div>
      )}

      {!error && total === 0 && (
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

      {!error && total > 0 && (
        <>
          <p className="pp-preview-note" style={{ marginBottom: "12px" }}>
            共 <strong>{total}</strong> 道错题。按最近答错时间排序。
          </p>
          <div className="pp-wrong-list">
            {items.map((item, idx) => (
              <Link
                key={item.id}
                href={`/me/private-papers/${encodeURIComponent(paperId)}/wrong-items/${encodeURIComponent(item.questionId)}`}
                className="pp-wrong-item-card"
                style={{ textDecoration: "none", color: "inherit" }}
              >
                <div className="pp-wrong-item-header">
                  <span className="pp-wrong-item-index">第 {idx + 1} 题</span>
                  <span className="pp-wrong-item-count">
                    错误 {item.wrongCount} 次
                  </span>
                </div>
                <p className="pp-wrong-item-prompt">{item.question.prompt}</p>
                <div className="pp-wrong-item-answers">
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
