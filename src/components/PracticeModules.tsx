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
const icons = [SpellCheck, Headphones, BookOpen, Languages, NotebookPen];
export function PracticeModules() {
  const reading = useReading();
  const done = reading.progress.completedArticleIds.length;
  const total = reading.progress.articleIds.length;
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
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
