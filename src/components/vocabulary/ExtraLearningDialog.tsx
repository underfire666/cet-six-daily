"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { LessonDialog } from "../lesson/LessonDialog";
import { useVocabulary } from "./VocabularyProvider";

export function ExtraLearningDialog({ onClose }: { onClose: () => void }) {
  const { start } = useVocabulary();
  const router = useRouter();
  const [custom, setCustom] = useState("");
  const [error, setError] = useState("");
  const begin = (quantity: number) => {
    if (!Number.isSafeInteger(quantity) || quantity < 1) {
      setError("请输入有效的正整数。");
      return;
    }
    const id = start("extra", undefined, quantity);
    if (!id) {
      setError("请先完成今日任务，再开始额外学习。");
      return;
    }
    onClose();
    router.push(`/practice/vocabulary/session/${id}`);
  };
  return (
    <LessonDialog title="再学多少个？" onClose={onClose}>
      <p className="exercise-subtle">选择本次额外学习数量，学习过程中可随时退出，下次接着学。</p>
      <div className="extra-quantities">
        <button className="exercise-button" onClick={() => begin(10)}>
          再学 10 个
        </button>
        <button
          className="exercise-button vocabulary-secondary-button"
          onClick={() => begin(20)}
        >
          再学 20 个
        </button>
      </div>
      <form
        className="extra-custom"
        onSubmit={(e) => {
          e.preventDefault();
          begin(Number(custom));
        }}
      >
        <label htmlFor="extra-count">自定义数量</label>
        <input
          id="extra-count"
          type="number"
          min="1"
          step="1"
          inputMode="numeric"
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          placeholder="输入个数"
          required
        />
        <button
          className="exercise-button vocabulary-secondary-button"
          type="submit"
        >
          开始额外学习
        </button>
      </form>
      {error && <p role="alert">{error}</p>}
      <p className="exercise-subtle">
        示例词库有限，新词不足时包含已学词巩固。重复学习计入练习量，同词同日不重复奖励
        XP。
      </p>
    </LessonDialog>
  );
}
