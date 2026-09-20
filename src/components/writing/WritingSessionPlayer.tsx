"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, ChevronDown, NotebookPen } from "lucide-react";
import { writingTaskById } from "@/data/mockWriting";
import { countWords } from "@/lib/writing/scoring";
import { useWriting } from "./WritingProvider";

export function WritingSessionPlayer({ id }: { id: string }) {
  const { ready, store, dispatch, lastSaveOk } = useWriting();
  const router = useRouter();
  const session = store.sessions[id];
  const task = session ? writingTaskById(session.taskId) : undefined;
  const [showRef, setShowRef] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [showOutline, setShowOutline] = useState(false);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const dirtyRef = useRef(false);
  const [, force] = useState(0);

  const onChange = (value: string) => {
    dispatch(id, { type: "set_draft", draft: value });
    dirtyRef.current = true;
    force((n) => n + 1);
  };

  const [savedHint, setSavedHint] = useState<"ok" | "fail" | null>(null);
  useEffect(() => {
    if (!dirtyRef.current) return;
    const t = setTimeout(() => {
      setSavedHint(lastSaveOk ? "ok" : "fail");
      setTimeout(() => setSavedHint(null), 1500);
    }, 600);
    return () => clearTimeout(t);
  }, [session?.draft, lastSaveOk]);

  if (!ready) return <div className="exercise-loading">正在准备写作…</div>;
  if (!session || !task) {
    return (
      <main className="exercise-gate">
        <h1>找不到这次写作</h1>
        <p>返回写作页，重新开始吧。</p>
        <Link className="exercise-button" href="/practice/writing">
          返回写作
        </Link>
      </main>
    );
  }

  const draft = session.draft;
  const wordCount = countWords(draft);
  const [minW, maxW] = task.suggestedWordsRange;
  const canSubmit = draft.trim().length > 0;
  const isShort = wordCount > 0 && wordCount < minW * 0.5;

  const handleSubmit = () => {
    if (!canSubmit) return;
    if (isShort && !confirmSubmit) {
      setConfirmSubmit(true);
      return;
    }
    dispatch(id, { type: "submit", now: new Date().toISOString() });
    setConfirmSubmit(false);
  };

  const finish = () => {
    dispatch(id, { type: "finish", now: new Date().toISOString() });
    router.push(`/practice/writing/complete/${id}`);
  };

  return (
    <main className="subjective-session">
      <header className="subjective-session-bar">
        <Link href="/practice/writing" aria-label="关闭">
          <ArrowLeft size={19} />
        </Link>
        <span>写作 · {task.title}</span>
        <small>{session.mode === "daily" ? "每日任务" : "额外练习"}</small>
      </header>

      {session.phase === "drafting" && (
        <>
          <section className="subjective-prompt">
            <p className="subjective-prompt-label">Directions</p>
            <p className="subjective-prompt-text">{task.prompt}</p>
            <p style={{ fontSize: 13, color: "var(--muted)", margin: "8px 0 0" }}>
              建议 {minW}–{maxW} 词 · {task.level === "essay" ? "完整作文" : "段落"}
            </p>
            <ul style={{ fontSize: 13, color: "var(--muted)", margin: "8px 0 0", paddingLeft: 18 }}>
              {task.requirements.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </section>

          <section className="subjective-editor">
            <textarea
              className="subjective-textarea"
              value={draft}
              onChange={(e) => onChange(e.target.value)}
              placeholder="在这里写你的作文，草稿会自动保存。"
              rows={14}
            />
            <div className="subjective-editor-meta">
              <span>{wordCount} words · 建议 {minW}–{maxW} 词</span>
              {savedHint === "ok" && (
                <span className="subjective-saved">草稿已保存</span>
              )}
              {savedHint === "fail" && (
                <span className="subjective-save-fail">保存失败</span>
              )}
            </div>
            {confirmSubmit && (
              <p className="subjective-warn">
                字数偏少，确定提交吗？
                <button
                  className="subjective-inline"
                  onClick={() => {
                    dispatch(id, { type: "submit", now: new Date().toISOString() });
                    setConfirmSubmit(false);
                  }}
                >
                  仍然提交
                </button>
              </p>
            )}
            <button
              className="subjective-button"
              onClick={handleSubmit}
              disabled={!canSubmit}
            >
              <Check size={18} />
              提交作文
            </button>
          </section>
        </>
      )}

      {(session.phase === "reviewing" || session.phase === "complete") &&
        session.feedback && (
          <section className="subjective-result">
            <h1>{session.phase === "complete" ? "写作回顾" : "写作完成"}</h1>
            <p className="subjective-result-sub">六级估分（Mock）</p>
            <div className="subjective-score">
              <strong>{session.feedback.score}</strong>
              <span>/ {session.feedback.maxScore}</span>
            </div>
            <p className="subjective-summary">{session.feedback.summary}</p>
            <p style={{ fontSize: 13, color: "var(--muted)" }}>
              字数：{session.wordCount ?? wordCount}
            </p>

            {session.phase === "complete" && session.submittedText && (
              <div className="subjective-history-text">
                <p className="subjective-prompt-label">你的作文</p>
                <p style={{ whiteSpace: "pre-wrap" }}>
                  {session.submittedText}
                </p>
              </div>
            )}

            {session.feedback.issues.length > 0 && (
              <div className="subjective-issues">
                <h2>主要问题</h2>
                {session.feedback.issues.map((issue, i) => (
                  <div key={i} className="subjective-issue">
                    <strong>{issue.title}</strong>
                    <p>{issue.description}</p>
                  </div>
                ))}
              </div>
            )}

            <button
              className="subjective-text-button"
              onClick={() => setShowOutline((v) => !v)}
            >
              <ChevronDown
                size={16}
                style={{ transform: showOutline ? "rotate(180deg)" : undefined }}
              />
              参考结构
            </button>
            {showOutline && (
              <div className="subjective-reference">
                {task.outline.map((b, i) => (
                  <p key={i}>
                    <strong>
                      {b.type === "introduction" ? "开头" : b.type === "body" ? "主体" : "结尾"}：
                    </strong>{" "}
                    {b.content}
                  </p>
                ))}
              </div>
            )}

            <button
              className="subjective-text-button"
              onClick={() => setShowRef((v) => !v)}
            >
              <ChevronDown
                size={16}
                style={{ transform: showRef ? "rotate(180deg)" : undefined }}
              />
              查看参考范文
            </button>
            {showRef && (
              <div className="subjective-reference">
                <p style={{ whiteSpace: "pre-wrap" }}>{task.referenceEssay}</p>
              </div>
            )}

            <button
              className="subjective-text-button"
              onClick={() => setShowDetail((v) => !v)}
            >
              <ChevronDown
                size={16}
                style={{ transform: showDetail ? "rotate(180deg)" : undefined }}
              />
              查看详细分析
            </button>
            {showDetail && (
              <div className="subjective-details">
                {session.feedback.details.map((d, i) => (
                  <div key={i} className="subjective-detail">
                    {d.excerpt && (
                      <p>
                        <em>题面：</em>
                        {d.excerpt}
                      </p>
                    )}
                    {d.userExpression && (
                      <p>
                        <em>你的作文：</em>
                        {d.userExpression}
                      </p>
                    )}
                    {d.referenceExpression && (
                      <p>
                        <em>参考范文：</em>
                        {d.referenceExpression}
                      </p>
                    )}
                    {d.note && <p className="subjective-note">{d.note}</p>}
                  </div>
                ))}
              </div>
            )}

            {session.phase === "reviewing" && (
              <button className="subjective-button" onClick={finish}>
                <NotebookPen size={18} />
                完成并结算
              </button>
            )}
            {session.phase === "complete" && (
              <Link className="subjective-button" href="/practice/writing">
                <ArrowLeft size={18} />
                返回写作
              </Link>
            )}
          </section>
        )}
    </main>
  );
}
