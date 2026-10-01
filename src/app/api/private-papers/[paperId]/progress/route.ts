import { auth } from "@/lib/auth/config";
import { privateRequest, readPrivateBody } from "@/lib/private-papers/http";
import {
  getPrivatePaperProgress,
  putPrivatePaperProgress,
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

// GET /api/private-papers/[paperId]/progress
export async function GET(_request: Request, { params }: RouteParams) {
  return privateRequest(
    () => safeAuth(),
    async (owner) => {
      const paperId = (await params).paperId;
      const progress = await getPrivatePaperProgress(owner, paperId);
      return Response.json({ exists: progress !== null, progress });
    },
  );
}

// PUT /api/private-papers/[paperId]/progress
export async function PUT(request: Request, { params }: RouteParams) {
  return privateRequest(
    () => safeAuth(),
    async (owner) => {
      const paperId = (await params).paperId;
      const body = await readPrivateBody(request);
      const result = await putPrivatePaperProgress(owner, paperId, body);
      return Response.json({ ok: true, ...result });
    },
  );
}