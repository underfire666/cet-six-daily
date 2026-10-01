/**
 * V14 Phase 1D.2 — Private Wrongbook (错题本) storage.
 *
 * 独立存储，不塞入全局 ReviewItem。以服务端判分为依据，
 * 与提交接受在同一 Prisma 事务内写入，保证一致性。
 */
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import type { PrivateFlatQuestion } from "@/lib/private-papers/readiness";

export type PrivateWrongItemStatus = "active" | "content_changed" | "paper_deleted";

export interface PrivateWrongItemView {
  id: string;
  paperId: string;
  contentHash: string;
  questionId: string;
  attemptId: string;
  userAnswer: string | null;
  correctAnswer: string;
  wrongCount: number;
  status: PrivateWrongItemStatus;
  firstSeenAt: string;
  lastSeenAt: string;
  question?: {
    prompt: string;
    options: Array<{ id: string; text: string }>;
    shortExplanation?: string;
    detailedExplanation?: string;
    passage?: string;
  };
  paperTitle?: string;
}

export class PrivateWrongItemStoreError extends Error {
  constructor(public code: "NOT_FOUND" | "VALIDATION_ERROR" | "INTERNAL_ERROR", message: string) {
    super(message);
    this.name = "PrivateWrongItemStoreError";
  }
}

function identity(userId: string, paperId?: string) {
  if (!userId?.trim()) throw new PrivateWrongItemStoreError("NOT_FOUND", "user not found");
  if (paperId !== undefined) {
    if (!/^private:[^:@\s]+:[^:\x00-\x1f\x7f]+$/u.test(paperId) || paperId.length > 400) {
      throw new PrivateWrongItemStoreError("NOT_FOUND", "paper not found");
    }
  }
}

async function database<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof PrivateWrongItemStoreError) throw error;
    throw new PrivateWrongItemStoreError("INTERNAL_ERROR", "private wrong item storage unavailable");
  }
}

/**
 * 在提交事务内记录错题。仅在 submitted=true 时调用。
 * 以服务端判分为依据：answers[q.index] !== q.answerId 即为答错。
 * 未作答（answers 中无该 index）也视为答错，userAnswer=null。
 */
export async function recordWrongItems(
  tx: Prisma.TransactionClient,
  userId: string,
  paperId: string,
  contentHash: string,
  attemptId: string,
  questions: PrivateFlatQuestion[],
  answers: Record<string, string>,
): Promise<{ recorded: number; updated: number }> {
  let recorded = 0;
  let updated = 0;

  for (const q of questions) {
    const userAnswer = answers[q.index] ?? null;
    const isWrong = userAnswer !== q.answerId;
    if (!isWrong) continue;

    const existing = await tx.privateWrongItem.findUnique({
      where: { userId_paperId_questionId: { userId, paperId, questionId: q.questionId } },
    });

    if (existing) {
      const sameAttempt = existing.attemptId === attemptId;
      const newWrongCount = sameAttempt ? existing.wrongCount : existing.wrongCount + 1;

      await tx.privateWrongItem.update({
        where: { id: existing.id },
        data: {
          attemptId,
          contentHash,
          userAnswer,
          correctAnswer: q.answerId,
          wrongCount: newWrongCount,
          status: "active",
          lastSeenAt: new Date(),
        },
      });
      if (!sameAttempt) updated++;
    } else {
      await tx.privateWrongItem.create({
        data: {
          userId,
          paperId,
          contentHash,
          questionId: q.questionId,
          attemptId,
          userAnswer,
          correctAnswer: q.answerId,
          wrongCount: 1,
          status: "active",
        },
      });
      recorded++;
    }
  }

  return { recorded, updated };
}

/** 标记某卷的所有错题为 content_changed（内容已更新，旧错题失效）。 */
export async function markWrongItemsContentChanged(
  tx: Prisma.TransactionClient,
  userId: string,
  paperId: string,
): Promise<number> {
  const result = await tx.privateWrongItem.updateMany({
    where: { userId, paperId, status: "active" },
    data: { status: "content_changed" },
  });
  return result.count;
}

/** 删除某卷的所有错题（删除私有卷时级联清理）。 */
export async function deleteWrongItemsForPaper(
  tx: Prisma.TransactionClient,
  userId: string,
  paperId: string,
): Promise<number> {
  const result = await tx.privateWrongItem.deleteMany({ where: { userId, paperId } });
  return result.count;
}

/** 查询某用户某卷的错题列表，附带当前试卷内容中的题目详情。 */
export async function listPrivateWrongItems(
  userId: string,
  paperId: string,
): Promise<Array<PrivateWrongItemView>> {
  identity(userId, paperId);
  return database(async () => {
    const paper = await prisma.privatePaper.findUnique({
      where: { userId_paperId: { userId, paperId } },
      select: { title: true, content: true },
    });
    if (!paper) throw new PrivateWrongItemStoreError("NOT_FOUND", "paper not found");

    const items = await prisma.privateWrongItem.findMany({
      where: { userId, paperId, status: { in: ["active", "content_changed"] } },
      orderBy: { lastSeenAt: "desc" },
    });

    const { checkPrivatePaperReadiness } = await import("@/lib/private-papers/readiness");
    const readiness = checkPrivatePaperReadiness(paper.content as Record<string, unknown>);
    const questionMap = new Map<string, PrivateFlatQuestion>();
    if (readiness.ready) {
      for (const q of readiness.questions) questionMap.set(q.questionId, q);
    }

    return items.map((item) => {
      const view: PrivateWrongItemView = {
        id: item.id,
        paperId: item.paperId,
        contentHash: item.contentHash,
        questionId: item.questionId,
        attemptId: item.attemptId,
        userAnswer: item.userAnswer,
        correctAnswer: item.correctAnswer,
        wrongCount: item.wrongCount,
        status: item.status as PrivateWrongItemStatus,
        firstSeenAt: item.firstSeenAt.toISOString(),
        lastSeenAt: item.lastSeenAt.toISOString(),
        paperTitle: paper.title,
      };

      if (item.status === "active" && readiness.ready && readiness.contentHash === item.contentHash) {
        const q = questionMap.get(item.questionId);
        if (q) {
          view.question = {
            prompt: q.prompt,
            options: q.options.map((o) => ({ id: o.id, text: o.text })),
            shortExplanation: q.shortExplanation,
            detailedExplanation: q.detailedExplanation,
            passage: q.passage,
          };
        }
      }
      return view;
    });
  });
}

/** 查询单条错题详情。 */
export async function getPrivateWrongItem(
  userId: string,
  wrongItemId: string,
): Promise<PrivateWrongItemView> {
  identity(userId);
  if (!wrongItemId?.trim() || wrongItemId.length > 200) {
    throw new PrivateWrongItemStoreError("NOT_FOUND", "wrong item not found");
  }
  return database(async () => {
    const item = await prisma.privateWrongItem.findUnique({ where: { id: wrongItemId } });
    if (!item || item.userId !== userId) {
      throw new PrivateWrongItemStoreError("NOT_FOUND", "wrong item not found");
    }

    const paper = await prisma.privatePaper.findUnique({
      where: { userId_paperId: { userId, paperId: item.paperId } },
      select: { title: true, content: true },
    });

    const view: PrivateWrongItemView = {
      id: item.id,
      paperId: item.paperId,
      contentHash: item.contentHash,
      questionId: item.questionId,
      attemptId: item.attemptId,
      userAnswer: item.userAnswer,
      correctAnswer: item.correctAnswer,
      wrongCount: item.wrongCount,
      status: item.status as PrivateWrongItemStatus,
      firstSeenAt: item.firstSeenAt.toISOString(),
      lastSeenAt: item.lastSeenAt.toISOString(),
      paperTitle: paper?.title,
    };

    if (paper && item.status === "active") {
      const { checkPrivatePaperReadiness } = await import("@/lib/private-papers/readiness");
      const readiness = checkPrivatePaperReadiness(paper.content as Record<string, unknown>);
      if (readiness.ready && readiness.contentHash === item.contentHash) {
        const q = readiness.questions.find((qq) => qq.questionId === item.questionId);
        if (q) {
          view.question = {
            prompt: q.prompt,
            options: q.options.map((o) => ({ id: o.id, text: o.text })),
            shortExplanation: q.shortExplanation,
            detailedExplanation: q.detailedExplanation,
            passage: q.passage,
          };
        }
      }
    }
    return view;
  });
}

/** 按 questionId 查询单条错题（利用 @@unique([userId,paperId,questionId])）。 */
export async function getPrivateWrongItemByQuestionId(
  userId: string,
  paperId: string,
  questionId: string,
): Promise<PrivateWrongItemView> {
  identity(userId, paperId);
  if (!questionId?.trim() || questionId.length > 200) {
    throw new PrivateWrongItemStoreError("NOT_FOUND", "wrong item not found");
  }
  return database(async () => {
    const item = await prisma.privateWrongItem.findUnique({
      where: { userId_paperId_questionId: { userId, paperId, questionId } },
    });
    if (!item) throw new PrivateWrongItemStoreError("NOT_FOUND", "wrong item not found");

    const paper = await prisma.privatePaper.findUnique({
      where: { userId_paperId: { userId, paperId } },
      select: { title: true, content: true },
    });

    const view: PrivateWrongItemView = {
      id: item.id,
      paperId: item.paperId,
      contentHash: item.contentHash,
      questionId: item.questionId,
      attemptId: item.attemptId,
      userAnswer: item.userAnswer,
      correctAnswer: item.correctAnswer,
      wrongCount: item.wrongCount,
      status: item.status as PrivateWrongItemStatus,
      firstSeenAt: item.firstSeenAt.toISOString(),
      lastSeenAt: item.lastSeenAt.toISOString(),
      paperTitle: paper?.title,
    };

    if (paper && item.status === "active") {
      const { checkPrivatePaperReadiness } = await import("@/lib/private-papers/readiness");
      const readiness = checkPrivatePaperReadiness(paper.content as Record<string, unknown>);
      if (readiness.ready && readiness.contentHash === item.contentHash) {
        const q = readiness.questions.find((qq) => qq.questionId === item.questionId);
        if (q) {
          view.question = {
            prompt: q.prompt,
            options: q.options.map((o) => ({ id: o.id, text: o.text })),
            shortExplanation: q.shortExplanation,
            detailedExplanation: q.detailedExplanation,
            passage: q.passage,
          };
        }
      }
    }
    return view;
  });
}

/** 查询某用户所有错题（跨卷），可选按 paperId 过滤。 */
export async function listAllPrivateWrongItems(
  userId: string,
  paperId?: string,
): Promise<Array<PrivateWrongItemView>> {
  identity(userId, paperId);
  return database(async () => {
    const where: Prisma.PrivateWrongItemWhereInput = {
      userId,
      status: { in: ["active", "content_changed"] },
    };
    if (paperId) where.paperId = paperId;

    const items = await prisma.privateWrongItem.findMany({
      where,
      orderBy: { lastSeenAt: "desc" },
    });

    const paperIds = [...new Set(items.map((i) => i.paperId))];
    const papers = await prisma.privatePaper.findMany({
      where: { userId, paperId: { in: paperIds } },
      select: { paperId: true, title: true, content: true },
    });
    const paperMap = new Map(papers.map((p) => [p.paperId, p]));

    const { checkPrivatePaperReadiness } = await import("@/lib/private-papers/readiness");
    const questionCache = new Map<string, Map<string, PrivateFlatQuestion>>();
    for (const p of papers) {
      const readiness = checkPrivatePaperReadiness(p.content as Record<string, unknown>);
      if (readiness.ready) {
        questionCache.set(p.paperId, new Map(readiness.questions.map((q) => [q.questionId, q])));
      }
    }

    return items.map((item) => {
      const paper = paperMap.get(item.paperId);
      const view: PrivateWrongItemView = {
        id: item.id,
        paperId: item.paperId,
        contentHash: item.contentHash,
        questionId: item.questionId,
        attemptId: item.attemptId,
        userAnswer: item.userAnswer,
        correctAnswer: item.correctAnswer,
        wrongCount: item.wrongCount,
        status: item.status as PrivateWrongItemStatus,
        firstSeenAt: item.firstSeenAt.toISOString(),
        lastSeenAt: item.lastSeenAt.toISOString(),
        paperTitle: paper?.title,
      };

      if (item.status === "active") {
        const qmap = questionCache.get(item.paperId);
        const q = qmap?.get(item.questionId);
        if (q) {
          view.question = {
            prompt: q.prompt,
            options: q.options.map((o) => ({ id: o.id, text: o.text })),
            shortExplanation: q.shortExplanation,
            detailedExplanation: q.detailedExplanation,
            passage: q.passage,
          };
        }
      }
      return view;
    });
  });
}