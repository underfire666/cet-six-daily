import { Suspense } from "react";
import { ExamBrowser } from "@/components/exams/ExamBrowser";

export default function Page() {
  return <Suspense fallback={<main className="exam-page">正在准备真题题库…</main>}><ExamBrowser /></Suspense>;
}
