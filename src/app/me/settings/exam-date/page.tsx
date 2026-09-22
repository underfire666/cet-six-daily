"use client";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useProfile } from "@/components/profile/ProfileProvider";

export default function ExamDatePage() {
  const router = useRouter();
  const { examDate, setExamDate, ready } = useProfile();
  if (!ready) return <main className="me-page"><p className="me-loading">加载中…</p></main>;

  return (
    <main className="me-page">
      <header className="me-header">
        <button className="exercise-icon-button" onClick={() => router.push("/me")}><ArrowLeft size={22} /></button>
        <h1>考试日期</h1>
      </header>
      <section className="me-section">
        <p className="me-note">修改后未来未完成的计划会按新日期重新生成；历史完成记录不变。</p>
        <label className="me-label">
          选择日期
          <input
            type="date"
            value={examDate ?? ""}
            onChange={(e) => {
              if (e.target.value) { setExamDate(e.target.value); router.push("/me"); }
            }}
          />
        </label>
      </section>
    </main>
  );
}
