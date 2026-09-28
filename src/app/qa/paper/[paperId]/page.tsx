"use client";

/**
 * V13 Phase 2E: Staging QA route for Paper 001.
 *
 * 路径：/qa/paper/[paperId]
 * 保护：仅 development 环境可用；production build 显示"QA route not available"。
 * 普通用户入口（首页/每日计划/普通练习列表）看不到 staging Paper。
 *
 * 这是显式 opt-in 的 QA 路径，不是 production 功能。
 */

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { getPaperById } from "@/content/registry";
import { registerBuiltinPacks } from "@/content/packs";
import { registerMockPaper001 } from "@/content/papers/cet6-mock-paper-001";
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

function resolvePaper(paperId: string): { paper: CET6Paper | null; error: string | null } {
  if (process.env.NODE_ENV !== "development") {
    return { paper: null, error: "QA route 仅在开发环境可用。" };
  }
  try {
    registerBuiltinPacks();
    registerMockPaper001();
  } catch {
    // 可能已注册
  }
  const found = getPaperById<CET6Paper>(paperId);
  if (!found) {
    return { paper: null, error: `Paper 未找到: ${paperId}` };
  }
  if (found.status !== "staging" && found.status !== "draft" && found.status !== "raw") {
    return { paper: null, error: `此 QA route 仅用于 staging/draft 内容。当前 Paper status=${found.status}。` };
  }
  return { paper: found, error: null };
}

export default function QaPaperPage() {
  const params = useParams();
  const rawPaperId = Array.isArray(params?.paperId) ? params.paperId[0] : params?.paperId ?? "";
  const paperId = decodeURIComponent(rawPaperId);

  const { paper, error } = useMemo(() => resolvePaper(paperId), [paperId]);

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
        <h1 style={{ fontSize: 18, marginBottom: 12 }}>QA Route</h1>
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
      onIssue={(msg) => console.warn("[Paper QA]", msg)}
    >
      <div style={{ minHeight: "100vh", background: "#f6f8f5" }}>
        <PaperRouter />
      </div>
    </PaperProvider>
  );
}
