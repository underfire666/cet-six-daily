import type { SubjectiveFeedback } from "@/types/subjective";
import type { WritingTask } from "@/types/writing";

const MAX_SCORE = 15;

export function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).filter(Boolean).length;
}

/**
 * Mock 写作批改：字数 + 段落数 + 连接词 + 关键词覆盖。
 */
export function scoreWriting(
  task: WritingTask,
  submittedText: string,
  createdAt: string,
): SubjectiveFeedback {
  const text = submittedText.trim();
  const words = countWords(text);
  const [min, max] = task.suggestedWordsRange;

  // 字数分（0–4）
  let wordScore = 0;
  if (words >= min && words <= max) wordScore = 4;
  else if (words >= min * 0.7 && words <= max * 1.3) wordScore = 3;
  else if (words >= min * 0.5) wordScore = 2;
  else if (words > 0) wordScore = 1;

  // 段落分（0–3）：>=3 段满分
  const paragraphs = text.split(/\n+/).filter((p) => p.trim()).length;
  const paraScore = paragraphs >= 3 ? 3 : paragraphs === 2 ? 2 : paragraphs === 1 ? 1 : 0;

  // 关键词分（0–4）
  const lower = text.toLowerCase();
  const suggested = task.suggestedWords.map((w) => w.toLowerCase());
  const covered = suggested.filter((w) => lower.includes(w));
  const keywordScore = Math.round((covered.length / Math.max(1, suggested.length)) * 4);

  // 连接词分（0–2）
  const connectors = [
    "first",
    "second",
    "finally",
    "however",
    "therefore",
    "in my opinion",
    "on the one hand",
    "on the other hand",
    "for example",
  ];
  const connectorHits = connectors.filter((c) => lower.includes(c)).length;
  const connectorScore = connectorHits >= 3 ? 2 : connectorHits >= 1 ? 1 : 0;

  const base = text.length ? 2 : 0;
  const score = Math.min(
    MAX_SCORE,
    base + wordScore + paraScore + keywordScore + connectorScore,
  );

  const issues: SubjectiveFeedback["issues"] = [];
  if (words < min) {
    issues.push({
      type: "coverage",
      title: "字数",
      description: `当前约 ${words} 词，建议 ${min}–${max} 词，可以再展开一两句。`,
      severity: "minor",
    });
  }
  if (paraScore < 2) {
    issues.push({
      type: "structure",
      title: "段落",
      description: "建议分 3 段：开头、主体、结尾，结构会更清楚。",
      severity: "minor",
    });
  }
  if (connectorScore === 0) {
    issues.push({
      type: "coherence",
      title: "衔接",
      description: "可以加入 First / However / In my opinion 等过渡词。",
      severity: "minor",
    });
  }
  for (const issue of task.mockFeedback.issues.slice(0, 3 - issues.length)) {
    issues.push({ ...issue });
  }

  const details =
    text.length > 0
      ? [
          {
            excerpt: task.prompt.slice(0, 80),
            userExpression: text.slice(0, 200),
            referenceExpression: task.referenceEssay.slice(0, 240),
            note: task.mockFeedback.summary,
          },
          ...task.mockFeedback.details,
        ]
      : task.mockFeedback.details;

  const ratio = score / MAX_SCORE;
  return {
    score,
    maxScore: MAX_SCORE,
    summary:
      ratio >= 0.8
        ? "结构完整，字数合适，表达流畅，继续保持。"
        : ratio >= 0.5
          ? task.mockFeedback.summary
          : "已完成写作，但结构和字数都有提升空间，建议对照参考范文修改。",
    issues: issues.slice(0, 3),
    details,
    provider: "mock",
    createdAt,
  };
}
