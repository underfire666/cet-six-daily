"use client";
import Link from "next/link";
import { ArrowRight, Flame, BookMarked, RotateCcw, Settings, Bell, Volume2, Info, Target, CalendarDays, BarChart3 } from "lucide-react";
import { useProfile } from "@/components/profile/ProfileProvider";

export default function MePage() {
  const { profile, stats, examDate, examDaysLeft, ready } = useProfile();

  if (!ready || !profile || !stats) {
    return <main className="me-page"><p className="me-loading">加载中…</p></main>;
  }

  return (
    <main className="me-page">
      <header className="me-header">
        <h1>我的</h1>
      </header>

      <section className="me-hero">
        <div className="me-hero-top">
          <div>
            <h2>六级备考</h2>
            <p className="me-hero-sub">
              目标 {profile.targetScore} 分 · {examDate ? `距考试 ${examDaysLeft ?? "-"} 天` : "未设置考试日期"}
            </p>
          </div>
          <div className="me-hero-badges">
            <span className="me-badge">Lv.{stats.level} · {stats.levelTitle}</span>
            <span className="me-badge streak">🔥 {stats.streak}</span>
          </div>
        </div>
      </section>

      <section className="me-stats-card">
        <div className="me-stats-grid">
          <div><strong>{stats.studyDays}</strong><span>学习天数</span></div>
          <div><strong>{stats.totalXp}</strong><span>总 XP</span></div>
          <div>
            <strong>{stats.overallAccuracy === null ? "暂无" : `${stats.overallAccuracy}%`}</strong>
            <span>正确率</span>
          </div>
          <div>
            <strong>{stats.weekly.studyDays}</strong><span>本周天数</span>
          </div>
        </div>
        <Link href="/me/stats" className="me-stats-more">
          查看学习数据详情 <ArrowRight size={14} />
        </Link>
      </section>

      <section className="me-section">
        <h3>复习</h3>
        <Link href="/review" className="me-row">
          <span className="me-row-label"><BookMarked size={18} /> 错题本</span>
          <span className="me-row-value">{stats.wrongCount} <ArrowRight size={14} /></span>
        </Link>
        <Link href="/review/words" className="me-row">
          <span className="me-row-label"><BookMarked size={18} /> 我的生词</span>
          <span className="me-row-value">{stats.wordbookCount} <ArrowRight size={14} /></span>
        </Link>
        <Link href="/review" className="me-row">
          <span className="me-row-label"><RotateCcw size={18} /> 今日待复习</span>
          <span className="me-row-value">
            {stats.dueReviewCount === 0 ? "今日已完成 ✓" : `${stats.dueReviewCount}`}
            <ArrowRight size={14} />
          </span>
        </Link>
      </section>

      <section className="me-section">
        <h3>设置</h3>
        <Link href="/me/settings/plan" className="me-row">
          <span className="me-row-label"><Settings size={18} /> 学习计划设置</span>
          <ArrowRight size={16} />
        </Link>
        <Link href="/me/settings/target" className="me-row">
          <span className="me-row-label"><Target size={18} /> 目标分数</span>
          <span className="me-row-value">{profile.targetScore} <ArrowRight size={14} /></span>
        </Link>
        <Link href="/me/settings/exam-date" className="me-row">
          <span className="me-row-label"><CalendarDays size={18} /> 考试日期</span>
          <span className="me-row-value">{examDate ?? "未设置"} <ArrowRight size={14} /></span>
        </Link>
        <Link href="/me/settings/reminders" className="me-row">
          <span className="me-row-label"><Bell size={18} /> 学习提醒</span>
          <ArrowRight size={16} />
        </Link>
        <Link href="/me/settings/sound" className="me-row">
          <span className="me-row-label"><Volume2 size={18} /> 声音与震动</span>
          <ArrowRight size={16} />
        </Link>
      </section>

      <section className="me-section">
        <h3>其他</h3>
        <Link href="/me/about" className="me-row">
          <span className="me-row-label"><Info size={18} /> 关于</span>
          <ArrowRight size={16} />
        </Link>
      </section>

      <div className="me-spacer" />
    </main>
  );
}
