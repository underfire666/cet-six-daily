"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { ArrowLeft, AlertCircle, Check, X, Clock } from "lucide-react";

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
  questionId: string;
  userAnswer: string | null;
  correctAnswer: string;
  wrongCount: number;
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

export default function WrongItemDetailClient({ paperId, questionId }: { paperId: string; questionId: string }) {
  const { status, data: session } = useSession();
  const ownerId = session?.user?.id;
  const router = useRouter();
  const [item, setItem] = useState<WrongItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadedOwner, setLoadedOwner] = useState<string>();
  const [error, setError] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login?callbackUrl=/me/private-papers");
      return;
    }
    if (status !== "authenticated" || !paperId) return;

    let cancelled = false;
    async function fetchItem() {
      try {
        // Fetch the list and find the matching item (list API already enriches with question details)
        const res = await fetch(`/api/private-papers/${encodeURIComponent(paperId)}/wrong-items`, { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          if (res.status === 404) throw new Error("该私有卷不存在或你没有访问权限");
          if (res.status === 409 && data.error === "not_ready") throw new Error(data.reason || "试卷尚未准备好");
          throw new Error(data.error || `加载失败 (${res.status})`);
        }
        const found = (data.items || []).find((x: WrongItem) => x.questionId === questionId);
        if (!found) throw new Error("该错题不存在或已因内容更新失效");
        if (!cancelled) { setItem(found); setError(""); }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "加载失败");
      } finally {
        if (!cancelled) { setLoading(false); setLoadedOwner(ownerId); }
      }
    }
    fetchItem();
    return () => { cancelled = true; };
  }, [status, router, paperId, questionId, ownerId]);

  if (status !== "authenticated" || loading || loadedOwner !== ownerId) {
    return (
      <main className="me-page">
        <p className="me-loading">加载中…</p>
      </main>
    );
  }

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
          <Link href={`/me/private-papers/${encodeURIComponent(paperId)}/wrong-items`} className="pp-cancel-btn">返回错题列表</Link>
        </div>
      </main>
    );
  }

  const { question } = item;

  return (
    <main className="me-page">
      <header className="me-header">
        <Link href={`/me/private-papers/${encodeURIComponent(paperId)}/wrong-items`} className="me-back-link" aria-label="返回">
          <ArrowLeft size={20} />
        </Link>
        <h1>错题详情</h1>
      </header>

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
            <div className="pp-wrong-detail-explanation detailed" dangerouslySetInnerHTML={{ __html: question.detailedExplanation }} />
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
        </div>
      </section>

      <div className="me-spacer" />
    </main>
  );
}
