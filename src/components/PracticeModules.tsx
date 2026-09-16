import Link from "next/link";
import {
  ArrowUpRight,
  BookOpen,
  Headphones,
  Languages,
  NotebookPen,
  SpellCheck,
} from "lucide-react";
import { modules } from "@/data/mock";
const icons = [SpellCheck, Headphones, BookOpen, Languages, NotebookPen];
export function PracticeModules() {
  return (
    <section className="practice-section">
      <div className="section-heading">
        <h2>想多练一点？</h2>
        <span>专项练习 · 按需加餐</span>
      </div>
      <div className="practice-grid">
        {modules.map((module, index) => {
          const Icon = icons[index];
          return (
            <Link
              className={`practice-link practice-${index}`}
              key={module.key}
              href={`/practice/${module.key}`}
            >
              <span className="practice-icon">
                <Icon size={25} strokeWidth={1.9} />
              </span>
              <div>
                <strong>{module.name}</strong>
                <span className="practice-english">{module.english}</span>
              </div>
              <ArrowUpRight size={15} className="practice-arrow" />
            </Link>
          );
        })}
      </div>
    </section>
  );
}
