import { Suspense } from "react";
import { ExamRecords } from "@/components/exams/ExamRecords";

export default function Page() {
  return (
    <Suspense fallback={<main className="exam-page">正在加载学习记录…</main>}>
      <ExamRecords />
    </Suspense>
  );
}
