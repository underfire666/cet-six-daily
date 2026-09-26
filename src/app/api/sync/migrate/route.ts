import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { applyGuestMigration, testFailureInjectionAllowed } from "@/lib/sync/migration-server";
import { validateMutation, type SyncMutationInput } from "@/lib/sync/server";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null);
  const migrationId = body?.migrationId;
  const mutations = body?.mutations;
  if (typeof migrationId !== "string" || !migrationId || migrationId.length > 200 || !Array.isArray(mutations) || mutations.length > 1000) {
    return NextResponse.json({ error: "invalid migration request" }, { status: 400 });
  }
  for (const mutation of mutations) {
    if (mutation?.entityType === "migrationRecord") return NextResponse.json({ error: "server-owned entity" }, { status: 400 });
    const issue = validateMutation(mutation as Partial<SyncMutationInput>);
    if (issue) return NextResponse.json({ error: issue }, { status: 400 });
  }
  // Ordinary production requests cannot activate transaction failure injection.
  const failAfter = testFailureInjectionAllowed() && Number.isInteger(body?.testFailureAfter) && body.testFailureAfter > 0
    ? body.testFailureAfter as number
    : undefined;
  try {
    const result = await applyGuestMigration(session.user.id, migrationId, mutations as SyncMutationInput[], { failAfter });
    return NextResponse.json(result);
  } catch (error) {
    console.error("[sync/migrate]", (error as Error).message);
    return NextResponse.json({ error: "migration failed" }, { status: 500 });
  }
}
