import { Suspense } from "react";
import { ExamRecordReview } from "@/components/exams/ExamRecordReview";

export default function Page() {
  return (
    <Suspense fallback={<main className="exam-page">正在加载记录…</main>}>
      <ExamRecordReview />
    </Suspense>
  );
}
