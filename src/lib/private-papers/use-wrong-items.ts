"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { getSyncIdentityGeneration } from "@/lib/sync/adapters";
import { parsePrivateWrongItems, type PrivateWrongItemsResponse } from "./wrong-items";

export function usePrivateWrongItems(paperId: string) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const ownerId = session?.user?.id;
  const scope = JSON.stringify([status, ownerId, paperId, getSyncIdentityGeneration()]);
  const [state, setState] = useState<{ scope: string; data?: PrivateWrongItemsResponse; error?: string; loading: boolean }>();
  const request = useRef<{ id: number; controller?: AbortController }>({ id: 0 });
  const refresh = useCallback(async () => {
    if (status !== "authenticated" || !ownerId) return;
    request.current.controller?.abort();
    const controller = new AbortController(), id = ++request.current.id;
    request.current.controller = controller;
    const generation = getSyncIdentityGeneration();
    const current = () => !controller.signal.aborted && request.current.id === id && getSyncIdentityGeneration() === generation;
    await Promise.resolve();
    if (!current()) return;
    setState({ scope, loading: true });
    try {
      const res = await fetch(`/api/private-papers/${encodeURIComponent(paperId)}/wrong-items`, { cache: "no-store", signal: controller.signal });
      if (!res.ok) throw new Error(res.status === 404 ? "该私有卷不存在或你没有访问权限" : res.status === 401 ? "登录状态已失效，请重新登录" : "错题加载失败，请重试");
      const data = parsePrivateWrongItems(await res.json(), ownerId, paperId);
      if (current()) setState({ scope, data, loading: false });
    } catch (error) {
      if (current()) setState({ scope, error: error instanceof Error ? error.message : "错题加载失败，请重试", loading: false });
    }
  }, [scope, status, ownerId, paperId]);
  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login?callbackUrl=/me/private-papers");
    const requests = request.current;
    const timer = window.setTimeout(() => { void refresh(); }, 0);
    const focus = () => { void refresh(); };
    const visible = () => { if (document.visibilityState === "visible") void refresh(); };
    window.addEventListener("focus", focus);
    document.addEventListener("visibilitychange", visible);
    return () => { clearTimeout(timer); requests.controller?.abort(); requests.id++; window.removeEventListener("focus", focus); document.removeEventListener("visibilitychange", visible); };
  }, [refresh, status, router]);
  const currentState = state?.scope === scope ? state : undefined;
  return { status, ownerId, scope, data: currentState?.data, error: currentState?.error, loading: status !== "authenticated" || !currentState || currentState.loading, refresh };
}
