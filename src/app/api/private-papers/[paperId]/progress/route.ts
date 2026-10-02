import { auth } from "@/lib/auth/config";
import { privateRequest, readPrivateBody } from "@/lib/private-papers/http";
import {
  readPrivateProgressSnapshot,
  putPrivatePaperProgress,
  PrivatePaperProgressStoreError,
} from "@/content/private-paper-progress-store";

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

/**
 * Map PrivatePaperProgressStoreError to the correct HTTP response.
 * Must be caught inside the operation so privateRequest's generic handler
 * (which only knows PrivatePaperStoreError) does not turn these into 500.
 */
function progressErrorResponse(error: PrivatePaperProgressStoreError): Response {
  const extra = error.extra ?? {};
  switch (error.code) {
    case "NOT_FOUND":
      return Response.json({ error: "not_found" }, { status: 404 });
    case "VALIDATION_ERROR":
      return Response.json(
        { error: "validation_error", message: error.message, details: extra.details },
        { status: 422 },
      );
    case "CONFLICT":
      if (extra.conflictType === "submission_conflict") return Response.json({ error: "submission_conflict", currentRevision: extra.currentRevision, serverProgress: extra.serverProgress }, { status: 409 });
      if (extra.conflictType === "revision_conflict") {
        return Response.json(
          {
            error: "revision_conflict",
            currentRevision: extra.currentRevision,
            serverProgress: extra.serverProgress,
          },
          { status: 409 },
        );
      }
      if (extra.conflictType === "attempt_mismatch") {
        return Response.json(
          { error: "attempt_mismatch", currentAttemptId: extra.currentAttemptId },
          { status: 409 },
        );
      }
      return Response.json({ error: "conflict", message: error.message }, { status: 409 });
    case "NOT_READY":
      return Response.json(
        { error: "not_ready", reason: extra.reason },
        { status: 409 },
      );
    case "CONTENT_CHANGED":
      return Response.json({ error: "content_changed" }, { status: 410 });
    case "INTERNAL_ERROR":
    default:
      return Response.json({ error: "internal_error" }, { status: 500 });
  }
}

/** Wrap an operation so PrivatePaperProgressStoreError is mapped before propagating. */
async function withProgressErrorMapping(operation: () => Promise<Response>): Promise<Response> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof PrivatePaperProgressStoreError) {
      return progressErrorResponse(error);
    }
    throw error;
  }
}

// GET /api/private-papers/[paperId]/progress
export async function GET(_request: Request, { params }: RouteParams) {
  return privateRequest(
    () => safeAuth(),
    async (owner) =>
      withProgressErrorMapping(async () => {
        const paperId = (await params).paperId;
        const snapshot = await readPrivateProgressSnapshot(owner, paperId);
        return Response.json({ exists: snapshot.progress !== null, ...snapshot });
      }),
  );
}

// PUT /api/private-papers/[paperId]/progress
export async function PUT(request: Request, { params }: RouteParams) {
  return privateRequest(
    () => safeAuth(),
    async (owner) =>
      withProgressErrorMapping(async () => {
        const paperId = (await params).paperId;
        const body = await readPrivateBody(request);
        const result = await putPrivatePaperProgress(owner, paperId, body);
        return Response.json({ ok: true, ...result });
      }),
  );
}
