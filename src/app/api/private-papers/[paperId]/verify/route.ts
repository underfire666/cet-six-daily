import { auth } from "@/lib/auth/config";
import { getPrivatePaper, PrivatePaperStoreError } from "@/content/private-paper-store";
import { computePrivateContentHash } from "@/lib/private-papers/readiness";
import { privateRequest } from "@/lib/private-papers/http";

interface RouteParams {
  params: Promise<{ paperId: string }>;
}

/**
 * 轻量级私有卷验证端点。
 * 返回 { exists, accessible, contentHash, paperTitle }。
 * 用于学习页在返回页面/重新聚焦/提交前重新验证权限和内容有效性。
 * 不返回完整题目内容，仅返回验证所需的最小数据。
 */
export async function GET(_request: Request, { params }: RouteParams) {
  return privateRequest(
    () => auth(),
    async (owner) => {
      const { paperId } = await params;
      try {
        const paper = await getPrivatePaper(owner, paperId);
        const contentHash = computePrivateContentHash(paper.content);
        return Response.json({
          exists: true,
          accessible: true,
          contentHash,
          paperTitle: paper.title,
        });
      } catch (err) {
        if (err instanceof PrivatePaperStoreError && err.code === "NOT_FOUND") {
          return Response.json(
            { exists: false, accessible: false, contentHash: null, paperTitle: null },
            { status: 404 },
          );
        }
        throw err;
      }
    },
  );
}
