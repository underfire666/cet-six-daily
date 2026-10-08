"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, BookOpen, Check, ClipboardList, Headphones, Languages, NotebookPen } from "lucide-react";
import { examModules, examYears, getExamCatalog, type ExamExercise } from "@/content/exam-catalog";
import { examBrowseHref, examPracticeHref, readExamBrowse, type ExamBrowseState } from "@/lib/exam-browse-route";
import { useReading } from "../reading/ReadingProvider";
import { useListening } from "../listening/ListeningProvider";
import { useTranslation } from "../translation/TranslationProvider";
import { useWriting } from "../writing/WritingProvider";

const labels = { listening: "听力", reading: "阅读", translation: "翻译", writing: "写作" };
const icons = { listening: Headphones, reading: BookOpen, translation: Languages, writing: NotebookPen };
interface SelectionSession {
  id: string; mode: string; phase: string; startedAt: string;
  articleId?: string; materialId?: string; taskId?: string;
}
function exerciseStatus(exercise: ExamExercise, sessions: Record<string, SelectionSession>) {
  const matching = Object.values(sessions).filter(session => session.mode === "selected" &&
    (session.articleId ?? session.materialId ?? session.taskId) === exercise.id);
  const pending = matching.some(session => session.phase !== "complete");
  const completed = matching.some(session => session.phase === "complete");
  return { pending, completed, label: pending ? "继续练习" : completed ? "重新练习" : "开始练习" };
}

export function ExamBrowser() {
  const params = useSearchParams();
  const state = readExamBrowse(params.toString());
  const router = useRouter();
  const catalog = useMemo(() => getExamCatalog(), []);
  const reading = useReading(), listening = useListening(), translation = useTranslation(), writing = useWriting();
  const practices = { reading, listening, translation, writing };
  const ready = examModules.every(module => practices[module].ready);
  const [error, setError] = useState("");
  const selected = catalog.find(entry => entry.id === state.exam);
  const saveNotice = practices[state.module].notice;
  const invalidExam = !!params.get("exam") && !selected;
  const filtered = catalog.filter(entry => (!state.year || entry.year === state.year) &&
    (!state.period || entry.period === state.period) && (!state.set || entry.set === state.set));

  const navigate = (next: ExamBrowseState, replace = false) => {
    setError("");
    window.history[replace ? "replaceState" : "pushState"](null, "", examBrowseHref(next));
    window.scrollTo({ top: 0 });
  };
  const filter = (key: "year" | "period" | "set", value: string) => navigate({ ...state, [key]: value, exam: "" }, true);
  const begin = (exercise: ExamExercise) => {
    const id = practices[exercise.module].startSelected(exercise.id);
    if (id) router.push(examPracticeHref(exercise.module, id, state));
    else setError("这组练习暂时无法开始，请刷新后重试。");
  };

  return (
    <main className="exam-page">
      <header className="exam-header">
        {selected || invalidExam ?
          <button className="exam-back" onClick={() => navigate({ ...state, exam: "" })} aria-label="返回列表"><ArrowLeft size={20} /></button> :
          <Link className="exam-back" href="/" aria-label="返回学习首页"><ArrowLeft size={20} /></Link>}
        <div style={{ flex: 1 }}><p className="exam-eyebrow">六级日常</p><h1>真题题库</h1></div>
        {!selected && !invalidExam && (
          <Link className="er-header-link" href="/practice/exams/records" aria-label="学习记录">
            <ClipboardList size={18} /><span>记录</span>
          </Link>
        )}
      </header>

      {invalidExam ? (
        <section className="exam-empty"><h2>没有找到这套试卷</h2><p>请返回列表重新选择。</p>
          <button className="exam-action" onClick={() => navigate({ ...state, exam: "" })}>返回列表</button>
        </section>
      ) : selected ? (
        <>
          <section className="exam-summary">
            <p className="exam-eyebrow">按题组选练</p><h2>{selected.title}</h2>
            <p>选择一组练习，退出后可接着做。</p>
          </section>
          <div className="exam-tabs" role="group" aria-label="练习专项">
            {examModules.map(module => {
              const Icon = icons[module];
              return <button key={module} aria-pressed={state.module === module} onClick={() => navigate({ ...state, module })}>
                <Icon size={18} /><span>{labels[module]}</span>
              </button>;
            })}
          </div>
          <div className="exam-exercise-heading"><h3>{labels[state.module]}练习</h3>
            <span>{selected.exercises[state.module].length} 组</span>
          </div>
          {(state.module === "listening" && selected.listeningSharedWith) || (state.module === "reading" && selected.readingSharedWith) ?
            <p className="exam-shared">与第 {state.module === "listening" ? selected.listeningSharedWith : selected.readingSharedWith} 套共用题目，练习进度共用。</p> : null}
          {error && <p className="exam-notice" role="alert">{error}</p>}
          {saveNotice && <p className="exam-notice" role="status">{saveNotice}</p>}
          <div className="exam-exercises">
            {selected.exercises[state.module].map((exercise, index) => {
              const status = exerciseStatus(exercise, practices[state.module].store.sessions);
              return <article className="exam-exercise" data-exercise-id={exercise.id} key={exercise.id}>
                <span className={`exam-number${status.completed ? " is-complete" : ""}`} aria-hidden="true">{status.completed ? <Check size={20} /> : String(index + 1).padStart(2, "0")}</span>
                <div className="exam-exercise-copy"><h4>{exercise.title}</h4>
                  <p>{exercise.questionCount} {exercise.module === "reading" || exercise.module === "listening" ? "题" : "项任务"} · 约 {exercise.minutes} 分钟</p>
                  {(status.pending || status.completed) && <span className="exam-progress">{status.pending ? saveNotice ? "进度暂存于本页" : "进度已保存" : "已完成"}</span>}
                </div>
                <button className="exam-action" aria-label={`${exercise.available ? status.label : "暂不可用"} · ${exercise.title}`} disabled={!ready || !exercise.available} onClick={() => begin(exercise)}>{exercise.available ? status.label : "暂不可用"}</button>
              </article>;
            })}
          </div>
          <p className="exam-footnote">选练单独记录，今日计划照常保留。</p>
        </>
      ) : (
        <>
          <section className="exam-summary"><p className="exam-eyebrow">2022—2026</p><h2>选一套，练一点。</h2><p>听力、阅读、翻译、写作，按自己的节奏来。</p></section>
          <div className="exam-filters">
            <label>年份<select aria-label="年份" value={state.year} onChange={event => filter("year", event.target.value)}><option value="">全部年份</option>{examYears.map(year => <option key={year} value={year}>{year} 年</option>)}</select></label>
            <label>考期<select aria-label="考期" value={state.period} onChange={event => filter("period", event.target.value)}><option value="">全部考期</option>{["03", "06", "09", "12"].map(period => <option key={period} value={period}>{Number(period)} 月</option>)}</select></label>
            <label>套卷<select aria-label="套卷" value={state.set} onChange={event => filter("set", event.target.value)}><option value="">全部套卷</option>{["1", "2", "3"].map(set => <option key={set} value={set}>第 {set} 套</option>)}</select></label>
          </div>
          <div className="exam-list-heading"><h3>可选试卷</h3><span aria-live="polite">{filtered.length} 套</span></div>
          {filtered.length ? <div className="exam-paper-grid">{filtered.map(entry => {
            const exercises = examModules.flatMap(module => entry.exercises[module]);
            const done = exercises.filter(exercise => exerciseStatus(exercise, practices[exercise.module].store.sessions).completed).length;
            const pending = exercises.some(exercise => exerciseStatus(exercise, practices[exercise.module].store.sessions).pending);
            return <button className="exam-paper-card" data-exam-id={entry.id} key={entry.id} onClick={() => navigate({ ...state, exam: entry.id })}>
              <span className="exam-paper-icon"><BookOpen size={24} /></span>
              <span className="exam-paper-copy"><strong>{entry.year} 年 {Number(entry.period)} 月</strong><span>第 {entry.set} 套 · 四项专项</span>
                {ready && (done || pending) ? <small>{pending ? "有练习待继续" : `已完成 ${done}/${exercises.length} 组`}</small> : null}
              </span><ArrowRight size={19} />
            </button>;
          })}</div> : <section className="exam-empty"><h2>暂无符合筛选的试卷</h2><p>换一个年份或考期试试。</p><button className="exam-action" onClick={() => navigate({ ...state, year: "", period: "", set: "" }, true)}>清除筛选</button></section>}
        </>
      )}
    </main>
  );
}
