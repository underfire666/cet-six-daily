import { auth } from "@/lib/auth/config";
import { privateRequest, privateErrorResponse, readPrivateBody } from "@/lib/private-papers/http";
import { gradeReviewItems, PrivateWrongItemStoreError } from "@/content/private-wrong-item-store";

interface RouteParams {
  params: Promise<{ paperId: string }>;
}

async function safeAuth(): Promise<{ user?: { id?: string } } | null> {
  try { return await auth(); } catch { return null; }
}

function wrongItemErrorResponse(error: unknown): Response {
  if (error instanceof PrivateWrongItemStoreError) {
    const status = { NOT_FOUND: 404, VALIDATION_ERROR: 422, INTERNAL_ERROR: 500 }[error.code];
    return Response.json({ error: error.message, code: error.code }, { status });
  }
  return privateErrorResponse(error);
}

// POST /api/private-papers/[paperId]/wrong-items/review/grade
// Read-only grading: validates owner, paper, contentHash, question membership, then scores.
// Does NOT modify wrongCount, progress, XP, or any other state. Idempotent.
export async function POST(request: Request, { params }: RouteParams) {
  return privateRequest(
    () => safeAuth(),
    async (owner) => {
      try {
        const paperId = (await params).paperId;
        const body = await readPrivateBody(request);
        const contentHash = typeof body.contentHash === "string" ? body.contentHash : "";
        const answers = typeof body.answers === "object" && body.answers !== null && !Array.isArray(body.answers)
          ? body.answers as Record<string, string>
          : {};
        const result = await gradeReviewItems(owner, paperId, contentHash, answers);
        return Response.json({ ownerId: owner, ...result });
      } catch (error) {
        return wrongItemErrorResponse(error);
      }
    },
  );
}
