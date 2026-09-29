"use client";
import Link from "next/link";
import {
  BookOpen,
  Headphones,
  Languages,
  NotebookPen,
  SpellCheck,
  FileText,
} from "lucide-react";
import { modules } from "@/data/mock";
import { useReading } from "./reading/ReadingProvider";
import { useListening } from "./listening/ListeningProvider";
import { useTranslation } from "./translation/TranslationProvider";
import { useWriting } from "./writing/WritingProvider";
const icons = [SpellCheck, Headphones, BookOpen, Languages, NotebookPen];
export function PracticeModules() {
  const reading = useReading();
  const listening = useListening();
  const translation = useTranslation();
  const writing = useWriting();
  const done = reading.progress.completedArticleIds.length;
  const total = reading.progress.articleIds.length;
  const lDone = listening.progress.completedMaterialIds.length;
  const lTotal = listening.progress.materialIds.length;
  const tDone = translation.progress.completedTaskIds.length;
  const tTotal = translation.progress.taskIds.length;
  const wDone = writing.progress.completedTaskIds.length;
  const wTotal = writing.progress.taskIds.length;
  return (
    <section className="practice-section">
      <div className="section-heading">
        <h2>专项练习</h2>
      </div>
      <div className="practice-grid">
        {modules.map((module, index) => {
          const Icon = icons[index];
          return (
            <Link
              className="practice-link"
              key={module.key}
              href={`/practice/${module.key}`}
            >
              <span className="practice-icon">
                <Icon size={24} strokeWidth={1.8} />
              </span>
              <div>
                <strong>{module.name}</strong>
                {module.key === "reading" && (
                  <span
                    className={`practice-module-status${reading.dailyComplete ? " is-done" : ""}`}
                  >
                    {reading.dailyComplete
                      ? `今日 ${total}/${total} ✓`
                      : `今日 ${done}/${total}`}
                  </span>
                )}
                {module.key === "listening" && (
                  <span
                    className={`practice-module-status${listening.dailyComplete ? " is-done" : ""}`}
                  >
                    {listening.dailyComplete
                      ? `今日 ${lTotal}/${lTotal} ✓`
                      : `今日 ${lDone}/${lTotal}`}
                  </span>
                )}
                {module.key === "translation" && (
                  <span
                    className={`practice-module-status${translation.dailyComplete ? " is-done" : ""}`}
                  >
                    {translation.dailyComplete
                      ? `今日 ${tTotal}/${tTotal} ✓`
                      : `今日 ${tDone}/${tTotal}`}
                  </span>
                )}
                {module.key === "writing" && (
                  <span
                    className={`practice-module-status${writing.dailyComplete ? " is-done" : ""}`}
                  >
                    {writing.dailyComplete
                      ? `今日 ${wTotal}/${wTotal} ✓`
                      : `今日 ${wDone}/${wTotal}`}
                  </span>
                )}
              </div>
            </Link>
          );
        })}
      </div>

      {/* V13 Production: 模拟卷入口 */}
      <div style={{ marginTop: 16 }}>
        <Link
          href="/practice/paper"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            background: "linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%)",
            border: "1px solid #a5d6a7",
            borderRadius: 12,
            padding: "14px 16px",
            textDecoration: "none",
            color: "inherit",
          }}
        >
          <span style={{
            width: 40, height: 40, borderRadius: 10,
            background: "#fff", display: "flex",
            alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}>
            <FileText size={22} color="#2e7d32" />
          </span>
          <div style={{ flex: 1 }}>
            <strong style={{ fontSize: 15, color: "#1b5e20" }}>模拟卷</strong>
            <div style={{ fontSize: 12, color: "#558b2f", marginTop: 2 }}>
              完整 57 题原创高仿真 CET-6 模拟卷 · 含 AI 合成语音听力
            </div>
          </div>
          <span style={{ fontSize: 18, color: "#2e7d32" }}>→</span>
        </Link>
      </div>
    </section>
  );
}
