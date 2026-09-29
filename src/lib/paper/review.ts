/**
 * V13 Phase 2E: Paper → V9 Review integration.
 *
 * Paper 提交后，将客观题错题自动收录到 V9 Review 系统。
 *
 * 映射策略（复用现有 sourceModule，不扩展类型）：
 * - Paper Listening 错题 → sourceModule="listening", sourceActivityId=paperId
 * - Paper Reading 错题 → sourceModule="reading", sourceActivityId=paperId
 * - Writing/Translation 不进入传统客观错题本（遵守已有产品决定）
 *
 * 幂等：
 * - 同一 PaperSession 只结算一次 Review items（session.reviewSettled 标记）
 * - 同一 reviewItemId 已存在时不重复创建（dedupe）
 * - 重复提交 Paper 不重复创建 Review items
 *
 * Authorized replay：
 * - Review replay 时通过 paperId + questionId 从 Paper repository 解析 staging 内容
 * - 普通 production 用户不能因为 ReviewItem 绕过 rights/lifecycle 访问 staging Paper
 * - 只有已有 attempt 的用户才能 replay（通过 session ownership 验证）
 */

import type { CET6Paper } from "@/content/papers";
import type { PaperSessionState } from "@/types/paper";
import type { ReviewItem, ReviewStore } from "@/types/review";
import { loadReviewStore, saveReviewStore, isValidReviewItem } from "@/lib/review/store";
import { getWrongQuestionIds } from "@/lib/paper/session";
import { buildQuestionIdToCorrect, flattenPaperQuestions } from "@/lib/paper/content";
import { todayInShanghai } from "@/lib/dates";

/** 生成 Paper 错题的 ReviewItem id。 */
export function paperReviewItemId(sourceModule: "listening" | "reading", paperId: string, questionId: string): string {
  return `${sourceModule}:${paperId}:${questionId}`;
}

/** 从 PaperSession 创建错题 ReviewItems（不写入存储，返回新 items）。 */
export function createPaperReviewItems(
  paper: CET6Paper,
  session: PaperSessionState,
): ReviewItem[] {
  const questionIdToCorrect = buildQuestionIdToCorrect(paper);
  const flattened = flattenPaperQuestions(paper);
  const wrongIds = getWrongQuestionIds(session, questionIdToCorrect);
  const now = new Date().toISOString();
  const today = todayInShanghai();

  const items: ReviewItem[] = [];
  for (const qid of wrongIds) {
    const fq = flattened.find((f) => f.question.questionId === qid);
    if (!fq) continue;
    // 只收录 listening/reading 客观题
    if (fq.sectionType !== "listening" && fq.sectionType !== "reading") continue;
    const sourceModule = fq.sectionType as "listening" | "reading";
    const id = paperReviewItemId(sourceModule, paper.paperId, qid);
    const answer = session.answers[qid];

    const item: ReviewItem = {
      id,
      contentType: "question",
      sourceModule,
      sourceActivityId: paper.paperId,
      questionId: qid,
      createdAt: now,
      updatedAt: now,
      nextReviewAt: today,
      masteryStatus: "weak",
      reviewCount: 0,
      correctStreak: 0,
      wrongCount: 1,
      priority: 1,
      favorite: false,
      removed: false,
      lastWrongOptionId: answer?.selectedOptionId,
      version: 1,
      history: [],
      schemaVersion: 1,
    };
    if (isValidReviewItem(item)) {
      items.push(item);
    }
  }
  return items;
}

/**
 * 将 Paper 错题合并到 ReviewStore。
 * 已存在的 item 不覆盖（dedupe），只新增不存在的。
 * 返回新 store 和新增数量。
 */
export function mergePaperReviewItems(
  store: ReviewStore,
  items: ReviewItem[],
): { store: ReviewStore; addedCount: number } {
  let addedCount = 0;
  const newItems = { ...store.items };
  for (const item of items) {
    if (!newItems[item.id]) {
      newItems[item.id] = item;
      addedCount++;
    }
  }
  return { store: { ...store, items: newItems }, addedCount };
}

/**
 * 结算 Paper Review（写入 localStorage）。
 * 幂等：session.reviewSettled 已为 true 时直接返回。
 * 返回结算结果。
 */
export function settlePaperReview(
  paper: CET6Paper,
  session: PaperSessionState,
  storage?: Storage,
): { settled: boolean; addedCount: number; alreadySettled: boolean } {
  if (session.reviewSettled) {
    return { settled: false, addedCount: 0, alreadySettled: true };
  }
  const items = createPaperReviewItems(paper, session);
  if (items.length === 0) {
    return { settled: true, addedCount: 0, alreadySettled: false };
  }
  const { store } = loadReviewStore(storage);
  const { store: merged, addedCount } = mergePaperReviewItems(store, items);
  saveReviewStore(storage, merged);
  return { settled: true, addedCount, alreadySettled: false };
}

/**
 * 同步 Paper Review 到 V12 cloud（登录用户）。
 * 通过 enqueueMutation(entityType="reviewItem") 推送。
 */
export function enqueuePaperReviewSync(items: ReviewItem[]): void {
  if (typeof window === "undefined") return;
  import("@/lib/sync/client").then(({ enqueueMutation }) => {
    for (const item of items) {
      enqueueMutation({
        entityType: "reviewItem",
        entityId: item.id,
        operation: "upsert",
        payload: {
          reviewItemId: item.id,
          sourceModule: item.sourceModule,
          activityId: item.sourceActivityId,
          questionId: item.questionId,
          status: "active",
          mastery: item.masteryStatus === "weak" ? "learning" : item.masteryStatus,
          dueDate: item.nextReviewAt,
          priority: item.priority,
          payload: item as unknown as Record<string, unknown>,
          version: item.version ?? 1,
        },
      });
    }
  }).catch(() => {
    // sync queue 不可用时静默失败
  });
}

/**
 * 检查 ReviewItem 是否来自 Paper（用于 authorized replay 判断）。
 */
export function isPaperReviewItem(item: ReviewItem, paperId: string): boolean {
  return item.sourceActivityId === paperId &&
    (item.sourceModule === "listening" || item.sourceModule === "reading");
}
