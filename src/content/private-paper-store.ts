/** PRIVATE persistence; only the HTTP session supplies the authenticated owner. */
import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { privatePaperStableId, validatePrivatePaper, type PrivateRightsAcknowledgement } from "./private-content";
import { isRecord, validTitle, validatePrivateDraft } from "./private-paper-validation";
import { deleteWrongItemsForPaper, markWrongItemsContentChanged } from "./private-wrong-item-store";
import { computePrivateContentHash } from "@/lib/private-papers/readiness";
export interface CreatePrivatePaperInput { localPaperId: string; title: string; content: Record<string, unknown>; rightsAcknowledgement: PrivateRightsAcknowledgement; }
export interface UpdatePrivatePaperInput { title?: string; content?: Record<string, unknown>; rightsAcknowledgement?: PrivateRightsAcknowledgement; }
export class PrivatePaperStoreError extends Error {
  constructor(public code: "UNAUTHORIZED" | "NOT_FOUND" | "VALIDATION_ERROR" | "DUPLICATE_ID" | "INTERNAL_ERROR", message: string, public details?: string[]) { super(message); this.name = "PrivatePaperStoreError"; }
}
export function derivePrivateOwnerNamespace(userId: string): string { return createHash("sha256").update("cet-daily/private-owner/v1\0").update(userId).digest("hex"); }
function owner(userId: string) { if (typeof userId !== "string" || !userId.trim()) throw new PrivatePaperStoreError("UNAUTHORIZED", "userId required"); }
function invalid(message: string): never { throw new PrivatePaperStoreError("VALIDATION_ERROR", message); }
function acknowledge(value: unknown): PrivateRightsAcknowledgement {
  if (!isRecord(value) || value.acknowledged !== true || value.statementVersion !== "1.0") invalid("acknowledged=true and supported statementVersion=1.0 required");
  return { acknowledged: true, statementVersion: "1.0", acknowledgedAt: new Date().toISOString() };
}
function titleFor(input: Record<string, unknown>, content: Record<string, unknown>, fallback?: string): string {
  if (input.title !== undefined && !validTitle(input.title)) invalid("title must be 1–200 characters and nonblank");
  if (content.title !== undefined && !validTitle(content.title)) invalid("content.title must be 1–200 characters and nonblank");
  if (input.title !== undefined && content.title !== undefined && input.title !== content.title) invalid("title and content.title conflict");
  const title = input.title ?? content.title ?? fallback;
  if (!validTitle(title)) invalid("title required");
  return title;
}
function guardedContent(content: Record<string, unknown>, userId: string, paperId: string, namespace: string, title: string, importedAt: unknown, ack: unknown) {
  const full = { ...content, id: paperId, paperId, title, ownerId: userId, ownerNamespace: namespace, authenticity: "user_import", visibility: "private", productionEligible: false, globalSelectorEligible: false, redistributable: false, shareEligible: false, importedAt, rightsAcknowledgement: ack };
  const errors = [...validatePrivateDraft(full), ...validatePrivatePaper(full as Parameters<typeof validatePrivatePaper>[0])];
  if (errors.length) throw new PrivatePaperStoreError("VALIDATION_ERROR", "paper validation failed", errors);
  try { return JSON.parse(JSON.stringify(full)) as Prisma.InputJsonObject; } catch { return invalid("content must be JSON serializable"); }
}
async function database<T>(operation: () => Promise<T>): Promise<T> {
  try { return await operation(); } catch (error) {
    if (error instanceof PrivatePaperStoreError) throw error;
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") throw new PrivatePaperStoreError("DUPLICATE_ID", "paper already exists");
      if (error.code === "P2025") throw new PrivatePaperStoreError("NOT_FOUND", "paper not found");
    }
    throw new PrivatePaperStoreError("INTERNAL_ERROR", "private paper storage unavailable");
  }
}
const key = (userId: string, paperId: string) => ({ userId_paperId: { userId, paperId } });
function checkPaperId(paperId: string) {
  if (typeof paperId !== "string" || !/^private:[^:@\s]+:[^:\x00-\x1f\x7f]+$/u.test(paperId) || paperId.length > 400) throw new PrivatePaperStoreError("NOT_FOUND", "paper not found");
}
export async function createPrivatePaper(userId: string, input: unknown) {
  owner(userId);
  if (!isRecord(input)) invalid("request object required");
  if (typeof input.localPaperId !== "string" || !input.localPaperId.trim() || input.localPaperId.length > 128 || /[:\x00-\x1f\x7f]/u.test(input.localPaperId)) invalid("invalid localPaperId");
  if (!isRecord(input.content)) invalid("content object required");
  const title = titleFor(input, input.content), namespace = derivePrivateOwnerNamespace(userId), paperId = privatePaperStableId(namespace, input.localPaperId);
  const content = guardedContent(input.content, userId, paperId, `user:${namespace}`, title, new Date().toISOString(), acknowledge(input.rightsAcknowledgement));
  return database(async () => {
    // Keep legacy IDs addressable and immutable; forbid creating their new-format alias.
    const existing = await prisma.privatePaper.findFirst({ where: { userId, paperId: { in: [paperId, `private:${userId}:${input.localPaperId}`] } }, select: { id: true } });
    if (existing) throw new PrivatePaperStoreError("DUPLICATE_ID", "paper already exists");
    return prisma.privatePaper.create({ data: { userId, paperId, title, content }, select: { id: true, paperId: true, title: true } });
  });
}
export async function getPrivatePaper(userId: string, paperId: string) {
  owner(userId); checkPaperId(paperId);
  return database(async () => {
    const record = await prisma.privatePaper.findUnique({ where: key(userId, paperId) });
    if (!record) throw new PrivatePaperStoreError("NOT_FOUND", "paper not found");
    return { id: record.id, paperId: record.paperId, title: record.title, content: record.content as Record<string, unknown>, createdAt: record.createdAt.toISOString(), updatedAt: record.updatedAt.toISOString() };
  });
}
export async function listPrivatePapers(userId: string) {
  owner(userId);
  return database(async () => (await prisma.privatePaper.findMany({ where: { userId }, select: { id: true, paperId: true, title: true, createdAt: true, updatedAt: true }, orderBy: { updatedAt: "desc" } })).map(r => ({ ...r, createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString() })));
}
export async function updatePrivatePaper(userId: string, paperId: string, updates: unknown) {
  owner(userId); checkPaperId(paperId);
  if (!isRecord(updates)) invalid("updates object required");
  if (updates.content !== undefined && !isRecord(updates.content)) invalid("content object required");
  return database(() => prisma.$transaction(async tx => {
    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "PrivatePaper" WHERE "userId" = ${userId} AND "paperId" = ${paperId} FOR UPDATE`);
    const existing = await tx.privatePaper.findUnique({ where: key(userId, paperId) });
    if (!existing) throw new PrivatePaperStoreError("NOT_FOUND", "paper not found");
    const previous = existing.content as Record<string, unknown>, patch = (updates.content ?? {}) as Record<string, unknown>;
    const oldContentHash = computePrivateContentHash(previous);
    const title = titleFor(updates, patch, existing.title);
    const ack = updates.rightsAcknowledgement === undefined ? previous.rightsAcknowledgement : acknowledge(updates.rightsAcknowledgement);
    const merged = { ...previous, ...patch };
    // Phase 1B accepted a legacy sections object. Normalize known legacy drafts
    // only when the caller did not supply sections; IDs and namespace stay intact.
    if (patch.sections === undefined && isRecord(previous.sections)) {
      const entries = Object.entries(previous.sections);
      if (entries.every(([type, groups]) => ["writing", "listening", "reading", "translation"].includes(type) && Array.isArray(groups))) {
        merged.sections = entries.map(([type, groups], order) => ({ sectionId: `legacy-${type}`, type, order, groups }));
      }
    }
    const content = guardedContent(merged, userId, paperId, String(previous.ownerNamespace), title, previous.importedAt, ack);
    const newContentHash = computePrivateContentHash(content);
    const updated = await tx.privatePaper.update({ where: key(userId, paperId), data: { title, content }, select: { id: true, paperId: true, title: true } });
    // When content changes, old wrong answers must not be explained with new content.
    if (oldContentHash !== newContentHash) {
      await markWrongItemsContentChanged(tx, userId, paperId);
    }
    return updated;
  }));
}
export async function deletePrivatePaper(userId: string, paperId: string): Promise<{ success: true }> {
  owner(userId); checkPaperId(paperId);
  return database(() => prisma.$transaction(async tx => {
    const result = await tx.privatePaper.deleteMany({ where: { userId, paperId } });
    if (!result.count) throw new PrivatePaperStoreError("NOT_FOUND", "paper not found");
    await tx.privatePaperProgress.deleteMany({ where: { userId, paperId } });
    await deleteWrongItemsForPaper(tx, userId, paperId);
    return { success: true as const };
  }));
}
