"use client";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useProfile } from "@/components/profile/ProfileProvider";

export default function RemindersPage() {
  const router = useRouter();
  const { notice, profile, setReminders, ready } = useProfile();
  if (!ready || !profile) return <main className="me-page"><p className="me-loading">加载中…</p></main>;

  const rows = [
    { key: "evening" as const, time: "20:00", text: "今天的六级任务已经准备好了。" },
    { key: "miss" as const, time: "23:00", text: "今天还有一点学习任务没完成。" },
    { key: "lastChance" as const, time: "23:45", text: "还有一点时间，要不要完成今天的学习？" },
  ];

  return (
    <main className="me-page">
      <header className="me-header">
        <button className="exercise-icon-button" onClick={() => router.push("/me")}><ArrowLeft size={22} /></button>
        <h1>学习提醒</h1>
      </header>
      {notice && <p role="status" className="me-note">{notice}</p>}
      <section className="me-section">
        <div className="me-toggle-list">
          {rows.map((r) => (
            <label key={r.key} className="me-toggle">
              <div>
                <strong>{r.time}</strong>
                <p>{r.text}</p>
              </div>
              <input
                type="checkbox"
                checked={profile.reminders[r.key]}
                onChange={(e) => setReminders({ [r.key]: e.target.checked })}
              />
            </label>
          ))}
        </div>
        <p className="me-note">通知功能将在移动端版本中启用；以上开关会保存你的提醒偏好。</p>
      </section>
    </main>
  );
}
