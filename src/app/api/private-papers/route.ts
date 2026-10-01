import { auth } from "@/lib/auth/config";
import { createPrivatePaper, listPrivatePapers } from "@/content/private-paper-store";
import { privateRequest, readPrivateBody } from "@/lib/private-papers/http";
export async function GET() {
  return privateRequest(() => auth(), async owner => Response.json({ papers: await listPrivatePapers(owner) }));
}
export async function POST(request: Request) {
  return privateRequest(() => auth(), async owner => Response.json(await createPrivatePaper(owner, await readPrivateBody(request)), { status: 201 }));
}
