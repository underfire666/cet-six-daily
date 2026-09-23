"use client";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useProfile } from "@/components/profile/ProfileProvider";
import { formatDuration } from "@/lib/profile/stats";

export default function MeStatsPage() {
  const router = useRouter();
  const { stats, ready } = useProfile();

  if (!ready || !stats) return <main className="me-page"><p className="me-loading">加载中…</p></main>;

  return (
    <main className="me-page">
      <header className="me-header">
        <button className="exercise-icon-button" onClick={() => router.push("/me")}><ArrowLeft size={22} /></button>
        <h1>学习数据</h1>
      </header>

      <section className="me-stats-card">
        <div className="me-stats-grid">
          <div><strong>{stats.studyDays}</strong><span>总学习天数</span></div>
          <div><strong>{formatDuration(stats.totalDurationSeconds)}</strong><span>学习时长</span></div>
          <div><strong>{stats.totalXp}</strong><span>总 XP</span></div>
          <div><strong>{stats.overallAccuracy === null ? "暂无" : `${stats.overallAccuracy}%`}</strong><span>整体正确率</span></div>
          <div><strong>{stats.objectiveAttempts}</strong><span>客观题作答</span></div>
        </div>
      </section>

      <section className="me-section">
        <h3>本周（周一至周日）</h3>
        <div className="me-stats-grid">
          <div><strong>{stats.weekly.studyDays}</strong><span>学习天数</span></div>
          <div><strong>{formatDuration(stats.weekly.durationSeconds)}</strong><span>学习时长</span></div>
          <div><strong>{stats.weekly.xp}</strong><span>获得 XP</span></div>
        </div>
      </section>

      <section className="me-section">
        <h3>最近 7 天</h3>
        <div className="me-week">
          {stats.last7.map((d) => (
            <div key={d.date} className={`me-week-day ${d.studied ? "done" : ""}`}>
              <span className="me-week-mark">{d.studied ? "✓" : "·"}</span>
              <span className="me-week-dow">{new Date(d.date + "T00:00:00+08:00").toLocaleDateString("zh-CN", { weekday: "narrow", timeZone: "Asia/Shanghai" })}</span>
            </div>
          ))}
        </div>
      </section>

      <p className="me-note">
        正确率仅统计词汇/阅读/听力/复习的客观题作答；翻译与写作是主观题，不计入。
        学习时长来自各专项真实会话（开始→完成）记录；历史无时长记录的旧会话不估算。
      </p>
    </main>
  );
}
