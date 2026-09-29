/**
 * V13 Phase 2E: Paper XP settlement.
 *
 * Paper 完成 XP：
 * - 复用全局 XP ledger（StudyProfile.bonusXpEvents）
 * - deterministic event ID：`paper-complete:${paperId}:${sessionId}`
 * - 幂等：同一 session 只结算一次（session.xpSettled 标记）
 * - 重复提交 XP+0，不能刷分
 *
 * XP 数值：
 * - 基础 50 XP（完成整卷）
 * - 正确率奖励：最多 50 XP（正确率 ≥ 80% 给满）
 * - 总计最多 100 XP
 * - 明确标注为练习奖励，不与官方成绩挂钩
 *
 * 注意：Paper 是 QA-only staging 内容，XP 会计入用户统计。
 * 如果需要隔离 QA profile，应在测试时使用专门 QA 用户。
 */

import type { PaperSessionState, PaperResultSnapshot } from "@/types/paper";
import type { StudyProfile } from "@/types/session";

/** 生成 Paper 完成 XP 的 deterministic event ID。 */
export function paperCompleteXpEventId(paperId: string, sessionId: string): string {
  return `paper-complete:${paperId}:${sessionId}`;
}

/** 计算 Paper 完成 XP（基于正确率）。 */
export function calculatePaperXp(result: PaperResultSnapshot): number {
  const baseXp = 50;
  const accuracyBonus = Math.min(50, Math.round((result.overallAccuracy / 80) * 50));
  return baseXp + accuracyBonus;
}

/**
 * 结算 Paper XP 到 StudyProfile。
 * 幂等：event ID 已存在时不重复增加。
 * 返回新 profile 和实际增加的 XP。
 */
export function settlePaperXp(
  profile: StudyProfile,
  paperId: string,
  session: PaperSessionState,
  result: PaperResultSnapshot,
): { profile: StudyProfile; xpAdded: number; alreadySettled: boolean } {
  const eventId = paperCompleteXpEventId(paperId, session.sessionId);
  const existing = profile.bonusXpEvents?.[eventId];
  if (existing !== undefined) {
    return { profile, xpAdded: 0, alreadySettled: true };
  }
  const xp = calculatePaperXp(result);
  const newBonusXpEvents = {
    ...(profile.bonusXpEvents ?? {}),
    [eventId]: xp,
  };
  return {
    profile: { ...profile, bonusXpEvents: newBonusXpEvents },
    xpAdded: xp,
    alreadySettled: false,
  };
}

/**
 * 同步 Paper XP 到 V12 cloud（登录用户）。
 * 通过 enqueueMutation(entityType="xpEvent") 推送。
 */
export function enqueuePaperXpSync(
  paperId: string,
  sessionId: string,
  xp: number,
): void {
  if (typeof window === "undefined") return;
  const eventId = paperCompleteXpEventId(paperId, sessionId);
  import("@/lib/sync/client").then(({ enqueueMutation }) => {
    enqueueMutation({
      entityType: "xpEvent",
      entityId: eventId,
      operation: "upsert",
      payload: {
        eventId,
        source: "paper",
        sourceId: paperId,
        amount: xp,
        earnedAt: new Date().toISOString(),
      },
    });
  }).catch(() => {
    // sync queue 不可用时静默失败
  });
}

/** 检查 XP event 是否已结算（用于 UI 显示）。 */
export function isPaperXpSettled(profile: StudyProfile, paperId: string, sessionId: string): boolean {
  const eventId = paperCompleteXpEventId(paperId, sessionId);
  return profile.bonusXpEvents?.[eventId] !== undefined;
}
