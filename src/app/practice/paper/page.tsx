"use client";

/**
 * V13 Production: 模拟卷列表页。
 * 路径：/practice/paper
 * 展示所有 status=active/published 的原创模拟卷。
 */

import { registerBuiltinPacks } from "@/content/packs";
import { getPublishableItems } from "@/content/registry";
import type { CET6Paper } from "@/content/papers";
import { FileText, Clock, Award } from "lucide-react";
import Link from "next/link";

export default function PaperListPage() {
  // registerBuiltinPacks 是幂等的，确保 paper pack 已注册（SSR/CSR 均安全）
  registerBuiltinPacks();
  const papers = getPublishableItems<CET6Paper>("paper");

  return (
    <main style={{ maxWidth: 640, margin: "0 auto", padding: "16px 16px 100px" }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "#1b5e20", margin: "0 0 4px" }}>
          模拟卷
        </h1>
        <p style={{ fontSize: 13, color: "#666", margin: 0 }}>
          原创高仿真 CET-6 模拟卷，完整 57 题/任务，含 AI 合成语音听力。
        </p>
      </div>

      {papers.length === 0 ? (
        <div style={{ padding: 40, textAlign: "center", color: "#999" }}>
          暂无可用模拟卷。
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {papers.map((paper) => (
            <Link
              key={paper.paperId}
              href={`/practice/paper/${encodeURIComponent(paper.paperId)}`}
              style={{
                display: "block",
                background: "#fff",
                border: "1px solid #c8e6c9",
                borderRadius: 12,
                padding: 16,
                textDecoration: "none",
                color: "inherit",
                boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 10,
                  background: "#e8f5e9", display: "flex",
                  alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                }}>
                  <FileText size={22} color="#2e7d32" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 16, fontWeight: 600, color: "#1b5e20", marginBottom: 4 }}>
                    {paper.title || paper.paperId}
                  </div>
                  <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 12, color: "#666" }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <Clock size={13} /> 约 130 分钟
                    </span>
                    <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <Award size={13} /> 原创模拟卷
                    </span>
                  </div>
                  {paper.tags && paper.tags.length > 0 && (
                    <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {paper.tags.map((tag: string) => (
                        <span key={tag} style={{
                          fontSize: 11, background: "#f1f8e9", color: "#558b2f",
                          padding: "2px 8px", borderRadius: 4,
                        }}>
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div style={{ marginTop: 12, textAlign: "right" }}>
                <span style={{
                  fontSize: 14, fontWeight: 600, color: "#2e7d32",
                }}>
                  开始答题 →
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}

      <div style={{ marginTop: 24, padding: 12, background: "#fff8e1", borderRadius: 8, fontSize: 12, color: "#795548" }}>
        说明：本模拟卷由 CET-6 Daily 项目原创编写，非官方真题。听力音频为 AI 合成语音，仅供学习练习使用。
      </div>
    </main>
  );
}
