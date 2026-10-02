"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { getSyncIdentityGeneration } from "@/lib/sync/adapters";
import { parsePrivateWrongManagement, type PrivateWrongItemView } from "./wrong-items";

/** Management requests share an identity/page scope and synchronous in-flight lock. */
export function usePrivateWrongManagement(scope: string, ownerId: string | undefined, refresh: () => Promise<void>) {
  const [state, setState] = useState<{ scope: string; busy: string | null; error: string | null }>();
  const activeScope = useRef<string | null>(null);
  const request = useRef<{ id: number; controller?: AbortController; pending: boolean }>({ id: 0, pending: false });
  useEffect(() => {
    activeScope.current = scope;
    const requests = request.current;
    return () => { activeScope.current = null; requests.controller?.abort(); requests.id++; requests.pending = false; };
  }, [scope]);
  const cancel = useCallback(() => {
    request.current.controller?.abort(); request.current.id++; request.current.pending = false;
    if (activeScope.current === scope) setState({ scope, busy: null, error: null });
  }, [scope]);
  const clearError = useCallback(() => { if (activeScope.current === scope) setState(previous => previous?.scope === scope ? { ...previous, error: null } : previous); }, [scope]);
  const run = useCallback(async (item: PrivateWrongItemView, action: "remove" | "restore"): Promise<boolean> => {
    if (!ownerId || activeScope.current !== scope || request.current.pending) return false;
    request.current.pending = true;
    const controller = new AbortController(), id = ++request.current.id, generation = getSyncIdentityGeneration();
    request.current.controller = controller;
    const current = () => activeScope.current === scope && request.current.id === id && !controller.signal.aborted && getSyncIdentityGeneration() === generation;
    setState({ scope, busy: item.id, error: null });
    try {
      const res = await fetch(`/api/private-papers/${encodeURIComponent(item.paperId)}/wrong-items/${encodeURIComponent(item.questionId)}/${action}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contentHash: item.contentHash, revision: item.revision }), cache: "no-store", signal: controller.signal });
      if (!current()) return false;
      if (!res.ok) {
        if ([401, 404, 409, 422].includes(res.status)) {
          await refresh();
          if (!current()) return false;
          throw new Error(res.status === 401 ? "登录状态已失效，请重新登录" : res.status === 404 ? "试卷或错题已不存在，或你没有访问权限" : res.status === 409 ? "该错题已被其他操作修改，已重新检查，请按最新状态重试" : "内容版本或请求已失效，请按最新状态重试");
        }
        throw new Error("操作失败，尚未确认，请重试或刷新检查最新状态");
      }
      parsePrivateWrongManagement(await res.json(), ownerId, item, action === "remove");
      if (!current()) return false;
      await refresh();
      return current();
    } catch (e) {
      if (current()) setState({ scope, busy: null, error: e instanceof Error && /[\u4e00-\u9fff]/.test(e.message) ? e.message : "网络异常，操作尚未确认，请重试或刷新检查最新状态" });
      return false;
    } finally {
      if (current()) { request.current.pending = false; setState(previous => previous?.scope === scope ? { ...previous, busy: null } : previous); }
    }
  }, [scope, ownerId, refresh]);
  const visible = state?.scope === scope ? state : undefined;
  return { busy: visible?.busy ?? null, error: visible?.error ?? null, run, cancel, clearError };
}
