import { Suspense } from "react";
import { LearningHome } from "@/components/LearningHome";
export default function Page() {
  return (
    <Suspense fallback={<div className="loading">学习路线正在准备中…</div>}>
      <LearningHome />
    </Suspense>
  );
}
