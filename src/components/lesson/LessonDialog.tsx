"use client";
import { useEffect, useRef } from "react";
import { X, Sparkles } from "lucide-react";
export function LessonDialog({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="exercise-dialog"
      aria-label={title}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="exercise-dialog-title">
        <h2>{title}</h2>
        <button
          className="exercise-icon-button"
          aria-label="关闭面板"
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function AiHint({
  hint,
  onClose,
}: {
  hint: string;
  onClose: () => void;
}) {
  return (
    <LessonDialog title="一起想一想" onClose={onClose}>
      <div className="exercise-hint-icon">
        <Sparkles size={25} />
      </div>
      <p className="exercise-hint-text">{hint}</p>
      <p className="exercise-subtle">先顺着这个思路试试看。</p>
      <button className="exercise-button" onClick={onClose}>
        继续答题
      </button>
    </LessonDialog>
  );
}
export function LessonExitDialog({
  onClose,
  onExit,
}: {
  onClose: () => void;
  onExit: () => void;
}) {
  return (
    <LessonDialog title="稍后继续？" onClose={onClose}>
      <p className="exercise-subtle">已记住你的位置，回来可以接着学。</p>
      <button className="exercise-button" onClick={onClose}>
        继续学习
      </button>
      <button className="exercise-text-button" onClick={onExit}>
        稍后继续
      </button>
    </LessonDialog>
  );
}
