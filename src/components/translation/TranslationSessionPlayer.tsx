"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, ChevronDown, Languages } from "lucide-react";
import { translationTaskById } from "@/data/mockTranslation";
import { useTranslation } from "./TranslationProvider";

export function TranslationSessionPlayer({ id }: { id: string }) {
  const { ready, store, dispatch, lastSaveOk } = useTranslation();
  const router = useRouter();
  const session = store.sessions[id];
  const task = session ? translationTaskById(session.taskId) : undefined;
  const [showRef, setShowRef] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const dirtyRef = useRef(false);
  const [, force] = useState(0);

  // 自动保存草稿（每次输入都 dispatch set_draft）
  const onChange = (value: string) => {
    dispatch(id, { type: "set_draft", draft: value });
    dirtyRef.current = true;
    force((n) => n + 1);
  };

  // 草稿已保存轻提示（按最近一次落盘结果显示成功/失败）
  const [savedHint, setSavedHint] = useState<"ok" | "fail" | null>(null);
  useEffect(() => {
    if (!dirtyRef.current) return;
    const t = setTimeout(() => {
      setSavedHint(lastSaveOk ? "ok" : "fail");
      setTimeout(() => setSavedHint(null), 1500);
    }, 600);
    return () => clearTimeout(t);
  }, [session?.draft, lastSaveOk]);

  if (!ready) return <div className="exercise-loading">正在准备翻译…</div>;
  if (!session || !task) {
    return (
      <main className="exercise-gate">
        <h1>找不到这次翻译</h1>
        <p>返回翻译页，重新开始吧。</p>
        <Link className="exercise-button" href="/practice/translation">
          返回翻译
        </Link>
      </main>
    );
  }

  const draft = session?.draft ?? "";
  const wordCount = draft.trim().split(/\s+/).filter(Boolean).length;
  const canSubmit = draft.trim().length > 0;
  const isShort = draft.trim().length > 0 && draft.trim().length < 30;

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
    router.push(`/practice/translation/complete/${id}`);
  };

  return (
    <main className="subjective-session">
      <header className="subjective-session-bar">
        <Link href="/practice/translation" aria-label="关闭">
          <ArrowLeft size={19} />
        </Link>
        <span>翻译 · {task.title}</span>
        <small>{session.mode === "daily" ? "每日任务" : "额外练习"}</small>
      </header>

      {session.phase === "drafting" && (
        <>
          <section className="subjective-prompt">
            <p className="subjective-prompt-label">中文原文</p>
            <p className="subjective-prompt-text">{task.promptChinese}</p>
          </section>

          <section className="subjective-editor">
            <textarea
              className="subjective-textarea"
              value={draft}
              onChange={(e) => onChange(e.target.value)}
              placeholder="用英文写出你的翻译，草稿会自动保存。"
              rows={10}
            />
            <div className="subjective-editor-meta">
              <span>已输入 {wordCount} 词</span>
              {savedHint === "ok" && (
                <span className="subjective-saved">草稿已保存</span>
              )}
              {savedHint === "fail" && (
                <span className="subjective-save-fail">保存失败</span>
              )}
            </div>
            {confirmSubmit && (
              <p className="subjective-warn">
                这篇翻译似乎还没有完成，确定提交吗？
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
              提交翻译
            </button>
          </section>
        </>
      )}

      {(session.phase === "reviewing" || session.phase === "complete") &&
        session.feedback && (
          <section className="subjective-result">
            <h1>{session.phase === "complete" ? "翻译回顾" : "翻译完成"}</h1>
            <p className="subjective-result-sub">六级估分（Mock）</p>
            <div className="subjective-score">
              <strong>{session.feedback.score}</strong>
              <span>/ {session.feedback.maxScore}</span>
            </div>
            <p className="subjective-summary">{session.feedback.summary}</p>

            {session.phase === "complete" && session.submittedText && (
              <div className="subjective-history-text">
                <p className="subjective-prompt-label">你的译文</p>
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
              onClick={() => setShowRef((v) => !v)}
            >
              <ChevronDown
                size={16}
                style={{ transform: showRef ? "rotate(180deg)" : undefined }}
              />
              查看参考译文
            </button>
            {showRef && (
              <div className="subjective-reference">
                <p>{task.referenceTranslation}</p>
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
                        <em>原文：</em>
                        {d.excerpt}
                      </p>
                    )}
                    {d.userExpression && (
                      <p>
                        <em>你的表达：</em>
                        {d.userExpression}
                      </p>
                    )}
                    {d.referenceExpression && (
                      <p>
                        <em>参考表达：</em>
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
                <Languages size={18} />
                完成并结算
              </button>
            )}
            {session.phase === "complete" && (
              <Link
                className="subjective-button"
                href="/practice/translation"
              >
                <ArrowLeft size={18} />
                返回翻译
              </Link>
            )}
          </section>
        )}
    </main>
  );
}
