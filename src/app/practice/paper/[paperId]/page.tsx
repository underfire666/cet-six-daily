"use client";

/**
 * V13 Production: 模拟卷正式入口。
 *
 * 路径：/practice/paper/[paperId]
 * 保护：仅允许 status=active/published 的 Paper（production 内容）。
 * 与 /qa/paper/[paperId] 的区别：
 *   - QA route 仅开发环境 + 仅 staging/draft/raw
 *   - 本 route 生产环境可用 + 仅 active/published
 *   - 本 route 使用正式 registry（registerBuiltinPacks），不动态导入 QA packs
 */

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { registerBuiltinPacks } from "@/content/packs";
import { getPaperById } from "@/content/registry";
import type { CET6Paper } from "@/content/papers";
import { PaperProvider } from "@/components/paper/PaperProvider";
import { PaperStartPage } from "@/components/paper/PaperStartPage";
import { PaperExamFlow } from "@/components/paper/PaperExamFlow";
import { PaperResultPage } from "@/components/paper/PaperResultPage";
import { usePaper } from "@/components/paper/PaperProvider";

function PaperRouter() {
  const { session, loading } = usePaper();

  if (loading) {
    return (
      <div style={{ padding: 24, textAlign: "center" }}>
        <p>加载中…</p>
      </div>
    );
  }

  if (!session) {
    return <PaperStartPage />;
  }

  if (session.phase === "completed" && session.result) {
    return <PaperResultPage />;
  }

  return <PaperExamFlow />;
}

export default function PracticePaperPage() {
  const params = useParams();
  const rawPaperId = Array.isArray(params?.paperId) ? params.paperId[0] : params?.paperId ?? "";
  const paperId = decodeURIComponent(rawPaperId);

  // registerBuiltinPacks 幂等，确保 paper pack 已注册（SSR/CSR 均安全）
  registerBuiltinPacks();

  const { paper, error } = useMemo(() => {
    const found = getPaperById<CET6Paper>(paperId);
    if (!found) {
      return { paper: null, error: `模拟卷未找到: ${paperId}` };
    }
    if (found.status !== "active" && found.status !== "published") {
      return { paper: null, error: `此模拟卷尚未发布（当前 status=${found.status}）。` };
    }
    return { paper: found, error: null };
  }, [paperId]);

  // ownerNamespace：从 V12 sync 全局变量读取（client-only）
  const [ownerNamespace] = useState<string>(() => {
    if (typeof window === "undefined") return "guest";
    try {
      const uid = (window as unknown as { __CET_SYNC_USER_ID?: string }).__CET_SYNC_USER_ID;
      return uid ?? "guest";
    } catch {
      return "guest";
    }
  });

  if (error) {
    return (
      <div style={{ padding: 24, maxWidth: 600, margin: "0 auto" }}>
        <h1 style={{ fontSize: 18, marginBottom: 12 }}>模拟卷</h1>
        <p style={{ color: "#c00" }}>{error}</p>
      </div>
    );
  }

  if (!paper) {
    return (
      <div style={{ padding: 24, textAlign: "center" }}>
        <p>加载中…</p>
      </div>
    );
  }

  return (
    <PaperProvider
      paper={paper}
      ownerNamespace={ownerNamespace}
      isLoggedIn={ownerNamespace !== "guest"}
      onIssue={(msg) => console.warn("[Paper Practice]", msg)}
    >
      <div style={{ minHeight: "100vh", background: "#f6f8f5" }}>
        <PaperRouter />
      </div>
    </PaperProvider>
  );
}
