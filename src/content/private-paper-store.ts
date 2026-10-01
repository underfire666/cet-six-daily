/**
 * V14 Phase 1B: PrivatePaper 持久化存储层。
 *
 * 所有操作必须由 server 从 auth session 派生 ownerId（userId 参数）。
 * 不信任请求中的 ownerId、owner-scoped ID 或客户端用户变量。
 *
 * 严格沿用 Phase 1A 合约：
 * - authenticity 固定为 user_import
 * - visibility 固定为 private
 * - 使用 privatePaperStableId 生成 owner-scoped stable ID
 * - validatePrivatePaper 校验完整内容与 rightsAcknowledgement
 * - PRIVATE 永不进入全局 production registry
 */
import { prisma } from "@/lib/db/prisma";
import {
  validatePrivatePaper,
  privatePaperStableId,
  isValidOwnerScopedId,
  type PrivateRightsAcknowledgement,
} from "./private-content";

/** 创建私有卷时客户端提供的数据（不含 server 派生的身份字段）。 */
export interface CreatePrivatePaperInput {
  /** 客户端本地 paper 标识（不含 private: 前缀，server 会拼接完整 stable ID）。 */
  localPaperId: string;
  /** 卷标题。 */
  title: string;
  /** 完整 CET6Paper 内容（JSON 可序列化）。 */
  content: Record<string, unknown>;
  /** 用户权利确认。 */
  rightsAcknowledgement: PrivateRightsAcknowledgement;
}

/** 更新私有卷时允许修改的字段（身份字段禁止修改）。 */
export interface UpdatePrivatePaperInput {
  title?: string;
  content?: Record<string, unknown>;
  rightsAcknowledgement?: PrivateRightsAcknowledgement;
}

/** 存储层错误类型。 */
export class PrivatePaperStoreError extends Error {
  constructor(
    public code:
      | "UNAUTHORIZED"
      | "NOT_FOUND"
      | "VALIDATION_ERROR"
      | "DUPLICATE_ID"
      | "INTERNAL_ERROR",
    message: string,
    public details?: string[],
  ) {
    super(message);
    this.name = "PrivatePaperStoreError";
  }
}

/**
 * 从 userId 派生 owner-scoped namespace。
 * 使用 userId 的前 12 字符作为 ownerScopedId（cuid 不含 @ 和 :，满足 isValidOwnerScopedId）。
 */
function deriveOwnerScopedId(userId: string): string {
  if (!isValidOwnerScopedId(userId)) {
    throw new PrivatePaperStoreError("INTERNAL_ERROR", "invalid userId for owner namespace");
  }
  // cuid 本身满足 isValidOwnerScopedId（长度 >=3, <=128, 不含 : 和 @）
  return userId;
}

/** 构造完整的私有卷内容对象（server 派生身份字段）。 */
function buildPrivatePaperContent(
  userId: string,
  localPaperId: string,
  title: string,
  content: Record<string, unknown>,
  rightsAcknowledgement: PrivateRightsAcknowledgement,
): { paperId: string; fullContent: Record<string, unknown> } {
  const ownerScopedId = deriveOwnerScopedId(userId);
  const paperId = privatePaperStableId(ownerScopedId, localPaperId);

  const fullContent: Record<string, unknown> = {
    ...content,
    id: paperId,
    paperId,
    title,
    authenticity: "user_import",
    visibility: "private",
    ownerId: userId,
    ownerNamespace: `user:${ownerScopedId}`,
    productionEligible: false,
    globalSelectorEligible: false,
    redistributable: false,
    shareEligible: false,
    importedAt: new Date().toISOString(),
    rightsAcknowledgement,
  };

  return { paperId, fullContent };
}

/**
 * 创建私有卷。
 * server 从 session 派生 userId，生成完整 stable ID 和身份字段。
 * @throws PrivatePaperStoreError VALIDATION_ERROR / DUPLICATE_ID / INTERNAL_ERROR
 */
export async function createPrivatePaper(
  userId: string,
  input: CreatePrivatePaperInput,
): Promise<{ id: string; paperId: string; title: string }> {
  if (!userId || typeof userId !== "string") {
    throw new PrivatePaperStoreError("UNAUTHORIZED", "userId required");
  }
  if (!input?.localPaperId || typeof input.localPaperId !== "string") {
    throw new PrivatePaperStoreError("VALIDATION_ERROR", "localPaperId required");
  }
  if (input.localPaperId.includes(":")) {
    throw new PrivatePaperStoreError("VALIDATION_ERROR", "localPaperId must not contain ':'");
  }
  if (!input?.title || typeof input.title !== "string") {
    throw new PrivatePaperStoreError("VALIDATION_ERROR", "title required");
  }
  if (!input?.content || typeof input.content !== "object") {
    throw new PrivatePaperStoreError("VALIDATION_ERROR", "content required");
  }
  if (!input?.rightsAcknowledgement) {
    throw new PrivatePaperStoreError("VALIDATION_ERROR", "rightsAcknowledgement required");
  }

  const { paperId, fullContent } = buildPrivatePaperContent(
    userId,
    input.localPaperId,
    input.title,
    input.content,
    input.rightsAcknowledgement,
  );

  // 校验完整内容
  const errors = validatePrivatePaper(fullContent);
  if (errors.length > 0) {
    throw new PrivatePaperStoreError("VALIDATION_ERROR", "paper validation failed", errors);
  }

  // 检查重复 ID
  const existing = await prisma.privatePaper.findUnique({
    where: { userId_paperId: { userId, paperId } },
    select: { id: true },
  });
  if (existing) {
    throw new PrivatePaperStoreError("DUPLICATE_ID", `paper already exists: ${paperId}`);
  }

  try {
    const record = await prisma.privatePaper.create({
      data: {
        userId,
        paperId,
        title: input.title,
        content: fullContent as never,
      },
      select: { id: true, paperId: true, title: true },
    });
    return record;
  } catch (err) {
    if (err instanceof Error && err.message.includes("Unique constraint")) {
      throw new PrivatePaperStoreError("DUPLICATE_ID", `paper already exists: ${paperId}`);
    }
    throw new PrivatePaperStoreError("INTERNAL_ERROR", "failed to create private paper");
  }
}

/**
 * 获取私有卷（按 userId + paperId 限定）。
 * 对不存在和他人拥有的记录返回一致的 NOT_FOUND，避免泄露存在性。
 * @throws PrivatePaperStoreError NOT_FOUND / UNAUTHORIZED
 */
export async function getPrivatePaper(
  userId: string,
  paperId: string,
): Promise<{ id: string; paperId: string; title: string; content: Record<string, unknown>; createdAt: string; updatedAt: string }> {
  if (!userId || typeof userId !== "string") {
    throw new PrivatePaperStoreError("UNAUTHORIZED", "userId required");
  }
  if (!paperId || typeof paperId !== "string") {
    throw new PrivatePaperStoreError("NOT_FOUND", "paper not found");
  }

  const record = await prisma.privatePaper.findUnique({
    where: { userId_paperId: { userId, paperId } },
    select: { id: true, paperId: true, title: true, content: true, createdAt: true, updatedAt: true },
  });

  if (!record) {
    // 一致响应：不存在或他人拥有都返回 NOT_FOUND
    throw new PrivatePaperStoreError("NOT_FOUND", "paper not found");
  }

  return {
    id: record.id,
    paperId: record.paperId,
    title: record.title,
    content: record.content as Record<string, unknown>,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

/**
 * 列出用户的所有私有卷（仅返回摘要，不返回完整 content）。
 */
export async function listPrivatePapers(
  userId: string,
): Promise<Array<{ id: string; paperId: string; title: string; createdAt: string; updatedAt: string }>> {
  if (!userId || typeof userId !== "string") {
    throw new PrivatePaperStoreError("UNAUTHORIZED", "userId required");
  }

  const records = await prisma.privatePaper.findMany({
    where: { userId },
    select: { id: true, paperId: true, title: true, createdAt: true, updatedAt: true },
    orderBy: { updatedAt: "desc" },
  });

  return records.map((r) => ({
    id: r.id,
    paperId: r.paperId,
    title: r.title,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }));
}

/**
 * 更新私有卷（按 userId + paperId 限定）。
 * 禁止修改 owner、paperId、namespace、visibility、authenticity 等身份字段。
 * @throws PrivatePaperStoreError NOT_FOUND / VALIDATION_ERROR / INTERNAL_ERROR
 */
export async function updatePrivatePaper(
  userId: string,
  paperId: string,
  updates: UpdatePrivatePaperInput,
): Promise<{ id: string; paperId: string; title: string }> {
  if (!userId || typeof userId !== "string") {
    throw new PrivatePaperStoreError("UNAUTHORIZED", "userId required");
  }
  if (!paperId || typeof paperId !== "string") {
    throw new PrivatePaperStoreError("NOT_FOUND", "paper not found");
  }
  if (!updates || typeof updates !== "object") {
    throw new PrivatePaperStoreError("VALIDATION_ERROR", "updates required");
  }

  // 先获取现有记录
  const existing = await prisma.privatePaper.findUnique({
    where: { userId_paperId: { userId, paperId } },
    select: { id: true, title: true, content: true },
  });

  if (!existing) {
    throw new PrivatePaperStoreError("NOT_FOUND", "paper not found");
  }

  // 合并更新（身份字段从现有 content 保留，不允许修改）
  const existingContent = existing.content as Record<string, unknown>;
  const mergedContent: Record<string, unknown> = {
    ...existingContent,
    ...(updates.content ?? {}),
    // 身份字段强制保留，不允许通过 update 修改
    id: existingContent.id,
    paperId: existingContent.paperId,
    authenticity: "user_import",
    visibility: "private",
    ownerId: existingContent.ownerId,
    ownerNamespace: existingContent.ownerNamespace,
    productionEligible: false,
    globalSelectorEligible: false,
    redistributable: false,
    shareEligible: false,
  };

  if (updates.title) {
    mergedContent.title = updates.title;
  }
  if (updates.rightsAcknowledgement) {
    mergedContent.rightsAcknowledgement = updates.rightsAcknowledgement;
  }

  // 校验合并后的完整内容
  const errors = validatePrivatePaper(mergedContent);
  if (errors.length > 0) {
    throw new PrivatePaperStoreError("VALIDATION_ERROR", "paper validation failed", errors);
  }

  const finalTitle = updates.title ?? existing.title;

  try {
    const record = await prisma.privatePaper.update({
      where: { userId_paperId: { userId, paperId } },
      data: {
        title: finalTitle,
        content: mergedContent as never,
      },
      select: { id: true, paperId: true, title: true },
    });
    return record;
  } catch {
    throw new PrivatePaperStoreError("INTERNAL_ERROR", "failed to update private paper");
  }
}

/**
 * 删除私有卷（按 userId + paperId 限定）。
 * @throws PrivatePaperStoreError NOT_FOUND / INTERNAL_ERROR
 */
export async function deletePrivatePaper(
  userId: string,
  paperId: string,
): Promise<{ success: true }> {
  if (!userId || typeof userId !== "string") {
    throw new PrivatePaperStoreError("UNAUTHORIZED", "userId required");
  }
  if (!paperId || typeof paperId !== "string") {
    throw new PrivatePaperStoreError("NOT_FOUND", "paper not found");
  }

  // 先检查存在性（同时限定 userId，避免泄露他人记录存在性）
  const existing = await prisma.privatePaper.findUnique({
    where: { userId_paperId: { userId, paperId } },
    select: { id: true },
  });

  if (!existing) {
    throw new PrivatePaperStoreError("NOT_FOUND", "paper not found");
  }

  try {
    await prisma.privatePaper.delete({
      where: { userId_paperId: { userId, paperId } },
    });
    return { success: true };
  } catch {
    throw new PrivatePaperStoreError("INTERNAL_ERROR", "failed to delete private paper");
  }
}
