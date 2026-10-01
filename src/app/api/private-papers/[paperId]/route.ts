import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import {
  getPrivatePaper,
  updatePrivatePaper,
  deletePrivatePaper,
  PrivatePaperStoreError,
  type UpdatePrivatePaperInput,
} from "@/content/private-paper-store";

interface RouteParams {
  params: Promise<{ paperId: string }>;
}

/** GET /api/private-papers/[paperId] — 获取单个私有卷（按 owner 限定）。 */
export async function GET(_request: Request, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { paperId } = await params;
  const decodedPaperId = decodeURIComponent(paperId);

  try {
    const paper = await getPrivatePaper(session.user.id, decodedPaperId);
    return NextResponse.json({ paper });
  } catch (err) {
    if (err instanceof PrivatePaperStoreError) {
      // NOT_FOUND 和 UNAUTHORIZED 都返回一致的 404，避免泄露存在性
      const status = err.code === "UNAUTHORIZED" ? 401 : 404;
      return NextResponse.json({ error: "paper not found", code: err.code }, { status });
    }
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}

/** PUT /api/private-papers/[paperId] — 更新私有卷（身份字段禁止修改）。 */
export async function PUT(request: Request, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { paperId } = await params;
  const decodedPaperId = decodeURIComponent(paperId);

  let body: UpdatePrivatePaperInput;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "request body required" }, { status: 400 });
  }

  try {
    const result = await updatePrivatePaper(session.user.id, decodedPaperId, body);
    return NextResponse.json(result);
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

/** DELETE /api/private-papers/[paperId] — 删除私有卷（按 owner 限定）。 */
export async function DELETE(_request: Request, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { paperId } = await params;
  const decodedPaperId = decodeURIComponent(paperId);

  try {
    await deletePrivatePaper(session.user.id, decodedPaperId);
    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof PrivatePaperStoreError) {
      const status = err.code === "UNAUTHORIZED" ? 401 : 404;
      return NextResponse.json({ error: "paper not found", code: err.code }, { status });
    }
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
