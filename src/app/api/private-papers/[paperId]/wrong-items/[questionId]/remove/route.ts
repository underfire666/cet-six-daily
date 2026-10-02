import { auth } from "@/lib/auth/config";
import { privateRequest, privateErrorResponse } from "@/lib/private-papers/http";
import { removeWrongItem, PrivateWrongItemStoreError } from "@/content/private-wrong-item-store";

interface RouteParams {
  params: Promise<{ paperId: string; questionId: string }>;
}

async function safeAuth(): Promise<{ user?: { id?: string } } | null> {
  try { return await auth(); } catch { return null; }
}

function wrongItemErrorResponse(error: unknown): Response {
  if (error instanceof PrivateWrongItemStoreError) {
    const status = { NOT_FOUND: 404, VALIDATION_ERROR: 422, CONFLICT: 409, INTERNAL_ERROR: 500 }[error.code];
    return Response.json({ error: error.message, code: error.code }, { status });
  }
  return privateErrorResponse(error);
}

// POST /api/private-papers/[paperId]/wrong-items/[questionId]/remove
// Body: { contentHash: string, revision: number }
// Soft-removes a wrong item (sets removedAt). Idempotent if already removed.
// CAS: revision must match current revision, otherwise 409 CONFLICT.
export async function POST(request: Request, { params }: RouteParams) {
  return privateRequest(
    () => safeAuth(),
    async (owner) => {
      try {
        const { paperId, questionId } = await params;
        const body = await request.json().catch(() => null);
        if (!body || typeof body !== "object") {
          return Response.json({ error: "invalid request body", code: "VALIDATION_ERROR" }, { status: 422 });
        }
        const { contentHash, revision } = body as Record<string, unknown>;
        if (typeof contentHash !== "string" || !contentHash.trim()) {
          return Response.json({ error: "contentHash is required", code: "VALIDATION_ERROR" }, { status: 422 });
        }
        if (typeof revision !== "number" || !Number.isInteger(revision) || revision < 0) {
          return Response.json({ error: "revision must be a non-negative integer", code: "VALIDATION_ERROR" }, { status: 422 });
        }
        const item = await removeWrongItem(owner, paperId, contentHash, decodeURIComponent(questionId), revision);
        return Response.json({ item });
      } catch (error) {
        return wrongItemErrorResponse(error);
      }
    },
  );
}
