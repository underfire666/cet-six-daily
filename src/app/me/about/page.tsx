"use client";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

export default function AboutPage() {
  const router = useRouter();
  return (
    <main className="me-page">
      <header className="me-header">
        <button className="exercise-icon-button" onClick={() => router.push("/me")}><ArrowLeft size={22} /></button>
        <h1>关于</h1>
      </header>
      <section className="me-section">
        <h3>CET-6 Daily</h3>
        <p>Version 0.11 / V11</p>
        <p className="me-note">六级日常：日历里的六级学习路线，每天一点，慢慢靠近目标。</p>
      </section>
    </main>
  );
}
