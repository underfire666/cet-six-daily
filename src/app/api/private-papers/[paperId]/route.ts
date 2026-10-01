import { auth } from "@/lib/auth/config";
import { getPrivatePaper, updatePrivatePaper, deletePrivatePaper } from "@/content/private-paper-store";
import { privateRequest, readPrivateBody } from "@/lib/private-papers/http";
interface RouteParams { params: Promise<{ paperId: string }> }
// Next.js supplies decoded params. Decoding again corrupts literal % and %25 IDs.
export async function GET(_request: Request, { params }: RouteParams) {
  return privateRequest(() => auth(), async owner => Response.json({ paper: await getPrivatePaper(owner, (await params).paperId) }));
}
export async function PUT(request: Request, { params }: RouteParams) {
  return privateRequest(() => auth(), async owner => Response.json(await updatePrivatePaper(owner, (await params).paperId, await readPrivateBody(request))));
}
export async function DELETE(_request: Request, { params }: RouteParams) {
  return privateRequest(() => auth(), async owner => Response.json(await deletePrivatePaper(owner, (await params).paperId)));
}
