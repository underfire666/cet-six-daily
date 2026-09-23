"use client";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useProfile } from "@/components/profile/ProfileProvider";
import type { TargetScore } from "@/lib/profile/store";

const OPTIONS: TargetScore[] = [425, 500, 550, 600];

export default function TargetPage() {
  const router = useRouter();
  const { profile, setTargetScore, ready } = useProfile();
  if (!ready || !profile) return <main className="me-page"><p className="me-loading">加载中…</p></main>;

  return (
    <main className="me-page">
      <header className="me-header">
        <button className="exercise-icon-button" onClick={() => router.push("/me")}><ArrowLeft size={22} /></button>
        <h1>目标分数</h1>
      </header>
      <section className="me-section">
        <p className="me-note">选择你的 CET-6 目标分数。</p>
        <div className="me-option-list">
          {OPTIONS.map((v) => (
            <button
              key={v}
              className={`me-option ${profile.targetScore === v ? "active" : ""}`}
              onClick={() => { setTargetScore(v); router.push("/me"); }}
            >
              <span>{v === 600 ? "600+" : v}</span>
              <span>{profile.targetScore === v ? "✓" : ""}</span>
            </button>
          ))}
        </div>
      </section>
    </main>
  );
}
