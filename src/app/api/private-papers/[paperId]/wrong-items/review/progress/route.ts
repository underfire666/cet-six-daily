import { auth } from "@/lib/auth/config";
import { privateRequest, privateErrorResponse } from "@/lib/private-papers/http";
import { readPrivateReviewProgressSnapshot, PrivateReviewProgressStoreError } from "@/content/private-review-progress-store";

interface RouteParams {
  params: Promise<{ paperId: string }>;
}

async function safeAuth(): Promise<{ user?: { id?: string } } | null> {
  try { return await auth(); } catch { return null; }
}

function reviewErrorResponse(error: unknown): Response {
  if (error instanceof PrivateReviewProgressStoreError) {
    const status = { NOT_FOUND: 404, VALIDATION_ERROR: 422, CONFLICT: 409, NOT_READY: 422, CONTENT_CHANGED: 409, BATCH_MISMATCH: 409, INTERNAL_ERROR: 500 }[error.code];
    return Response.json({ error: error.message, code: error.code }, { status });
  }
  return privateErrorResponse(error);
}

// GET /api/private-papers/[paperId]/wrong-items/review/progress
// Read-only hydration of current review progress. Returns invalidated state if content/batch changed.
export async function GET(_request: Request, { params }: RouteParams) {
  return privateRequest(
    () => safeAuth(),
    async (owner) => {
      try {
        const paperId = (await params).paperId;
        const snapshot = await readPrivateReviewProgressSnapshot(owner, paperId);
        return Response.json({ ownerId: owner, paperId, ...snapshot });
      } catch (error) {
        return reviewErrorResponse(error);
      }
    },
  );
}
