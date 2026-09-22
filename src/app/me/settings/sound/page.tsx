"use client";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useProfile } from "@/components/profile/ProfileProvider";

export default function SoundPage() {
  const router = useRouter();
  const { profile, setSound, ready } = useProfile();
  if (!ready || !profile) return <main className="me-page"><p className="me-loading">加载中…</p></main>;

  const rows = [
    { key: "answerSound" as const, label: "答题音效" },
    { key: "haptic" as const, label: "震动反馈" },
    { key: "celebration" as const, label: "完成庆祝动画" },
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
                checked={profile.sound[r.key]}
                onChange={(e) => setSound({ [r.key]: e.target.checked })}
              />
            </label>
          ))}
        </div>
      </section>
    </main>
  );
}
