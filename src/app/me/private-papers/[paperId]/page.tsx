"use client";

import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { ArrowLeft, Pencil, Trash2, Check, X, Clock, AlertCircle, Loader2 } from "lucide-react";

interface PrivatePaperDetail {
  id: string;
  paperId: string;
  title: string;
  content: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
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

function countStats(content: Record<string, unknown>): { sections: number; groups: number; questions: number } {
  let sections = 0;
  let groups = 0;
  let questions = 0;
  const secs = content.sections;
  if (Array.isArray(secs)) {
    sections = secs.length;
    for (const sec of secs) {
      if (sec && typeof sec === "object" && Array.isArray((sec as Record<string, unknown>).groups)) {
        const grps = (sec as Record<string, unknown>).groups as unknown[];
        groups += grps.length;
        for (const grp of grps) {
          if (grp && typeof grp === "object" && Array.isArray((grp as Record<string, unknown>).questions)) {
            questions += ((grp as Record<string, unknown>).questions as unknown[]).length;
          }
        }
      }
    }
  }
  return { sections, groups, questions };
}

export default function PrivatePaperDetailPage() {
  const params = useParams<{ paperId: string }>();
  const rawPaperId = params?.paperId as string;
  // useParams may return URL-encoded value; normalize to decoded form before encoding for fetch
  const paperId = rawPaperId?.includes("%3A") || rawPaperId?.includes("%25") ? decodeURIComponent(rawPaperId) : rawPaperId;
  const { status } = useSession();
  const router = useRouter();
  const [paper, setPaper] = useState<PrivatePaperDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [titleSaving, setTitleSaving] = useState(false);
  const [titleError, setTitleError] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login?callbackUrl=/me/private-papers");
      return;
    }
    if (status !== "authenticated" || !paperId) return;

    let cancelled = false;
    async function fetchPaper() {
      try {
        // paperId comes from Next.js params (already decoded once).
        // The API route expects the raw paperId string; do not re-encode here.
        const res = await fetch(`/api/private-papers/${encodeURIComponent(paperId)}`, { cache: "no-store" });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          if (res.status === 404) {
            throw new Error("该私有卷不存在或你没有访问权限");
          }
          throw new Error(data.error || `加载失败 (${res.status})`);
        }
        const data = await res.json();
        if (!cancelled) setPaper(data.paper);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "加载失败");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchPaper();
    return () => { cancelled = true; };
  }, [status, router, paperId]);

  if (status === "loading" || (status === "authenticated" && loading)) {
    return (
      <main className="me-page">
        <p className="me-loading">加载中…</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="me-page">
        <header className="me-header">
          <Link href="/me/private-papers" className="me-back-link" aria-label="返回">
            <ArrowLeft size={20} />
          </Link>
          <h1>私有卷</h1>
        </header>
        <div className="pp-error pp-error-large" role="alert">
          <AlertCircle size={24} />
          <p>{error}</p>
          <Link href="/me/private-papers" className="pp-cancel-btn">返回列表</Link>
        </div>
      </main>
    );
  }

  if (!paper) return null;

  const stats = countStats(paper.content);
  const isPartial = paper.content.isPartial === true;

  function startEditTitle() {
    if (!paper) return;
    setTitleDraft(paper.title);
    setTitleError("");
    setEditingTitle(true);
  }

  function cancelEditTitle() {
    setEditingTitle(false);
    setTitleDraft("");
    setTitleError("");
  }

  async function saveTitle() {
    const trimmed = titleDraft.trim();
    if (!trimmed) {
      setTitleError("标题不能为空");
      return;
    }
    if (trimmed.length > 200) {
      setTitleError("标题不能超过 200 字符");
      return;
    }
    if (!paper || trimmed === paper.title) {
      cancelEditTitle();
      return;
    }

    setTitleSaving(true);
    setTitleError("");
    try {
      const res = await fetch(`/api/private-papers/${encodeURIComponent(paperId)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: trimmed }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || `保存失败 (${res.status})`);
      }
      // Update local state: both DB title and content.title should be consistent
      setPaper((prev) => prev ? { ...prev, title: trimmed, content: { ...prev.content, title: trimmed } } : prev);
      setEditingTitle(false);
    } catch (err) {
      setTitleError(err instanceof Error ? err.message : "保存失败");
    } finally {
      setTitleSaving(false);
    }
  }

  async function confirmDelete() {
    setDeleting(true);
    setDeleteError("");
    try {
      const res = await fetch(`/api/private-papers/${encodeURIComponent(paperId)}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `删除失败 (${res.status})`);
      }
      router.push("/me/private-papers");
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "删除失败");
      setDeleting(false);
    }
  }

  return (
    <main className="me-page">
      <header className="me-header">
        <Link href="/me/private-papers" className="me-back-link" aria-label="返回">
          <ArrowLeft size={20} />
        </Link>
        <h1>私有卷详情</h1>
      </header>

      {/* Title section */}
      <section className="pp-detail-section">
        {editingTitle ? (
          <div className="pp-title-edit">
            <input
              type="text"
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              className="pp-input"
              autoFocus
              disabled={titleSaving}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveTitle();
                if (e.key === "Escape") cancelEditTitle();
              }}
            />
            <div className="pp-title-edit-actions">
              <button type="button" onClick={saveTitle} className="pp-icon-btn" disabled={titleSaving} aria-label="保存">
                {titleSaving ? <Loader2 size={18} className="spin" /> : <Check size={18} />}
              </button>
              <button type="button" onClick={cancelEditTitle} className="pp-icon-btn" disabled={titleSaving} aria-label="取消">
                <X size={18} />
              </button>
            </div>
            {titleError && <span className="pp-field-error"><AlertCircle size={12} /> {titleError}</span>}
          </div>
        ) : (
          <div className="pp-detail-title-row">
            <h2 className="pp-detail-title">{paper.title}</h2>
            <button type="button" onClick={startEditTitle} className="pp-icon-btn" aria-label="修改标题">
              <Pencil size={16} />
            </button>
          </div>
        )}
        <span className={`pp-detail-badge ${isPartial ? "draft" : "complete"}`}>
          {isPartial ? "草稿" : "完整"}
        </span>
      </section>

      {/* Stats */}
      <section className="pp-detail-section">
        <h3>内容概览</h3>
        <div className="pp-preview-grid">
          <div><strong>{stats.sections}</strong><span>Section</span></div>
          <div><strong>{stats.groups}</strong><span>Group</span></div>
          <div><strong>{stats.questions}</strong><span>题目</span></div>
          <div><strong>{isPartial ? "是" : "否"}</strong><span>草稿状态</span></div>
        </div>
        {isPartial && (
          <p className="pp-preview-note">不完整草稿暂不能开始学习。</p>
        )}
      </section>

      {/* Metadata */}
      <section className="pp-detail-section">
        <h3>元信息</h3>
        <dl className="pp-meta-list">
          <div>
            <dt>paperId</dt>
            <dd className="pp-mono">{paper.paperId}</dd>
          </div>
          <div>
            <dt>authenticity</dt>
            <dd className="pp-mono">{String(paper.content.authenticity || "user_import")}</dd>
          </div>
          <div>
            <dt>visibility</dt>
            <dd className="pp-mono">{String(paper.content.visibility || "private")}</dd>
          </div>
          <div>
            <dt><Clock size={12} /> 创建时间</dt>
            <dd>{formatDate(paper.createdAt)}</dd>
          </div>
          <div>
            <dt><Clock size={12} /> 更新时间</dt>
            <dd>{formatDate(paper.updatedAt)}</dd>
          </div>
        </dl>
      </section>

      {/* Danger zone */}
      <section className="pp-detail-section pp-danger-zone">
        <h3>删除</h3>
        <p className="pp-danger-text">删除后无法恢复，相关学习记录将一并移除。</p>
        {!showDeleteConfirm ? (
          <button type="button" onClick={() => setShowDeleteConfirm(true)} className="pp-delete-btn">
            <Trash2 size={16} /> 删除此私有卷
          </button>
        ) : (
          <div className="pp-delete-confirm">
            <p>确认删除「{paper.title}」？</p>
            {deleteError && (
              <span className="pp-field-error"><AlertCircle size={12} /> {deleteError}</span>
            )}
            <div className="pp-delete-actions">
              <button
                type="button"
                onClick={confirmDelete}
                className="pp-delete-btn"
                disabled={deleting}
              >
                {deleting ? <><Loader2 size={16} className="spin" /> 删除中…</> : <><Trash2 size={16} /> 确认删除</>}
              </button>
              <button
                type="button"
                onClick={() => { setShowDeleteConfirm(false); setDeleteError(""); }}
                className="pp-cancel-btn"
                disabled={deleting}
              >
                取消
              </button>
            </div>
          </div>
        )}
      </section>

      <div className="me-spacer" />
    </main>
  );
}
