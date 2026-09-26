import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { applyPushBatch, validateMutation, type SyncMutationInput } from "@/lib/sync/server";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const userId = session.user.id;

  const body = await req.json().catch(() => null);
  const mutations = Array.isArray(body?.mutations) ? (body.mutations as Partial<SyncMutationInput>[]) : [];
  if (mutations.length === 0) return NextResponse.json({ applied: [], skipped: [] });

  for (const m of mutations) {
    const err = validateMutation(m);
    if (err) return NextResponse.json({ error: err }, { status: 400 });
  }

  try {
    const result = await applyPushBatch(userId, mutations as SyncMutationInput[]);
    return NextResponse.json(result);
  } catch (e) {
    console.error("[sync/push]", (e as Error).message);
    return NextResponse.json({ error: "sync failed" }, { status: 500 });
  }
}
