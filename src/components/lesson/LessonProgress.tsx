import { X } from "lucide-react";
export function LessonProgress({
  progress,
  onExit,
  label,
}: {
  progress: number;
  onExit: () => void;
  label?: string;
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
      {label !== undefined && <span className="exercise-header-label">{label}</span>}
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
