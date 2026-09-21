"use client";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  Clock3,
  Headphones,
  Languages,
  LockKeyhole,
  NotebookPen,
  RotateCw,
  Settings,
  SpellCheck,
} from "lucide-react";
import { useToday } from "@/components/StudyProvider";
import { useDailyPlan } from "@/components/dailyPlan/DailyPlanProvider";
import { shortDate } from "@/lib/dates";
import { taskCompleted } from "@/lib/dailyPlan/generator";
import type { DailyTask, PlanModule } from "@/types/dailyPlan";

const ICONS: Record<PlanModule, typeof BookOpen> = {
  vocabulary: SpellCheck,
  reading: BookOpen,
  listening: Headphones,
  translation: Languages,
  writing: NotebookPen,
};

const NAMES: Record<PlanModule, string> = {
  vocabulary: "词汇",
  reading: "阅读",
  listening: "听力",
  translation: "翻译",
  writing: "写作",
};

export default function DailyPlanPage() {
  const params = useParams();
  const router = useRouter();
  const today = useToday();
  const { getPlan, getCompletion, ready, notice } = useDailyPlan();
  const date = String(params.date ?? today);
  const plan = getPlan(date);
  const isFuture = date > today;
  const isToday = date === today;

  const taskStatus = (task: DailyTask): "completed" | "active" | "locked" => {
    if (isFuture) return "locked";
    if (plan && taskCompleted(plan, task, getCompletion(date))) return "completed";
    return "active";
  };

  const doneCount = plan
    ? plan.tasks.filter((t) => !t.removed && taskStatus(t) === "completed").length
    : 0;
  const totalCount = plan ? plan.tasks.filter((t) => !t.removed).length : 0;
  const allDone = totalCount > 0 && doneCount === totalCount;

  return (
    <main className="plan-page">
      <header className="plan-header">
        <button
          className="exercise-icon-button"
          onClick={() => router.push("/")}
          aria-label="返回首页"
        >
          <ArrowLeft size={22} />
        </button>
        <div>
          <h1>{isToday ? "今日总关卡" : shortDate(date)}</h1>
          <p className="plan-sub">
            {isFuture
              ? "这一天还没到，先看看要学什么"
              : plan
                ? `${plan.phase === "foundation" ? "基础期" : plan.phase === "improvement" ? "提升期" : "冲刺期"} · 约 ${plan.estimatedMinutes} 分钟`
                : "暂无计划"}
          </p>
        </div>
        {isToday && (
          <Link href="/plan/settings" className="exercise-icon-button" aria-label="计划设置">
            <Settings size={20} />
          </Link>
        )}
      </header>

      {isFuture && (
        <div className="plan-locked-banner">
          <LockKeyhole size={16} />
          <span>{shortDate(date)} 解锁，现在还不能开始</span>
        </div>
      )}

      {plan && plan.adjusted && (
        <div className="plan-adjusted-banner">
          <RotateCw size={14} />
          <span>已根据你最近的学习情况调整了这一天</span>
        </div>
      )}

      {allDone && isToday && (
        <div className="plan-complete-banner">
          <Check size={18} strokeWidth={3} />
          <span>今日全部完成，继续保持！</span>
        </div>
      )}

      <section className="plan-progress">
        <div className="plan-progress-bar" role="progressbar" aria-valuenow={doneCount} aria-valuemin={0} aria-valuemax={totalCount}>
          <span style={{ width: totalCount ? `${(doneCount / totalCount) * 100}%` : "0%" }} />
        </div>
        <p className="plan-progress-text">
          {doneCount} / {totalCount} 个任务
        </p>
      </section>

      <section className="plan-tasks">
        {notice && <p role="alert" className="plan-warn">{notice}</p>}
        {!ready && <p className="plan-loading">正在加载今日计划…</p>}
        {ready && !plan && <Link className="primary-button" href={`/lesson/${date}`}>打开这一天的历史关卡</Link>}
        {ready &&
          plan &&
          plan.tasks.filter((t) => !t.removed).map((task) => {
            const Icon = ICONS[task.module];
            const status = taskStatus(task);
            const href = isFuture ? undefined : `/practice/${task.module}`;
            const body = (
              <>
                <span className="plan-task-icon">
                  {status === "completed" ? (
                    <Check size={18} strokeWidth={3} />
                  ) : (
                    <Icon size={20} />
                  )}
                </span>
                <span className="plan-task-body">
                  <strong>
                    {NAMES[task.module]}
                    {task.source === "rescheduled" && (
                      <span className="plan-task-badge" title={`从 ${shortDate(task.rescheduledFrom!)} 顺延`}>
                        <RotateCw size={11} /> 顺延
                      </span>
                    )}
                  </strong>
                  <small>
                    <Clock3 size={12} /> 约 {task.estimatedMinutes} 分钟 · {task.target}
                  </small>
                </span>
                <span className="plan-task-status">
                  {status === "completed" ? "✓ 已完成" : isFuture ? "未解锁" : "开始"}
                </span>
              </>
            );
            return status === "completed" || isFuture ? (
              <div
                key={task.id}
                className={`plan-task ${status}`}
                aria-label={`${NAMES[task.module]}，${status === "completed" ? "已完成" : "未解锁"}`}
              >
                {body}
              </div>
            ) : (
              <Link key={task.id} className="plan-task" href={href!}>
                {body}
                <ArrowRight size={18} />
              </Link>
            );
          })}
      </section>

      {isToday && !isFuture && (
        <section className="plan-extra">
          <p>完成最低任务后，可以再选一个专项加练。</p>
          <div className="plan-extra-row">
            {(Object.keys(ICONS) as PlanModule[]).map((m) => {
              const Icon = ICONS[m];
              return (
                <Link key={m} className="plan-extra-chip" href={`/practice/${m}`}>
                  <Icon size={16} />
                  {NAMES[m]} +1
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </main>
  );
}
