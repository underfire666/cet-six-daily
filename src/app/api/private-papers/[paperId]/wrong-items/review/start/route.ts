import { auth } from "@/lib/auth/config";
import { privateRequest, privateErrorResponse, readPrivateBody } from "@/lib/private-papers/http";
import { startPrivateReviewBatch, PrivateReviewProgressStoreError } from "@/content/private-review-progress-store";

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

// POST /api/private-papers/[paperId]/wrong-items/review/start
// Server selects at most 5 active wrong items, persists the batch, returns questions WITHOUT correct answers.
export async function POST(request: Request, { params }: RouteParams) {
  return privateRequest(
    () => safeAuth(),
    async (owner) => {
      try {
        const paperId = (await params).paperId;
        const body = await readPrivateBody(request);
        const limit = body.limit === undefined ? 5 : body.limit;
        if (typeof limit !== "number" || !Number.isInteger(limit) || limit < 1 || limit > 5) throw new PrivateReviewProgressStoreError("VALIDATION_ERROR", "invalid review limit");
        const batch = await startPrivateReviewBatch(owner, paperId, limit);
        return Response.json({ ownerId: owner, ...batch });
      } catch (error) {
        return reviewErrorResponse(error);
      }
    },
  );
}
