"use client";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useProfile } from "@/components/profile/ProfileProvider";
import type { Intensity, PlanModule, SimpleWeight } from "@/types/dailyPlan";

const MODULES: { key: PlanModule; label: string }[] = [
  { key: "vocabulary", label: "词汇" },
  { key: "reading", label: "阅读" },
  { key: "listening", label: "听力" },
  { key: "translation", label: "翻译" },
  { key: "writing", label: "写作" },
];
const WEIGHTS: { key: SimpleWeight; label: string }[] = [
  { key: "sparse", label: "少量" },
  { key: "normal", label: "普通" },
  { key: "focus", label: "重点" },
];
const INTENSITIES: { key: Intensity; label: string }[] = [
  { key: "light", label: "轻量" },
  { key: "standard", label: "标准" },
  { key: "intense", label: "强化" },
];

export default function PlanSettingsPage() {
  const router = useRouter();
  const { planPreferences, updatePlanPreferences, ready } = useProfile();
  if (!ready || !planPreferences) return <main className="me-page"><p className="me-loading">加载中…</p></main>;

  const setWeight = (mod: PlanModule, w: SimpleWeight) => {
    updatePlanPreferences({ ...planPreferences, simple: { ...planPreferences.simple, [mod]: w } }, true);
  };
  const setIntensity = (i: Intensity) => {
    updatePlanPreferences({ ...planPreferences, intensity: i }, true);
  };

  return (
    <main className="me-page">
      <header className="me-header">
        <button className="exercise-icon-button" onClick={() => router.push("/me")}><ArrowLeft size={22} /></button>
        <h1>学习计划设置</h1>
      </header>

      <section className="me-section">
        <h3>学习强度</h3>
        <div className="me-seg">
          {INTENSITIES.map((i) => (
            <button key={i.key} className={`me-seg-btn ${planPreferences.intensity === i.key ? "active" : ""}`} onClick={() => setIntensity(i.key)}>
              {i.label}
            </button>
          ))}
        </div>
      </section>

      <section className="me-section">
        <h3>各科侧重</h3>
        {MODULES.map((m) => (
          <div key={m.key} className="me-weight-row">
            <span>{m.label}</span>
            <div className="me-seg">
              {WEIGHTS.map((w) => (
                <button
                  key={w.key}
                  className={`me-seg-btn sm ${planPreferences.simple[m.key] === w.key ? "active" : ""}`}
                  onClick={() => setWeight(m.key, w.key)}
                >
                  {w.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </section>

      <p className="me-note">修改后未来未完成的计划会按新偏好重新生成；历史完成记录不变。</p>
    </main>
  );
}
