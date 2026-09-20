import type { SubjectiveFeedback } from "@/types/subjective";
import type { TranslationTask } from "@/types/translation";

const MAX_SCORE = 15;

/**
 * Mock 翻译批改：基于关键词覆盖 + 长度 + 简单结构规则。
 * 仅用于产品流程演练，provider 固定 "mock"。
 */
export function scoreTranslation(
  task: TranslationTask,
  submittedText: string,
  createdAt: string,
): SubjectiveFeedback {
  const text = submittedText.trim();
  const lower = text.toLowerCase();
  const keywords = task.keywords.map((k) => k.toLowerCase());
  const covered = keywords.filter((k) => lower.includes(k));
  const coverageRatio = keywords.length
    ? covered.length / keywords.length
    : 0;

  // 长度：paragraph 任务期望更长
  const expectedLen = task.level === "paragraph" ? 80 : 20;
  const lengthScore =
    text.length >= expectedLen ? 3 : text.length >= expectedLen * 0.5 ? 1 : 0;

  const keywordScore = Math.round(coverageRatio * 9); // 0–9
  const base = 3; // 写了东西就给
  const score = Math.min(
    MAX_SCORE,
    base + keywordScore + lengthScore,
  );

  const missing = keywords.filter((k) => !covered.includes(k));
  const issues: SubjectiveFeedback["issues"] = [];
  if (coverageRatio < 0.6 && missing.length) {
    issues.push({
      type: "coverage",
      title: "信息覆盖",
      description: `建议补全以下关键表达：${missing
        .slice(0, 3)
        .join(" / ")}。`,
      severity: coverageRatio < 0.3 ? "major" : "minor",
    });
  }
  if (lengthScore === 0) {
    issues.push({
      type: "structure",
      title: "篇幅",
      description: "译文偏短，可能漏掉了原文的部分信息。",
      severity: "minor",
    });
  }
  // 合并 task 预置反馈（最多展示 3 条）
  for (const issue of task.mockFeedback.issues.slice(0, 3 - issues.length)) {
    issues.push({ ...issue });
  }

  const details =
    text.length > 0
      ? [
          {
            excerpt: task.promptChinese.slice(0, 40),
            userExpression: text.slice(0, 120),
            referenceExpression: task.referenceTranslation.slice(0, 160),
            note: task.mockFeedback.summary,
          },
          ...task.mockFeedback.details,
        ]
      : task.mockFeedback.details;

  return {
    score,
    maxScore: MAX_SCORE,
    summary:
      coverageRatio >= 0.8
        ? "关键词覆盖完整，表达自然，整体不错。"
        : coverageRatio >= 0.5
          ? task.mockFeedback.summary
          : "主要意思已写出，但关键表达遗漏较多，建议对照参考译文再润色。",
    issues: issues.slice(0, 3),
    details,
    provider: "mock",
    createdAt,
  };
}
