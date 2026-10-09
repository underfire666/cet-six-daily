"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, BookOpen, Check, Clock, Headphones, Languages, NotebookPen, Play } from "lucide-react";
import { examModules, type ExamModule } from "@/content/exam-catalog";
import { useReading } from "@/components/reading/ReadingProvider";
import { useListening } from "@/components/listening/ListeningProvider";
import { useTranslation } from "@/components/translation/TranslationProvider";
import { useWriting } from "@/components/writing/WritingProvider";
import {
  collectPracticeRecords,
  filterRecords,
  formatShanghaiTime,
  moduleLabel,
  practiceRecordReviewHref,
  practiceSessionHref,
  sortRecords,
  type PracticeRecord,
} from "@/lib/exam-records";
import { examRecordsHref, readExamRecords } from "@/lib/exam-records-route";

const moduleIcons: Record<ExamModule, typeof Headphones> = {
  listening: Headphones,
  reading: BookOpen,
  translation: Languages,
  writing: NotebookPen,
};

const statusOptions: { value: "all" | "in_progress" | "completed"; label: string }[] = [
  { value: "all", label: "全部" },
  { value: "in_progress", label: "未完成" },
  { value: "completed", label: "已完成" },
];

const moduleOptions: { value: "all" | ExamModule; label: string }[] = [
  { value: "all", label: "全部专项" },
  ...examModules.map((m) => ({ value: m as ExamModule, label: moduleLabel(m) })),
];

function RecordCard({ record, returnTo }: { record: PracticeRecord; returnTo: string }) {
  const Icon = moduleIcons[record.module];
  const isCompleted = record.status === "completed";
  const isShared = record.sharedSets.length > 1;
  return (
    <article className="er-record">
      <span className={`er-record-icon${isCompleted ? " is-complete" : ""}`}>
        <Icon size={20} />
      </span>
      <div className="er-record-body">
        <div className="er-record-head">
          <h3>{record.exerciseTitle ?? moduleLabel(record.module)}</h3>
          <span className={`er-status${isCompleted ? " is-complete" : ""}`}>
            {isCompleted ? <Check size={13} /> : <Clock size={13} />}
            {isCompleted ? "已完成" : "未完成"}
          </span>
        </div>
        <p className="er-record-exam">
          {record.examTitle ?? "共用题目（来源套卷未确定）"}
          {isShared && !record.originalSetKnown
            ? ` · 第 ${record.sharedSets.join("、")} 套共用`
            : isShared
              ? ` · 与第 ${record.sharedSets.filter(s => s !== record.examSet).join("、")} 套共用`
              : ""}
        </p>
        <div className="er-record-meta">
          <span>{moduleLabel(record.module)}</span>
          <span>·</span>
          <span>
            {isCompleted
              ? `完成 ${formatShanghaiTime(record.completedAt)}`
              : `开始 ${formatShanghaiTime(record.startedAt)}`}
          </span>
          {record.questionCount > 0 && (
            <>
              <span>·</span>
              <span>{record.answeredCount}/{record.questionCount} 题</span>
            </>
          )}
          {record.xp != null && (
            <>
              <span>·</span>
              <span className="er-xp">+{record.xp} XP</span>
            </>
          )}
        </div>
      </div>
      <div className="er-record-actions">
        {isCompleted ? (
          <Link className="er-action er-action-secondary" href={practiceRecordReviewHref(record.module, record.sessionId, returnTo)}>
            查看记录
          </Link>
        ) : (
          <Link className="er-action" href={practiceSessionHref(record.module, record.sessionId, returnTo)}>
            <Play size={15} />继续练习
          </Link>
        )}
      </div>
    </article>
  );
}

export function ExamRecords() {
  const params = useSearchParams();
  const state = readExamRecords(params.toString());
  const reading = useReading();
  const listening = useListening();
  const translation = useTranslation();
  const writing = useWriting();
  const ready = reading.ready && listening.ready && translation.ready && writing.ready;

  const records = useMemo(() => {
    if (!ready) return [];
    const all = collectPracticeRecords({
      listening: { sessions: listening.store.sessions },
      reading: { sessions: reading.store.sessions },
      translation: { sessions: translation.store.sessions },
      writing: { sessions: writing.store.sessions },
    });
    return sortRecords(filterRecords(all, state.status, state.module));
  }, [ready, listening.store, reading.store, translation.store, writing.store, state.status, state.module]);

  const inProgressCount = useMemo(
    () => records.filter((r) => r.status === "in_progress").length,
    [records],
  );
  const completedCount = records.length - inProgressCount;

  const navigate = (next: typeof state) => {
    window.history.replaceState(null, "", examRecordsHref(next));
    window.scrollTo({ top: 0 });
  };

  // Current records page URL with filters, used as returnTo for session/review links
  const returnTo = examRecordsHref(state);

  return (
    <main className="exam-page er-page">
      <header className="exam-header">
        <Link className="exam-back" href="/practice/exams" aria-label="返回真题题库">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <p className="exam-eyebrow">六级日常</p>
          <h1>学习记录</h1>
        </div>
      </header>

      <section className="er-summary">
        <p>共 {records.length} 条记录 · 未完成 {inProgressCount} · 已完成 {completedCount}</p>
      </section>

      <div className="er-filters" role="group" aria-label="状态筛选">
        {statusOptions.map((opt) => (
          <button
            key={opt.value}
            aria-pressed={state.status === opt.value}
            onClick={() => navigate({ ...state, status: opt.value })}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div className="er-filters er-filters-module" role="group" aria-label="专项筛选">
        {moduleOptions.map((opt) => (
          <button
            key={opt.value}
            aria-pressed={state.module === opt.value}
            onClick={() => navigate({ ...state, module: opt.value })}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {!ready ? (
        <section className="exam-empty">
          <h2>正在加载学习记录…</h2>
          <p>请稍候。</p>
        </section>
      ) : records.length === 0 ? (
        <section className="exam-empty">
          <h2>暂无学习记录</h2>
          <p>去真题题库开始一组练习吧。</p>
          <Link className="exam-action" href="/practice/exams">前往真题题库</Link>
        </section>
      ) : (
        <div className="er-list">
          {records.map((record) => (
            <RecordCard key={`${record.module}-${record.sessionId}`} record={record} returnTo={returnTo} />
          ))}
        </div>
      )}

      <p className="exam-footnote">记录来自听力、阅读、翻译、写作四项选练会话。每次重新练习保留独立记录。</p>
    </main>
  );
}
