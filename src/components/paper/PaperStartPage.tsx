"use client";

/**
 * V13 Phase 2E: Paper start page.
 *
 * 显示 Paper 名称、原创模拟卷标识、考试结构、总时长、AI 合成语音说明、staging/QA 标识。
 * 按钮：开始模拟考试。
 * 明确标注"原创高仿真模拟卷"，不让用户误认为官方真题。
 */

import { usePaper } from "./PaperProvider";
import { getPaperSectionStats, getPaperTotalQuestions } from "@/lib/paper/content";

const SECTION_NAMES: Record<string, string> = {
  writing: "写作",
  listening: "听力",
  reading: "阅读",
  translation: "翻译",
};

export function PaperStartPage() {
  const { paper, startOrResume, startNew, saveStatus } = usePaper();
  const sectionStats = getPaperSectionStats(paper);
  const totalQuestions = getPaperTotalQuestions(paper);

  return (
    <div style={{ maxWidth: 560, margin: "0 auto", padding: "24px 16px 100px" }}>
      {/* QA / Staging 标识 */}
      <div style={{
        display: "inline-block",
        background: "#fff3cd",
        color: "#856404",
        border: "1px solid #ffc107",
        borderRadius: 4,
        padding: "4px 10px",
        fontSize: 12,
        marginBottom: 12,
      }}>
        QA / Staging — 仅开发环境
      </div>

      {/* 标题 */}
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4, color: "#1a3a2a" }}>
        {paper.title}
      </h1>
      <p style={{ fontSize: 14, color: "#5a7a6a", marginBottom: 16 }}>
        原创高仿真模拟卷 · 非官方真题
      </p>

      {/* 考试结构卡片 */}
      <div style={{
        background: "#fff",
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
      }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12, color: "#1a3a2a" }}>
          考试结构
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {sectionStats.map((s, idx) => (
            <div key={s.type} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 14, color: "#333" }}>
                {idx + 1}. {SECTION_NAMES[s.type] ?? s.type}
              </span>
              <span style={{ fontSize: 14, color: "#5a7a6a", fontWeight: 500 }}>
                {s.count} 题
              </span>
            </div>
          ))}
          <div style={{ borderTop: "1px solid #e8ece8", marginTop: 4, paddingTop: 8, display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: "#1a3a2a" }}>总计</span>
            <span style={{ fontSize: 14, fontWeight: 600, color: "#1a3a2a" }}>{totalQuestions} 题</span>
          </div>
        </div>
      </div>

      {/* 考试信息 */}
      <div style={{
        background: "#fff",
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
          <span style={{ fontSize: 14, color: "#555" }}>总时长</span>
          <span style={{ fontSize: 14, fontWeight: 500, color: "#333" }}>130 分钟</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
          <span style={{ fontSize: 14, color: "#555" }}>考试顺序</span>
          <span style={{ fontSize: 14, fontWeight: 500, color: "#333" }}>写作 → 听力 → 阅读 → 翻译</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ fontSize: 14, color: "#555" }}>内容版本</span>
          <span style={{ fontSize: 14, fontWeight: 500, color: "#333" }}>{paper.contentVersion ?? "1.0.0"}</span>
        </div>
      </div>

      {/* AI 合成语音说明 */}
      <div style={{
        background: "#e8f5e9",
        border: "1px solid #a5d6a7",
        borderRadius: 8,
        padding: 12,
        marginBottom: 24,
      }}>
        <p style={{ fontSize: 13, color: "#2e7d32", margin: 0 }}>
          听力音频为 AI 合成语音，仅供学习练习使用。
        </p>
      </div>

      {/* 免责声明 */}
      <p style={{ fontSize: 12, color: "#999", marginBottom: 16, lineHeight: 1.5 }}>
        本模拟卷为原创高仿真练习材料，不是官方 CET6 真题。
        成绩仅供学习反馈参考，不代表官方 710 分制等值分。
      </p>

      {/* 开始按钮 */}
      <button
        onClick={startOrResume}
        style={{
          width: "100%",
          padding: "14px 24px",
          background: "#2e7d32",
          color: "#fff",
          border: "none",
          borderRadius: 10,
          fontSize: 16,
          fontWeight: 600,
          cursor: "pointer",
          marginBottom: 10,
        }}
      >
        开始模拟考试
      </button>

      <button
        onClick={startNew}
        style={{
          width: "100%",
          padding: "10px 24px",
          background: "transparent",
          color: "#5a7a6a",
          border: "1px solid #c8d8c8",
          borderRadius: 10,
          fontSize: 14,
          cursor: "pointer",
        }}
      >
        重新开始一套
      </button>

      {saveStatus === "failed" && (
        <p style={{ fontSize: 12, color: "#c00", marginTop: 12, textAlign: "center" }}>
          本地保存失败，进度可能丢失
        </p>
      )}
    </div>
  );
}
