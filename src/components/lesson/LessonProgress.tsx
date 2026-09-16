import { X } from "lucide-react";
export function LessonProgress({
  progress,
  onExit,
}: {
  progress: number;
  onExit: () => void;
}) {
  return (
    <header className="exercise-header">
      <button
        className="exercise-icon-button"
        aria-label="退出关卡"
        onClick={onExit}
      >
        <X size={22} />
      </button>
      <div
        className="exercise-progress"
        role="progressbar"
        aria-label="整体学习进度"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress}
      >
        <span style={{ width: `${progress}%` }} />
      </div>
    </header>
  );
}
