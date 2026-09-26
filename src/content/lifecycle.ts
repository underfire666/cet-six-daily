/**
 * V13: Content Lifecycle
 *
 * 完整管线：raw → normalized → validated → reviewed → publishable → published；
 * deprecated 保留历史。Raw Source 不能自动等于 Published Content。
 * Human Review 本轮只实现状态/接口/工具支持，不做后台 UI。
 */
import type { ContentLifecycle } from "./types";

export const LIFECYCLE_ORDER: ContentLifecycle[] = [
  "raw",
  "normalized",
  "validated",
  "reviewed",
  "publishable",
  "published",
  "deprecated",
];

export const LIFECYCLE_STAGES: readonly ContentLifecycle[] = [
  "raw",
  "normalized",
  "validated",
  "reviewed",
  "publishable",
  "published",
];

/** 状态机合法迁移：只允许前进一步（或进入 deprecated）。 */
export function canTransition(from: ContentLifecycle, to: ContentLifecycle): boolean {
  if (to === "deprecated") return from !== "deprecated";
  const a = LIFECYCLE_ORDER.indexOf(from);
  const b = LIFECYCLE_ORDER.indexOf(to);
  if (a < 0 || b < 0) return false;
  return b === a + 1;
}

/** 从当前状态推进到下一阶段（校验合法）。非法返回 null。 */
export function advanceLifecycle(from: ContentLifecycle): ContentLifecycle | null {
  const a = LIFECYCLE_ORDER.indexOf(from);
  if (a < 0 || a + 1 >= LIFECYCLE_ORDER.length) return null;
  return LIFECYCLE_ORDER[a + 1];
}

/** V10 status → V13 lifecycle 兼容映射。 */
export function lifecycleFromStatus(status: string): ContentLifecycle {
  switch (status) {
    case "raw": return "raw";
    case "normalized": return "normalized";
    case "validated": return "validated";
    case "reviewed": return "reviewed";
    case "publishable": return "publishable";
    case "published": return "published";
    case "active": return "published";
    case "draft": return "raw";
    case "staging": return "reviewed"; // staging = 待发布审查态，不可对外可见
    case "deprecated": return "deprecated";
    default: return "raw";
  }
}

/** V13 lifecycle → 学习页可见性（published 才对外可见）。 */
export function isLearningVisible(lifecycle: ContentLifecycle): boolean {
  return lifecycle === "published";
}
