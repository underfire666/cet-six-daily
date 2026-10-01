import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import {
  createPrivatePaper,
  listPrivatePapers,
  PrivatePaperStoreError,
  type CreatePrivatePaperInput,
} from "@/content/private-paper-store";

/** GET /api/private-papers — 列出当前用户的所有私有卷（摘要）。 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const papers = await listPrivatePapers(session.user.id);
    return NextResponse.json({ papers });
  } catch (err) {
    if (err instanceof PrivatePaperStoreError) {
      const status = err.code === "UNAUTHORIZED" ? 401 : 500;
      return NextResponse.json({ error: err.message, code: err.code }, { status });
    }
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}

/** POST /api/private-papers — 创建私有卷。server 从 session 派生 owner。 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: CreatePrivatePaperInput;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "request body required" }, { status: 400 });
  }

  try {
    const result = await createPrivatePaper(session.user.id, body);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    if (err instanceof PrivatePaperStoreError) {
      const statusMap: Record<string, number> = {
        UNAUTHORIZED: 401,
        VALIDATION_ERROR: 422,
        DUPLICATE_ID: 409,
        NOT_FOUND: 404,
        INTERNAL_ERROR: 500,
      };
      const status = statusMap[err.code] ?? 500;
      return NextResponse.json(
        { error: err.message, code: err.code, details: err.details },
        { status },
      );
    }
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
