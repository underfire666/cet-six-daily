"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { ArrowLeft, Plus, FileText, Clock, AlertCircle } from "lucide-react";

interface PrivatePaperSummary {
  id: string;
  paperId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

interface ListResponse {
  papers: PrivatePaperSummary[];
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default function PrivatePapersListPage() {
  const { status, data: session } = useSession();
  const ownerId = session?.user?.id;
  const router = useRouter();
  const [papers, setPapers] = useState<PrivatePaperSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadedOwner, setLoadedOwner] = useState<string>();
  const [error, setError] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login?callbackUrl=/me/private-papers");
      return;
    }
    if (status !== "authenticated") return;

    let cancelled = false;
    async function fetchPapers() {
      try {
        const res = await fetch("/api/private-papers", { cache: "no-store" });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || `加载失败 (${res.status})`);
        }
        const data: ListResponse = await res.json();
        if (!cancelled) { setPapers(data.papers || []); setError(""); }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "加载失败");
      } finally {
        if (!cancelled) { setLoading(false); setLoadedOwner(ownerId); }
      }
    }
    fetchPapers();
    return () => { cancelled = true; };
  }, [status, router, ownerId]);

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
        <Link href="/me" className="me-back-link" aria-label="返回">
          <ArrowLeft size={20} />
        </Link>
        <h1>我的私有卷</h1>
      </header>

      <div className="pp-actions">
        <Link href="/me/private-papers/import" className="pp-import-btn">
          <Plus size={18} /> 导入 JSON 草稿
        </Link>
      </div>

      {error && (
        <div className="pp-error" role="alert">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {!loading && !error && papers.length === 0 && (
        <div className="pp-empty">
          <FileText size={48} className="pp-empty-icon" />
          <h2>还没有私有卷</h2>
          <p>导入 JSON 草稿开始创建你的第一份私有卷。</p>
          <Link href="/me/private-papers/import" className="pp-import-btn">
            <Plus size={18} /> 立即导入
          </Link>
        </div>
      )}

      {papers.length > 0 && (
        <ul className="pp-list">
          {papers.map((paper) => (
            <li key={paper.id}>
              <Link
                href={`/me/private-papers/${encodeURIComponent(paper.paperId)}`}
                className="pp-card"
              >
                <div className="pp-card-main">
                  <span className="pp-card-title">{paper.title}</span>
                  <span className="pp-card-meta">
                    <Clock size={12} /> 更新于 {formatDate(paper.updatedAt)}
                  </span>
                </div>
                <span className="pp-card-badge draft">草稿</span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <div className="me-spacer" />
    </main>
  );
}
