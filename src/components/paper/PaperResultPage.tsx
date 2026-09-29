"use client";

/**
 * V13 Phase 2E: Paper result page.
 *
 * 完成后结果页：
 * - 完成状态、客观题正确率、各 section 正确率
 * - Writing/Translation 状态
 * - 错题数量、需要加强数量
 * - 完成时间、总时长
 * - 不展示虚假官方 CET6 710 分
 * - 可查看每道题解析（用户答案/正确答案/解析）
 * - 明确标注"练习估分 / 非官方成绩"
 */

import { useMemo, useState } from "react";
import { usePaper } from "./PaperProvider";
import { flattenPaperQuestions } from "@/lib/paper/content";

const SECTION_NAMES: Record<string, string> = {
  writing: "写作",
  listening: "听力",
  reading: "阅读",
  translation: "翻译",
};

export function PaperResultPage() {
  const { paper, session, questionIdToCorrect } = usePaper();
  const [expandedQuestionId, setExpandedQuestionId] = useState<string | null>(null);

  const flattened = useMemo(() => flattenPaperQuestions(paper), [paper]);
  const result = session?.result;

  if (!session || !result) {
    return <div style={{ padding: 24 }}>加载中…</div>;
  }

  const wrongQuestions = flattened.filter((fq) => {
    const correctId = questionIdToCorrect[fq.question.questionId];
    if (!correctId) return false;
    const answer = session.answers[fq.question.questionId];
    return answer?.selectedOptionId && answer.selectedOptionId !== correctId;
  });

  const formatDuration = (sec: number): string => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}分${s}秒`;
  };

  const toggleExpand = (qid: string) => {
    setExpandedQuestionId(expandedQuestionId === qid ? null : qid);
  };

  return (
    <div style={{ maxWidth: 560, margin: "0 auto", padding: "24px 16px 60px" }}>
      {/* 完成标识 */}
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <div style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 64,
          height: 64,
          borderRadius: "50%",
          background: "#e8f5e9",
          marginBottom: 12,
        }}>
          <span style={{ fontSize: 32 }}>✓</span>
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "#1a3a2a", marginBottom: 4 }}>
          模拟考试完成
        </h1>
        <p style={{ fontSize: 14, color: "#5a7a6a" }}>{paper.title}</p>
      </div>

      {/* 免责声明 */}
      <div style={{
        background: "#fff3e0",
        border: "1px solid #ffb74d",
        borderRadius: 8,
        padding: 12,
        marginBottom: 16,
      }}>
        <p style={{ fontSize: 12, color: "#e65100", margin: 0, lineHeight: 1.5 }}>
          {result.scoreDisclaimer}
        </p>
      </div>

      {/* 总体正确率 */}
      <div style={{
        background: "#fff",
        borderRadius: 12,
        padding: 20,
        marginBottom: 16,
        textAlign: "center",
        boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
      }}>
        <div style={{ fontSize: 48, fontWeight: 700, color: "#2e7d32" }}>
          {result.overallAccuracy}%
        </div>
        <div style={{ fontSize: 14, color: "#666", marginTop: 4 }}>
          客观题正确率（{result.answeredQuestions}/{result.totalQuestions} 题）
        </div>
      </div>

      {/* 各 section 表现 */}
      <div style={{
        background: "#fff",
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
      }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12, color: "#1a3a2a" }}>各部分表现</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 14, color: "#333" }}>听力</span>
            <span style={{ fontSize: 14, fontWeight: 600, color: result.listeningAccuracy >= 60 ? "#2e7d32" : "#e65100" }}>
              {result.listeningAccuracy}%
            </span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 14, color: "#333" }}>阅读</span>
            <span style={{ fontSize: 14, fontWeight: 600, color: result.readingAccuracy >= 60 ? "#2e7d32" : "#e65100" }}>
              {result.readingAccuracy}%
            </span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 14, color: "#333" }}>写作</span>
            <span style={{ fontSize: 14, fontWeight: 600, color: result.writingStatus === "submitted" ? "#2e7d32" : "#999" }}>
              {result.writingStatus === "submitted" ? "已提交" : "未提交"}
            </span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 14, color: "#333" }}>翻译</span>
            <span style={{ fontSize: 14, fontWeight: 600, color: result.translationStatus === "submitted" ? "#2e7d32" : "#999" }}>
              {result.translationStatus === "submitted" ? "已提交" : "未提交"}
            </span>
          </div>
        </div>
      </div>

      {/* 统计信息 */}
      <div style={{
        background: "#fff",
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
          <span style={{ fontSize: 14, color: "#555" }}>错题数量</span>
          <span style={{ fontSize: 14, fontWeight: 600, color: "#c62828" }}>{result.wrongCount} 题</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
          <span style={{ fontSize: 14, color: "#555" }}>需要加强</span>
          <span style={{ fontSize: 14, fontWeight: 600, color: "#e65100" }}>{result.needsReviewCount} 题</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
          <span style={{ fontSize: 14, color: "#555" }}>总用时</span>
          <span style={{ fontSize: 14, fontWeight: 500, color: "#333" }}>{formatDuration(result.durationSec)}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ fontSize: 14, color: "#555" }}>完成时间</span>
          <span style={{ fontSize: 14, fontWeight: 500, color: "#333" }}>
            {new Date(result.completedAt).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}
          </span>
        </div>
      </div>

      {/* 错题列表 + 解析 */}
      {wrongQuestions.length > 0 && (
        <div style={{
          background: "#fff",
          borderRadius: 12,
          padding: 16,
          marginBottom: 16,
          boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
        }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12, color: "#c62828" }}>
            错题解析（{wrongQuestions.length} 题）
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {wrongQuestions.map((fq, idx) => (
              <div key={fq.question.questionId} style={{ border: "1px solid #f0e0e0", borderRadius: 8, overflow: "hidden" }}>
                <button
                  onClick={() => toggleExpand(fq.question.questionId)}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    background: "#fff5f5",
                    border: "none",
                    textAlign: "left",
                    fontSize: 13,
                    color: "#333",
                    cursor: "pointer",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {idx + 1}. [{SECTION_NAMES[fq.sectionType] ?? fq.sectionType}] {fq.question.prompt.slice(0, 40)}…
                  </span>
                  <span style={{ fontSize: 12, color: "#999", marginLeft: 8 }}>
                    {expandedQuestionId === fq.question.questionId ? "收起" : "展开"}
                  </span>
                </button>
                {expandedQuestionId === fq.question.questionId && (
                  <div style={{ padding: 12, borderTop: "1px solid #f0e0e0" }}>
                    <div style={{ fontSize: 13, color: "#333", marginBottom: 8, lineHeight: 1.6 }}>
                      <strong>题目：</strong>{fq.question.prompt}
                    </div>
                    <div style={{ fontSize: 13, marginBottom: 4 }}>
                      <span style={{ color: "#c62828" }}>你的答案：{session.answers[fq.question.questionId]?.selectedOptionId ?? "未作答"}</span>
                    </div>
                    <div style={{ fontSize: 13, marginBottom: 8 }}>
                      <span style={{ color: "#2e7d32" }}>正确答案：{questionIdToCorrect[fq.question.questionId]}</span>
                    </div>
                    {fq.question.shortExplanation && (
                      <div style={{ fontSize: 12, color: "#666", lineHeight: 1.6, background: "#f9f9f9", padding: 8, borderRadius: 4 }}>
                        <strong>解析：</strong>{fq.question.shortExplanation}
                      </div>
                    )}
                    {fq.question.detailedExplanation && (
                      <div style={{ fontSize: 12, color: "#666", lineHeight: 1.6, marginTop: 6 }}>
                        {fq.question.detailedExplanation}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 全部题目解析入口 */}
      <div style={{
        background: "#fff",
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
      }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 8, color: "#1a3a2a" }}>全部题目解析</h2>
        <p style={{ fontSize: 13, color: "#666", marginBottom: 12 }}>
          共 {flattened.length} 题，可逐题查看用户答案、正确答案和解析。
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 300, overflowY: "auto" }}>
          {flattened.map((fq, idx) => {
            const answer = session.answers[fq.question.questionId];
            const correctId = questionIdToCorrect[fq.question.questionId];
            const isCorrect = correctId && answer?.selectedOptionId === correctId;
            const isWrong = correctId && answer?.selectedOptionId && answer.selectedOptionId !== correctId;
            return (
              <button
                key={fq.question.questionId}
                onClick={() => toggleExpand(`all-${fq.question.questionId}`)}
                style={{
                  padding: "8px 10px",
                  border: "1px solid #e8ece8",
                  borderRadius: 6,
                  background: isWrong ? "#fff5f5" : isCorrect ? "#f1f8f1" : "#fafafa",
                  textAlign: "left",
                  fontSize: 12,
                  color: "#333",
                  cursor: "pointer",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {idx + 1}. [{SECTION_NAMES[fq.sectionType] ?? fq.sectionType}] {fq.question.prompt.slice(0, 30)}…
                </span>
                <span style={{ fontSize: 11, marginLeft: 8, color: isWrong ? "#c62828" : isCorrect ? "#2e7d32" : "#999" }}>
                  {isWrong ? "错" : isCorrect ? "对" : correctId ? "未答" : "主观"}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 返回按钮 */}
      <button
        onClick={() => window.location.reload()}
        style={{
          width: "100%",
          padding: "12px",
          background: "#2e7d32",
          color: "#fff",
          border: "none",
          borderRadius: 10,
          fontSize: 15,
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        返回开始页
      </button>
    </div>
  );
}
