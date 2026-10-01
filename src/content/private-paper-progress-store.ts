/**
 * V14 Phase 1E.1 — Private Paper Study Progress 服务端存储层。
 *
 * 只信任 HTTP session 派生的 userId；不接受客户端传入的 ownerId。
 * - getPrivatePaperProgress：读取并净化（contentHash 不匹配 → null；非法答案丢弃并回写）。
 * - putPrivatePaperProgress：条件更新（attemptId / revision / contentHash 校验，事务内先查后写）。
 * - 不存储分数：读取时由调用方按当前试卷重算。
 */
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getPrivatePaper, PrivatePaperStoreError } from "./private-paper-store";
import { checkPrivatePaperReadiness, type PrivateFlatQuestion } from "@/lib/private-papers/readiness";

export type PrivatePaperProgressErrorCode =
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "CONFLICT"
  | "NOT_READY"
  | "CONTENT_CHANGED"
  | "INTERNAL_ERROR";

export interface PrivatePaperProgressConflictInfo {
  conflictType?: "revision_conflict" | "attempt_mismatch";
  currentRevision?: number;
  currentAttemptId?: string;
  serverProgress?: unknown;
  reason?: string;
  details?: string[];
}

export class PrivatePaperProgressStoreError extends Error {
  constructor(
    public code: PrivatePaperProgressErrorCode,
    message: string,
    public extra?: PrivatePaperProgressConflictInfo,
  ) {
    super(message);
    this.name = "PrivatePaperProgressStoreError";
  }
}

export interface PrivatePaperProgressView {
  paperId: string;
  attemptId: string;
  contentHash: string;
  answers: Record<string, string>;
  currentIndex: number;
  submitted: boolean;
  revision: number;
  updatedAt: string;
}

export interface PutPrivatePaperProgressResult {
  revision: number;
  updatedAt: string;
}

function owner(userId: string) {
  if (typeof userId !== "string" || !userId.trim()) {
    throw new PrivatePaperProgressStoreError("NOT_FOUND", "paper not found");
  }
}

function checkPaperId(paperId: string) {
  if (typeof paperId !== "string" || !/^private:[^:@\s]+:[^:\x00-\x1f\x7f]+$/u.test(paperId) || paperId.length > 400) {
    throw new PrivatePaperProgressStoreError("NOT_FOUND", "paper not found");
  }
}

function invalid(message: string, details?: string[]): never {
  throw new PrivatePaperProgressStoreError("VALIDATION_ERROR", message, { details });
}

async function database<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof PrivatePaperProgressStoreError) throw error;
    if (error instanceof PrivatePaperStoreError) throw error;
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") throw new PrivatePaperProgressStoreError("CONFLICT", "progress already exists");
      if (error.code === "P2025") throw new PrivatePaperProgressStoreError("NOT_FOUND", "progress not found");
    }
    throw new PrivatePaperProgressStoreError("INTERNAL_ERROR", "private paper progress storage unavailable");
  }
}

const key = (userId: string, paperId: string) => ({ userId_paperId: { userId, paperId } });

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * 净化 answers。
 * - PUT（forWrite=true）：键不规范、值不是合法 optionId → VALIDATION_ERROR；越界索引静默忽略。
 * - GET（forWrite=false）：非法条目一律丢弃，不抛错。
 */
function sanitizeAnswers(
  raw: unknown,
  questions: PrivateFlatQuestion[],
  forWrite: boolean,
): { answers: Record<string, string>; dropped: boolean } {
  if (!isRecord(raw)) {
    if (forWrite) invalid("answers must be an object");
    return { answers: {}, dropped: false };
  }
  const byIndex = new Map(questions.map((q) => [q.index, q]));
  const clean: Record<string, string> = {};
  let dropped = false;
  for (const [entryKey, value] of Object.entries(raw)) {
    if (!/^(0|[1-9][0-9]*)$/.test(entryKey)) {
      if (forWrite) invalid(`answer key "${entryKey}" must be a canonical non-negative integer string`);
      dropped = true;
      continue;
    }
    const index = Number(entryKey);
    const question = byIndex.get(index);
    if (!question) {
      // 越界索引：静默忽略，不计数。
      dropped = true;
      continue;
    }
    if (typeof value !== "string" || !question.options.some((o) => o.id === value)) {
      if (forWrite) invalid(`answer for question ${index} is not a valid optionId`);
      dropped = true;
      continue;
    }
    clean[entryKey] = value;
  }
  return { answers: clean, dropped };
}

function toView(record: {
  paperId: string;
  attemptId: string;
  contentHash: string;
  answers: Prisma.JsonValue;
  currentIndex: number;
  submitted: boolean;
  revision: number;
  updatedAt: Date;
}): PrivatePaperProgressView {
  const answers: Record<string, string> = {};
  if (isRecord(record.answers)) {
    for (const [k, v] of Object.entries(record.answers)) {
      if (typeof v === "string") answers[k] = v;
    }
  }
  return {
    paperId: record.paperId,
    attemptId: record.attemptId,
    contentHash: record.contentHash,
    answers,
    currentIndex: record.currentIndex,
    submitted: record.submitted,
    revision: record.revision,
    updatedAt: record.updatedAt.toISOString(),
  };
}

/**
 * 读取当前用户的私有卷进度。
 * - 试卷不存在 / 跨 owner → NOT_FOUND。
 * - 试卷不 ready 或 contentHash 不匹配 → 返回 null（exists:false，旧进度不可恢复）。
 * - 非法 answers 丢弃并回写净化后的记录。
 */
export async function getPrivatePaperProgress(
  userId: string,
  paperId: string,
): Promise<PrivatePaperProgressView | null> {
  owner(userId);
  checkPaperId(paperId);
  return database(async () => {
    const paper = await getPrivatePaper(userId, paperId);
    const readiness = checkPrivatePaperReadiness(paper.content);
    if (!readiness.ready) return null;
    const record = await prisma.privatePaperProgress.findUnique({ where: key(userId, paperId) });
    if (!record) return null;
    if (record.contentHash !== readiness.contentHash) return null;
    const { answers: clean, dropped } = sanitizeAnswers(record.answers, readiness.questions, false);
    if (dropped) {
      await prisma.privatePaperProgress.update({
        where: key(userId, paperId),
        data: { answers: clean },
      });
    }
    return toView({ ...record, answers: clean });
  });
}

/**
 * 条件写入进度。事务内先查后写。
 * - not ready → NOT_READY；contentHash 不匹配 → CONTENT_CHANGED。
 * - attemptId 不匹配 → CONFLICT(attempt_mismatch)；revision 不匹配 → CONFLICT(revision_conflict)。
 * 返回新 revision 与 updatedAt。
 */
export async function putPrivatePaperProgress(
  userId: string,
  paperId: string,
  input: unknown,
): Promise<PutPrivatePaperProgressResult> {
  owner(userId);
  checkPaperId(paperId);
  if (!isRecord(input)) invalid("request body must be a JSON object");

  const attemptId = input.attemptId;
  if (typeof attemptId !== "string" || !attemptId.trim() || attemptId.length > 200) {
    invalid("attemptId must be a non-empty string");
  }

  const clientContentHash = input.contentHash;
  if (typeof clientContentHash !== "string" || !clientContentHash) {
    invalid("contentHash must be a string");
  }

  if (typeof input.currentIndex !== "number" || !Number.isSafeInteger(input.currentIndex)) {
    invalid("currentIndex must be a safe integer");
  }

  if (typeof input.submitted !== "boolean") {
    invalid("submitted must be a boolean");
  }

  let baseRevision: number;
  if (input.baseRevision === undefined || input.baseRevision === null) {
    baseRevision = 0;
  } else if (typeof input.baseRevision !== "number" || !Number.isSafeInteger(input.baseRevision) || input.baseRevision < 0) {
    invalid("baseRevision must be a non-negative safe integer");
  } else {
    baseRevision = input.baseRevision;
  }

  return database(async () => {
    const paper = await getPrivatePaper(userId, paperId);
    const readiness = checkPrivatePaperReadiness(paper.content);
    if (!readiness.ready) {
      throw new PrivatePaperProgressStoreError("NOT_READY", "paper is not ready", { reason: readiness.reason });
    }
    const currentHash = readiness.contentHash;
    if (clientContentHash !== currentHash) {
      throw new PrivatePaperProgressStoreError("CONTENT_CHANGED", "content hash mismatch");
    }

    const total = readiness.questions.length;
    const currentIndex = Math.max(0, Math.min(input.currentIndex as number, total - 1));
    const { answers: cleanAnswers } = sanitizeAnswers(input.answers, readiness.questions, true);

    return prisma.$transaction(async (tx) => {
      const existing = await tx.privatePaperProgress.findUnique({ where: key(userId, paperId) });

      if (!existing) {
        // 首次创建。要求 baseRevision ≤ 1；客户端误以为有更高版本则视为冲突。
        if (baseRevision > 1) {
          throw new PrivatePaperProgressStoreError("CONFLICT", "revision conflict", {
            conflictType: "revision_conflict",
            currentRevision: 0,
            serverProgress: null,
          });
        }
        const created = await tx.privatePaperProgress.create({
          data: {
            userId,
            paperId,
            attemptId: attemptId as string,
            contentHash: currentHash,
            answers: cleanAnswers as Prisma.InputJsonObject,
            currentIndex,
            submitted: input.submitted as boolean,
            revision: baseRevision >= 1 ? baseRevision + 1 : 1,
          },
        });
        return { revision: created.revision, updatedAt: created.updatedAt.toISOString() };
      }

      if (existing.attemptId !== attemptId) {
        throw new PrivatePaperProgressStoreError("CONFLICT", "attempt id mismatch", {
          conflictType: "attempt_mismatch",
          currentAttemptId: existing.attemptId,
        });
      }

      if (existing.revision !== baseRevision) {
        const { answers: existingClean } = sanitizeAnswers(existing.answers, readiness.questions, false);
        throw new PrivatePaperProgressStoreError("CONFLICT", "revision conflict", {
          conflictType: "revision_conflict",
          currentRevision: existing.revision,
          serverProgress: toView({ ...existing, answers: existingClean }),
        });
      }

      const updated = await tx.privatePaperProgress.update({
        where: key(userId, paperId),
        data: {
          contentHash: currentHash,
          answers: cleanAnswers as Prisma.InputJsonObject,
          currentIndex,
          submitted: input.submitted as boolean,
          revision: existing.revision + 1,
        },
      });
      return { revision: updated.revision, updatedAt: updated.updatedAt.toISOString() };
    });
  });
}
