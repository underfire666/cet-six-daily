import type { AnswerRecord } from "@/types/session";

/** Determine the final result label considering initial, retry, and retest phases. */
export function resultLabel(record: AnswerRecord): string {
  // Retest takes precedence as the latest phase.
  if (record.retest && record.retest.length > 0) {
    const lastRetest = record.retest[record.retest.length - 1];
    if (lastRetest.correct) return "复测答对";
    return "复测答错";
  }
  if (record.initialResult === "first_try_correct") return "首次答对";
  if (record.initialResult === "second_try_correct") return "重试答对";
  if (record.initialResult === "ai_hint_correct") return "提示后答对";
  if (record.initialResult === "wrong") return "答错";
  if (record.initialResult === "unmastered") return "未掌握";
  return "未完成";
}

/** Is the final answer correct (considering retest as latest). */
export function isFinalCorrect(record: AnswerRecord): boolean {
  if (record.retest && record.retest.length > 0) {
    return record.retest[record.retest.length - 1].correct;
  }
  if (record.initial && record.initial.length > 0) {
    return record.initial[record.initial.length - 1].correct;
  }
  return false;
}

/** Get the user's final selected option (latest across initial and retest). */
export function finalUserAnswer(record: AnswerRecord): string | null {
  if (record.retest && record.retest.length > 0) {
    return record.retest[record.retest.length - 1].optionId;
  }
  if (record.initial && record.initial.length > 0) {
    return record.initial[record.initial.length - 1].optionId;
  }
  return null;
}

/** Render attempt history as readable text. */
export function attemptHistory(record: AnswerRecord): string {
  const parts: string[] = [];
  if (record.initial && record.initial.length > 0) {
    const initialText = record.initial
      .map((a, i) => `${i === 0 ? "初答" : `重试${i}`}: ${a.optionId}${a.hinted ? "(提示)" : ""}${a.correct ? "✓" : "✗"}`)
      .join(" → ");
    parts.push(initialText);
  }
  if (record.retest && record.retest.length > 0) {
    const retestText = record.retest
      .map((a, i) => `复测${i + 1}: ${a.optionId}${a.correct ? "✓" : "✗"}`)
      .join(" → ");
    parts.push(retestText);
  }
  return parts.join(" | ");
}
