import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { readPullSnapshotForUser } from "@/lib/sync/pull";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json(await readPullSnapshotForUser(session.user.id));
}
