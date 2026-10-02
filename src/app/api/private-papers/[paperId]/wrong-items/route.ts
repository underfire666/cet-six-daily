import { auth } from "@/lib/auth/config";
import { privateRequest, privateErrorResponse } from "@/lib/private-papers/http";
import { listPrivateWrongItems, countPrivateWrongItemViews, PrivateWrongItemStoreError } from "@/content/private-wrong-item-store";

interface RouteParams {
  params: Promise<{ paperId: string }>;
}

/** Safe auth wrapper: any auth/session error in a route context → unauthenticated. */
async function safeAuth(): Promise<{ user?: { id?: string } } | null> {
  try {
    return await auth();
  } catch {
    return null;
  }
}

function wrongItemErrorResponse(error: unknown): Response {
  if (error instanceof PrivateWrongItemStoreError) {
    const status = { NOT_FOUND: 404, VALIDATION_ERROR: 422, CONFLICT: 409, INTERNAL_ERROR: 500 }[error.code];
    return Response.json({ error: error.message, code: error.code }, { status });
  }
  return privateErrorResponse(error);
}

// GET /api/private-papers/[paperId]/wrong-items
// Lists wrong items for the current user and paper, enriched with question details.
// contentHash-mismatched items are marked status=content_changed without current question details.
// Removed items (removedAt != null) are included in the list but not counted as active.
export async function GET(_request: Request, { params }: RouteParams) {
  return privateRequest(
    () => safeAuth(),
    async (owner) => {
      try {
        const paperId = (await params).paperId;
        const items = await listPrivateWrongItems(owner, paperId);
        const counts = countPrivateWrongItemViews(items);
        return Response.json({ ownerId: owner, items, counts });
      } catch (error) {
        return wrongItemErrorResponse(error);
      }
    },
  );
}
