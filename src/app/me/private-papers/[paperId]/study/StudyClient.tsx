"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RotateCcw,
  BookOpen,
} from "lucide-react";
import type { PrivateFlatQuestion } from "@/lib/private-papers/readiness";
import { scorePrivateAnswers } from "@/lib/private-papers/readiness";

interface StudyClientProps {
  paperId: string;
  paperTitle: string;
  questions: PrivateFlatQuestion[];
  contentHash: string;
  ready: boolean;
  notReadyReason?: string;
}

interface StoredProgress {
  userId: string;
  paperId: string;
  contentHash: string;
  answers: Record<number, string>;
  currentIndex: number;
  submitted: boolean;
  savedAt: string;
}

interface StudyState {
  answers: Record<number, string>;
  currentIndex: number;
  submitted: boolean;
}

const INITIAL_STUDY_STATE: StudyState = { answers: {}, currentIndex: 0, submitted: false };

function storageKey(userId: string, paperId: string): string {
  return `private-study:${userId}:${paperId}`;
}

function safeReadStorage(key: string): StoredProgress | null {
  try {
    if (typeof window === "undefined") return null;
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      typeof parsed.userId !== "string" ||
      typeof parsed.paperId !== "string" ||
      typeof parsed.contentHash !== "string" ||
      typeof parsed.answers !== "object" ||
      parsed.answers === null ||
      typeof parsed.currentIndex !== "number" ||
      typeof parsed.submitted !== "boolean"
    ) {
      return null;
    }
    return parsed as StoredProgress;
  } catch {
    return null;
  }
}

function safeWriteStorage(key: string, data: StoredProgress): void {
  try {
    if (typeof window === "undefined") return;
    window.sessionStorage.setItem(key, JSON.stringify(data));
  } catch {
    // storage unavailable — progress still works in-memory for this session
  }
}

function safeRemoveStorage(key: string): void {
  try {
    if (typeof window === "undefined") return;
    window.sessionStorage.removeItem(key);
  } catch {
    // ignore
  }
}

function loadStudyStateFromStorage(
  userId: string,
  paperId: string,
  contentHash: string,
  total: number,
): StudyState {
  const key = storageKey(userId, paperId);
  const stored = safeReadStorage(key);
  if (!stored) return INITIAL_STUDY_STATE;
  if (stored.userId !== userId || stored.paperId !== paperId) {
    safeRemoveStorage(key);
    return INITIAL_STUDY_STATE;
  }
  if (stored.contentHash !== contentHash) {
    // Content changed since last session — invalidate old progress silently
    safeRemoveStorage(key);
    return INITIAL_STUDY_STATE;
  }
  return {
    answers: stored.answers,
    currentIndex: Math.min(Math.max(0, stored.currentIndex), total - 1),
    submitted: stored.submitted,
  };
}

export default function StudyClient({
  paperId,
  paperTitle,
  questions,
  contentHash,
  ready,
  notReadyReason,
}: StudyClientProps) {
  const { status, data: session } = useSession();
  const router = useRouter();
  const ownerId = session?.user?.id;

  const [studyState, setStudyState] = useState<StudyState>(INITIAL_STUDY_STATE);
  const [showUnansweredConfirm, setShowUnansweredConfirm] = useState(false);
  const hydratedRef = useRef(false);

  const { answers, currentIndex, submitted } = studyState;
  const total = questions.length;

  const answeredCount = useMemo(
    () => Object.values(answers).filter((v) => typeof v === "string" && v.length > 0).length,
    [answers],
  );
  const unansweredCount = total - answeredCount;

  const currentQuestion = questions[currentIndex];
  const score = useMemo(() => scorePrivateAnswers(questions, answers), [questions, answers]);

  // 挂载后从 sessionStorage 恢复（仅执行一次，与 PaperProvider 同模式）
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login?callbackUrl=/me/private-papers");
      return;
    }
    if (status !== "authenticated" || !ownerId || !ready) return;
    if (hydratedRef.current) return;
    hydratedRef.current = true;
    setStudyState(loadStudyStateFromStorage(ownerId, paperId, contentHash, total));
  }, [status, ownerId, paperId, contentHash, ready, router, total]);

  function persistProgress(next: StudyState) {
    if (!ownerId || !ready) return;
    safeWriteStorage(storageKey(ownerId, paperId), {
      userId: ownerId,
      paperId,
      contentHash,
      answers: next.answers,
      currentIndex: next.currentIndex,
      submitted: next.submitted,
      savedAt: new Date().toISOString(),
    });
  }

  if (status !== "authenticated") {
    return (
      <main className="me-page">
        <p className="me-loading">加载中…</p>
      </main>
    );
  }

  if (!ready) {
    return (
      <main className="me-page">
        <header className="me-header">
          <Link href={`/me/private-papers/${encodeURIComponent(paperId)}`} className="me-back-link" aria-label="返回">
            <ArrowLeft size={20} />
          </Link>
          <h1>开始学习</h1>
        </header>
        <div className="pp-error pp-error-large" role="alert">
          <AlertCircle size={24} />
          <p><strong>暂不能开始学习</strong></p>
          <p>{notReadyReason || "内容不符合本阶段学习要求。"}</p>
          <p className="pp-preview-note" style={{ marginTop: "12px", fontSize: "13px" }}>
            本阶段仅支持：reading section + careful_reading group + 内联 choice 选择题。
            草稿、缺少答案、包含听力/翻译/写作/完形/匹配等内容的卷暂不支持。
          </p>
          <Link href={`/me/private-papers/${encodeURIComponent(paperId)}`} className="pp-cancel-btn">
            返回详情
          </Link>
        </div>
        <div className="me-spacer" />
      </main>
    );
  }

  function selectAnswer(questionIndex: number, optionId: string) {
    if (submitted) return;
    const next: StudyState = { ...studyState, answers: { ...answers, [questionIndex]: optionId } };
    setStudyState(next);
    persistProgress(next);
  }

  function goTo(index: number) {
    if (index < 0 || index >= total) return;
    const next: StudyState = { ...studyState, currentIndex: index };
    setStudyState(next);
    persistProgress(next);
  }

  function handleSubmit() {
    if (submitted) return;
    if (unansweredCount > 0 && !showUnansweredConfirm) {
      setShowUnansweredConfirm(true);
      return;
    }
    const next: StudyState = { ...studyState, submitted: true };
    setStudyState(next);
    setShowUnansweredConfirm(false);
    persistProgress(next);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function handleRetry() {
    if (!ownerId) return;
    safeRemoveStorage(storageKey(ownerId, paperId));
    setStudyState(INITIAL_STUDY_STATE);
    setShowUnansweredConfirm(false);
  }

  if (submitted) {
    return (
      <main className="me-page">
        <header className="me-header">
          <Link href={`/me/private-papers/${encodeURIComponent(paperId)}`} className="me-back-link" aria-label="返回">
            <ArrowLeft size={20} />
          </Link>
          <h1>练习结果</h1>
        </header>

        <section className="pp-detail-section">
          <div className="pp-study-score">
            <div className="pp-study-score-main">
              <span className="pp-study-score-num">{score.accuracy}</span>
              <span className="pp-study-score-unit">%</span>
            </div>
            <div className="pp-study-score-detail">
              <p>正确 <strong>{score.correct}</strong> / {score.total} 题</p>
              <p className="pp-preview-note">本阶段私有练习暂不计入 XP、Streak、学习统计、Daily Plan 或 Review。</p>
            </div>
          </div>
          <div className="pp-study-actions">
            <button type="button" onClick={handleRetry} className="pp-primary-btn">
              <RotateCcw size={16} /> 重新练习
            </button>
            <Link href={`/me/private-papers/${encodeURIComponent(paperId)}`} className="pp-cancel-btn">
              返回详情
            </Link>
          </div>
        </section>

        <section className="pp-detail-section">
          <h3>答题回顾</h3>
          <div className="pp-study-review-list">
            {questions.map((q, i) => {
              const userAnswer = answers[i];
              const isCorrect = userAnswer === q.answerId;
              return (
                <div key={q.questionId || i} className={`pp-study-review-item ${isCorrect ? "correct" : "wrong"}`}>
                  <div className="pp-study-review-header">
                    <span className="pp-study-review-num">第 {i + 1} 题</span>
                    {isCorrect ? (
                      <span className="pp-study-review-badge correct"><CheckCircle2 size={14} /> 正确</span>
                    ) : (
                      <span className="pp-study-review-badge wrong"><XCircle size={14} /> 错误</span>
                    )}
                  </div>
                  {q.passage && (
                    <div className="pp-study-passage">
                      <BookOpen size={14} /> 阅读材料
                      <p>{q.passage}</p>
                    </div>
                  )}
                  <p className="pp-study-prompt">{q.prompt}</p>
                  <div className="pp-study-options">
                    {q.options.map((opt) => {
                      const isUserAnswer = userAnswer === opt.id;
                      const isCorrectAnswer = q.answerId === opt.id;
                      let cls = "pp-study-option";
                      if (isCorrectAnswer) cls += " correct-answer";
                      else if (isUserAnswer) cls += " wrong-answer";
                      return (
                        <div key={opt.id} className={cls}>
                          <span className="pp-study-option-label">{opt.id}</span>
                          <span className="pp-study-option-text">{opt.text}</span>
                          {isCorrectAnswer && <CheckCircle2 size={16} className="pp-study-option-icon correct" />}
                          {isUserAnswer && !isCorrectAnswer && <XCircle size={16} className="pp-study-option-icon wrong" />}
                        </div>
                      );
                    })}
                  </div>
                  {(q.shortExplanation || q.detailedExplanation) && (
                    <div className="pp-study-explanation">
                      <strong>解析：</strong>
                      <p>{q.shortExplanation || q.detailedExplanation}</p>
                    </div>
                  )}
                  {!q.shortExplanation && !q.detailedExplanation && (
                    <p className="pp-study-no-explanation">暂无解析。</p>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <div className="me-spacer" />
      </main>
    );
  }

  return (
    <main className="me-page">
      <header className="me-header">
        <Link href={`/me/private-papers/${encodeURIComponent(paperId)}`} className="me-back-link" aria-label="返回">
          <ArrowLeft size={20} />
        </Link>
        <h1>{paperTitle}</h1>
      </header>

      <section className="pp-detail-section">
        <div className="pp-study-progress">
          <div className="pp-study-progress-info">
            <span>第 {currentIndex + 1} / {total} 题</span>
            <span>已答 {answeredCount} 题</span>
          </div>
          <div className="pp-study-progress-bar">
            <div
              className="pp-study-progress-fill"
              style={{ width: `${total > 0 ? ((currentIndex + 1) / total) * 100 : 0}%` }}
            />
          </div>
          <p className="pp-preview-note" style={{ marginTop: "8px", fontSize: "12px" }}>
            进度保存在当前浏览器标签页，刷新后可恢复。
          </p>
        </div>
      </section>

      {currentQuestion && (
        <section className="pp-detail-section">
          {currentQuestion.passage && (
            <div className="pp-study-passage">
              <BookOpen size={14} /> 阅读材料
              <p>{currentQuestion.passage}</p>
            </div>
          )}
          <h3 className="pp-study-prompt">{currentQuestion.prompt}</h3>
          <div className="pp-study-options">
            {currentQuestion.options.map((opt) => {
              const selected = answers[currentIndex] === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  className={`pp-study-option-btn ${selected ? "selected" : ""}`}
                  onClick={() => selectAnswer(currentIndex, opt.id)}
                  disabled={submitted}
                >
                  <span className="pp-study-option-label">{opt.id}</span>
                  <span className="pp-study-option-text">{opt.text}</span>
                  {selected && <CheckCircle2 size={18} className="pp-study-option-check" />}
                </button>
              );
            })}
          </div>
        </section>
      )}

      <section className="pp-detail-section">
        <div className="pp-study-nav">
          <button
            type="button"
            className="pp-cancel-btn"
            onClick={() => goTo(currentIndex - 1)}
            disabled={currentIndex === 0}
          >
            <ChevronLeft size={16} /> 上一题
          </button>

          {currentIndex < total - 1 ? (
            <button
              type="button"
              className="pp-primary-btn"
              onClick={() => goTo(currentIndex + 1)}
            >
              下一题 <ChevronRight size={16} />
            </button>
          ) : (
            <button
              type="button"
              className="pp-primary-btn pp-submit-btn"
              onClick={handleSubmit}
            >
              <CheckCircle2 size={16} /> 提交答案
            </button>
          )}
        </div>

        <div className="pp-study-dots">
          {questions.map((q, i) => (
            <button
              key={q.questionId || i}
              type="button"
              className={`pp-study-dot ${i === currentIndex ? "current" : ""} ${answers[i] ? "answered" : ""}`}
              onClick={() => goTo(i)}
              aria-label={`第 ${i + 1} 题${answers[i] ? "（已答）" : "（未答）"}`}
            >
              {i + 1}
            </button>
          ))}
        </div>
      </section>

      {showUnansweredConfirm && (
        <div className="pp-modal-overlay" onClick={() => setShowUnansweredConfirm(false)}>
          <div className="pp-modal" onClick={(e) => e.stopPropagation()}>
            <h3>还有 {unansweredCount} 题未作答</h3>
            <p>确定要提交吗？未作答的题目将计为错误。</p>
            <div className="pp-modal-actions">
              <button type="button" className="pp-cancel-btn" onClick={() => setShowUnansweredConfirm(false)}>
                继续作答
              </button>
              <button type="button" className="pp-primary-btn pp-submit-btn" onClick={handleSubmit}>
                确认提交
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="me-spacer" />
    </main>
  );
}
