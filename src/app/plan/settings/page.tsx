"use client";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useState } from "react";
import { useDailyPlan } from "@/components/dailyPlan/DailyPlanProvider";
import type {
  PlanModule,
  PreferenceMode,
  SimpleWeight,
  StudyPreferences,
} from "@/types/dailyPlan";

const MODULES: { key: PlanModule; name: string }[] = [
  { key: "vocabulary", name: "词汇" },
  { key: "reading", name: "阅读" },
  { key: "listening", name: "听力" },
  { key: "translation", name: "翻译" },
  { key: "writing", name: "写作" },
];

export default function PlanSettingsPage() {
  const router = useRouter();
  const { preferences, updatePreferences, ready } = useDailyPlan();
  const [draft, setDraft] = useState<StudyPreferences>(preferences);
  const [msg, setMsg] = useState("");

  if (!ready) return <main className="plan-page"><p>加载中…</p></main>;

  const advancedTotal = Object.values(draft.advanced).reduce((n, x) => n + x, 0);
  const advancedOk = draft.mode === "simple" || advancedTotal === 100;

  const save = (syncFuture: boolean) => {
    if (!advancedOk) {
      setMsg("高级权重合计必须是 100%，当前 " + advancedTotal + "%");
      return;
    }
    updatePreferences(draft, syncFuture);
    setMsg(syncFuture ? "已保存，后续计划已重新生成。" : "已保存，只修改今天。");
  };

  return (
    <main className="plan-page">
      <header className="plan-header">
        <button className="exercise-icon-button" onClick={() => router.push("/")} aria-label="返回">
          <ArrowLeft size={22} />
        </button>
        <h1>学习计划设置</h1>
      </header>

      <section className="plan-settings-block">
        <h2>每日学习时长</h2>
        <div className="plan-settings-row">
          {(["light", "standard", "intense"] as const).map((k) => (
            <button
              key={k}
              className={`plan-pill ${draft.intensity === k ? "active" : ""}`}
              onClick={() => setDraft({ ...draft, intensity: k })}
            >
              {k === "light" ? "轻量" : k === "standard" ? "标准" : "加强"}
              <small>{k === "light" ? "10–15 分钟" : k === "standard" ? "15–25 分钟" : "25–35 分钟"}</small>
            </button>
          ))}
        </div>
      </section>

      <section className="plan-settings-block">
        <h2>模式</h2>
        <div className="plan-settings-row">
          {(["simple", "advanced"] as PreferenceMode[]).map((k) => (
            <button
              key={k}
              className={`plan-pill ${draft.mode === k ? "active" : ""}`}
              onClick={() => setDraft({ ...draft, mode: k })}
            >
              {k === "simple" ? "简单模式" : "高级模式"}
            </button>
          ))}
        </div>
      </section>

      {draft.mode === "simple" ? (
        <section className="plan-settings-block">
          <h2>专项重点</h2>
          {MODULES.map((m) => (
            <div key={m.key} className="plan-settings-line">
              <span>{m.name}</span>
              <div className="plan-settings-row">
                {(["focus", "normal", "sparse"] as SimpleWeight[]).map((w) => (
                  <button
                    key={w}
                    className={`plan-pill ${draft.simple[m.key] === w ? "active" : ""}`}
                    onClick={() =>
                      setDraft({ ...draft, simple: { ...draft.simple, [m.key]: w } })
                    }
                  >
                    {w === "focus" ? "重点" : w === "normal" ? "普通" : "少量"}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </section>
      ) : (
        <section className="plan-settings-block">
          <h2>高级权重（合计 {advancedTotal}%）</h2>
          {MODULES.map((m) => (
            <div key={m.key} className="plan-settings-line">
              <span>{m.name}</span>
              <input
                type="number"
                min={0}
                max={100}
                value={draft.advanced[m.key]}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    advanced: {
                      ...draft.advanced,
                      [m.key]: Math.max(0, Math.min(100, Number(e.target.value) || 0)),
                    },
                  })
                }
              />
            </div>
          ))}
          {!advancedOk && <p className="plan-warn">权重合计必须等于 100%</p>}
        </section>
      )}

      {msg && <p className="plan-msg" role="status">{msg}</p>}

      <div className="plan-settings-save">
        <button className="secondary-button" onClick={() => save(false)} disabled={!advancedOk}>
          仅修改今天
        </button>
        <button className="primary-button" onClick={() => save(true)} disabled={!advancedOk}>
          保存并调整后续计划
        </button>
      </div>
    </main>
  );
}
