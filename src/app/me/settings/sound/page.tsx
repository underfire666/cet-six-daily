"use client";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useProfile } from "@/components/profile/ProfileProvider";

/**
 * 声音与震动：操作现有学习系统的 FeedbackSettings（cet-daily:v2:settings），
 * 与 Vocabulary / Reading / Listening / Daily Lesson 的 playFeedback、庆祝动画共用同一数据源。
 * Listening 正文音频不受"答题音效"开关影响（内容音频 ≠ UI 音效）。
 */
export default function SoundPage() {
  const router = useRouter();
  const { settings, setSettings, ready } = useProfile();
  if (!ready || !settings) return <main className="me-page"><p className="me-loading">加载中…</p></main>;

  const rows = [
    { key: "soundEnabled" as const, label: "答题音效" },
    { key: "hapticsEnabled" as const, label: "震动反馈" },
    { key: "celebrationEnabled" as const, label: "完成庆祝动画" },
  ];

  return (
    <main className="me-page">
      <header className="me-header">
        <button className="exercise-icon-button" onClick={() => router.push("/me")}><ArrowLeft size={22} /></button>
        <h1>声音与震动</h1>
      </header>
      <section className="me-section">
        <div className="me-toggle-list">
          {rows.map((r) => (
            <label key={r.key} className="me-toggle">
              <div>
                <strong>{r.label}</strong>
              </div>
              <input
                type="checkbox"
                checked={settings[r.key]}
                onChange={(e) => setSettings({ ...settings, [r.key]: e.target.checked })}
              />
            </label>
          ))}
        </div>
        <p className="me-note">关闭答题音效不影响听力正文音频播放；关闭庆祝动画后完成学习不再展示庆祝效果。</p>
      </section>
    </main>
  );
}
