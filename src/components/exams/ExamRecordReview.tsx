"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, BookOpen, Check, Headphones, Languages, NotebookPen, Volume2, X } from "lucide-react";
import type { ExamModule } from "@/content/exam-catalog";
import { listeningMaterialById, readingArticleById, translationTaskById, writingTaskById } from "@/content/learning";
import { listeningLesson } from "@/lib/listening/questions";
import { readingLesson } from "@/lib/reading/questions";
import { useListening } from "@/components/listening/ListeningProvider";
import { useReading } from "@/components/reading/ReadingProvider";
import { useTranslation } from "@/components/translation/TranslationProvider";
import { useWriting } from "@/components/writing/WritingProvider";
import { formatShanghaiTime, moduleLabel } from "@/lib/exam-records";
import type { AnswerRecord } from "@/types/session";
import type { ListeningSession } from "@/types/listening";
import type { ReadingSession } from "@/types/reading";
import type { TranslationSession } from "@/types/translation";
import type { WritingSession } from "@/types/writing";

const moduleIcons: Record<ExamModule, typeof Headphones> = {
  listening: Headphones,
  reading: BookOpen,
  translation: Languages,
  writing: NotebookPen,
};

function resultLabel(record: AnswerRecord): string {
  if (record.initialResult === "first_try_correct") return "首次答对";
  if (record.initialResult === "second_try_correct") return "重试答对";
  if (record.initialResult === "ai_hint_correct") return "提示后答对";
  if (record.initialResult === "wrong") return "答错";
  if (record.retestResult === "first_try_correct") return "复测答对";
  if (record.retestResult === "wrong") return "复测答错";
  return "未完成";
}

function ObjectiveReview({
  module,
  session,
}: {
  module: "listening" | "reading";
  session: ListeningSession | ReadingSession;
}) {
  const contentId = module === "listening"
    ? (session as ListeningSession).materialId
    : (session as ReadingSession).articleId;
  const material = module === "listening" ? listeningMaterialById(contentId) : readingArticleById(contentId);
  const [showTranscript, setShowTranscript] = useState(false);
  const [audioPlaying, setAudioPlaying] = useState(false);

  if (!material) {
    return <div className="er-review-error">题目内容已不可用（contentId: {contentId}）。</div>;
  }

  const lesson = module === "listening" ? listeningLesson(material as never) : readingLesson(material as never);
  const records = session.lesson?.records ?? {};

  return (
    <div className="er-review-content">
      {module === "listening" && (material as { audio?: { src?: string; type?: string } }).audio?.src && (
        <div className="er-review-audio">
          <button
            className="er-audio-btn"
            onClick={() => setAudioPlaying(!audioPlaying)}
            aria-label={audioPlaying ? "暂停音频" : "播放音频"}
          >
            <Volume2 size={18} />{audioPlaying ? "播放中（回顾模式不修改统计）" : "播放音频（回顾模式）"}
          </button>
          {audioPlaying && (
            <audio
              src={(material as { audio: { src: string } }).audio.src}
              controls
              autoPlay
              onEnded={() => setAudioPlaying(false)}
              className="er-audio-player"
            />
          )}
        </div>
      )}

      <div className="er-review-section">
        <button className="er-toggle-btn" onClick={() => setShowTranscript(!showTranscript)}>
          {showTranscript ? <X size={15} /> : <BookOpen size={15} />}
          {showTranscript ? "收起原文" : "查看原文"}
        </button>
        {showTranscript && (
          <div className="er-passage">
            {module === "listening"
              ? (material as { transcript: string }).transcript
              : (material as { passage?: string; paragraphs?: string[] }).passage ??
                (material as { paragraphs?: string[] }).paragraphs?.join("\n\n") ?? "原文暂不可用"}
          </div>
        )}
      </div>

      <div className="er-questions">
        {lesson.questions.map((q, idx) => {
          const record = records[q.id];
          const userAnswer = record?.initial?.[record.initial.length - 1]?.optionId ??
            record?.retest?.[record.retest.length - 1]?.optionId ?? null;
          const isCorrect = userAnswer === q.answerId;
          return (
            <div key={q.id} className="er-question">
              <div className="er-question-head">
                <span className="er-q-num">{idx + 1}</span>
                <span className={`er-q-result${isCorrect ? " is-correct" : " is-wrong"}`}>
                  {isCorrect ? <Check size={13} /> : <X size={13} />}
                  {record ? resultLabel(record) : "未作答"}
                </span>
              </div>
              <p className="er-q-prompt">{q.prompt}</p>
              <div className="er-options">
                {q.options.map((opt) => {
                  const isUser = userAnswer === opt.id;
                  const isAnswer = q.answerId === opt.id;
                  return (
                    <div
                      key={opt.id}
                      className={`er-option${isAnswer ? " is-answer" : ""}${isUser && !isAnswer ? " is-user-wrong" : ""}`}
                    >
                      <span className="er-option-id">{opt.id}</span>
                      <span className="er-option-text">{opt.text}</span>
                      {isAnswer && <span className="er-option-tag">正确答案</span>}
                      {isUser && !isAnswer && <span className="er-option-tag er-tag-wrong">你的选择</span>}
                    </div>
                  );
                })}
              </div>
              {record && (record.initial?.length ?? 0) > 1 && (
                <p className="er-attempts">
                  作答记录：{record.initial.map((a, i) => `${i + 1}. ${a.optionId}${a.hinted ? "(提示)" : ""}`).join(" → ")}
                  {record.retest?.length ? ` → 复测：${record.retest.map((a) => a.optionId).join(", ")}` : ""}
                </p>
              )}
              {q.explanation && (
                <div className="er-explanation">
                  <strong>解析：</strong>{q.explanation}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SubjectiveReview({
  module,
  session,
}: {
  module: "translation" | "writing";
  session: TranslationSession | WritingSession;
}) {
  const contentId = (session as { taskId: string }).taskId;
  const task = module === "translation" ? translationTaskById(contentId) : writingTaskById(contentId);

  if (!task) {
    return <div className="er-review-error">题目内容已不可用（contentId: {contentId}）。</div>;
  }

  const feedback = session.feedback;
  const submittedText = session.submittedText ?? session.draft ?? "";

  return (
    <div className="er-review-content">
      <div className="er-review-section">
        <h4 className="er-section-title">题目</h4>
        {module === "translation" ? (
          <div className="er-subjective-prompt">
            {(task as { promptChinese: string }).promptChinese}
          </div>
        ) : (
          <div className="er-subjective-prompt">
            <p>{(task as { prompt: string }).prompt}</p>
            {(task as { requirements?: string[] }).requirements && (task as { requirements: string[] }).requirements.length > 0 && (
              <ul>{(task as { requirements: string[] }).requirements.map((r, i) => <li key={i}>{r}</li>)}</ul>
            )}
          </div>
        )}
      </div>

      <div className="er-review-section">
        <h4 className="er-section-title">你的作答</h4>
        <div className="er-submitted-text">{submittedText || "（未提交）"}</div>
        {(session as { wordCount?: number }).wordCount != null && (
          <p className="er-word-count">字数：{(session as { wordCount: number }).wordCount}</p>
        )}
      </div>

      {feedback && (
        <div className="er-review-section">
          <h4 className="er-section-title">
            反馈（估分 {feedback.score}/{feedback.maxScore}，仅供参考）
          </h4>
          <p className="er-feedback-summary">{feedback.summary}</p>
          {feedback.issues.length > 0 && (
            <div className="er-feedback-issues">
              <strong>主要问题：</strong>
              <ul>{feedback.issues.map((issue, i) => <li key={i}><strong>{issue.title}</strong>：{issue.description}</li>)}</ul>
            </div>
          )}
          {feedback.details.length > 0 && (
            <div className="er-feedback-details">
              <strong>详细分析：</strong>
              {feedback.details.map((d, i) => (
                <div key={i} className="er-feedback-detail">
                  {d.excerpt && <p><em>原文：</em>{d.excerpt}</p>}
                  {d.userExpression && <p><em>你的表达：</em>{d.userExpression}</p>}
                  {d.referenceExpression && <p><em>参考表达：</em>{d.referenceExpression}</p>}
                  {d.note && <p><em>说明：</em>{d.note}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="er-review-section">
        <h4 className="er-section-title">参考答案</h4>
        <div className="er-reference">
          {module === "translation"
            ? (task as { referenceTranslation: string }).referenceTranslation
            : (task as { referenceEssay: string }).referenceEssay}
        </div>
        {(task as { referenceExplanation?: string }).referenceExplanation && (
          <div className="er-explanation">
            <strong>解析：</strong>{(task as { referenceExplanation: string }).referenceExplanation}
          </div>
        )}
      </div>
    </div>
  );
}

export function ExamRecordReview() {
  const params = useParams();
  const mod = params.module as ExamModule;
  const sessionId = params.sessionId as string;

  const listening = useListening();
  const reading = useReading();
  const translation = useTranslation();
  const writing = useWriting();

  const session = useMemo(() => {
    if (mod === "listening") return listening.store.sessions[sessionId] ?? null;
    if (mod === "reading") return reading.store.sessions[sessionId] ?? null;
    if (mod === "translation") return translation.store.sessions[sessionId] ?? null;
    if (mod === "writing") return writing.store.sessions[sessionId] ?? null;
    return null;
  }, [mod, sessionId, listening.store, reading.store, translation.store, writing.store]);

  const ready = listening.ready && reading.ready && translation.ready && writing.ready;
  const Icon = moduleIcons[mod] ?? BookOpen;
  const isValidModule = ["listening", "reading", "translation", "writing"].includes(mod);

  if (!isValidModule) {
    return (
      <main className="exam-page">
        <header className="exam-header">
          <Link className="exam-back" href="/practice/exams/records" aria-label="返回学习记录"><ArrowLeft size={20} /></Link>
          <div><p className="exam-eyebrow">学习记录</p><h1>无效的专项</h1></div>
        </header>
        <section className="exam-empty"><h2>无效的专项类型</h2><p>请返回学习记录列表。</p>
          <Link className="exam-action" href="/practice/exams/records">返回学习记录</Link></section>
      </main>
    );
  }

  if (!ready) {
    return <main className="exam-page"><div className="exercise-loading">正在加载记录…</div></main>;
  }

  if (!session) {
    return (
      <main className="exam-page">
        <header className="exam-header">
          <Link className="exam-back" href="/practice/exams/records" aria-label="返回学习记录"><ArrowLeft size={20} /></Link>
          <div><p className="exam-eyebrow">学习记录</p><h1>记录不存在</h1></div>
        </header>
        <section className="exam-empty"><h2>没有找到这条学习记录</h2>
          <p>该会话可能已被清除或不存在。</p>
          <Link className="exam-action" href="/practice/exams/records">返回学习记录</Link></section>
      </main>
    );
  }

  if (session.mode !== "selected") {
    return (
      <main className="exam-page">
        <header className="exam-header">
          <Link className="exam-back" href="/practice/exams/records" aria-label="返回学习记录"><ArrowLeft size={20} /></Link>
          <div><p className="exam-eyebrow">学习记录</p><h1>非真题选练记录</h1></div>
        </header>
        <section className="exam-empty"><h2>这条记录不属于真题选练</h2>
          <p>学习记录仅展示真题选练会话。</p>
          <Link className="exam-action" href="/practice/exams/records">返回学习记录</Link></section>
      </main>
    );
  }

  const isCompleted = session.phase === "complete";

  return (
    <main className="exam-page er-review-page">
      <header className="exam-header">
        <Link className="exam-back" href="/practice/exams/records" aria-label="返回学习记录"><ArrowLeft size={20} /></Link>
        <div style={{ flex: 1 }}>
          <p className="exam-eyebrow">学习记录 · 只读回顾</p>
          <h1>{moduleLabel(mod)}练习回顾</h1>
        </div>
        <span className={`er-review-badge${isCompleted ? " is-complete" : ""}`}>
          <Icon size={16} />{isCompleted ? "已完成" : "未完成"}
        </span>
      </header>

      <div className="er-review-meta">
        <span>开始：{formatShanghaiTime(session.startedAt)}</span>
        {session.completedAt && <span>完成：{formatShanghaiTime(session.completedAt)}</span>}
        {session.applied && session.rewardXp != null && <span className="er-xp">+{session.rewardXp} XP</span>}
      </div>

      {!isCompleted && (
        <div className="er-review-notice" role="alert">
          这是未完成的练习。回顾页面为只读模式，不会修改学习进度。
          <Link className="er-action" href={`/practice/${mod}/session/${sessionId}`}>继续练习</Link>
        </div>
      )}

      {(mod === "listening" || mod === "reading") ? (
        <ObjectiveReview module={mod} session={session as ListeningSession | ReadingSession} />
      ) : (
        <SubjectiveReview module={mod} session={session as TranslationSession | WritingSession} />
      )}

      <div className="er-review-footer">
        <Link className="er-action er-action-secondary" href="/practice/exams/records">返回学习记录</Link>
      </div>
    </main>
  );
}
