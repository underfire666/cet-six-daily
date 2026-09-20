"use client";
import Link from "next/link";
import {
  BookOpen,
  Headphones,
  Languages,
  NotebookPen,
  SpellCheck,
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
    </section>
  );
}
